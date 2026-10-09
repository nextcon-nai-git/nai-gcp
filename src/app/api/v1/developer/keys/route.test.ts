import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "./route";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  collection: vi.fn(),
  get: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mocks.collection } }));
vi.mock("@/lib/developer-api-guard", () => ({
  VALID_DEVELOPER_SCOPES: ["*", "access_control:read"],
  generateApiKey: () => ({ rawKey: "secret", keyHash: "hash", keyPrefix: "prefix" }),
}));
const user = (role = "ADMIN", tenantId: string | null = "a") => ({
  uid: "u",
  role,
  tenantId,
  permissions: [],
  servedCompanies: [],
});
const request = (method: string, body?: unknown, query = "") =>
  new NextRequest(`https://example.test/api/v1/developer/keys${query}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(user());
  const chain = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: mocks.get,
    add: mocks.add,
    update: mocks.update,
  };
  mocks.collection.mockReturnValue(chain);
  mocks.get.mockResolvedValue({
    exists: true,
    size: 1,
    docs: [{ id: "key", data: () => ({ clientId: "a", keyHash: "private-hash", name: "test" }) }],
    data: () => ({ clientId: "a" }),
  });
  mocks.add.mockResolvedValue({ id: "new-key" });
  mocks.update.mockResolvedValue(undefined);
});
describe("API key administration", () => {
  it.each([GET, POST, DELETE])(
    "rejects anonymous requests before database access",
    async (handler) => {
      mocks.auth.mockRejectedValue(new AuthError("Sessão ausente", 401));
      expect(
        (await handler(request(handler === POST ? "POST" : handler === DELETE ? "DELETE" : "GET")))
          .status
      ).toBe(401);
      expect(mocks.collection).not.toHaveBeenCalled();
    }
  );
  it("rejects staff and a tenant administrator creating a global key", async () => {
    mocks.auth.mockResolvedValue(user("OPERATIONS"));
    expect((await GET(request("GET"))).status).toBe(403);
    mocks.auth.mockResolvedValue(user());
    expect(
      (await POST(request("POST", { clientId: "GLOBAL", name: "master", scopes: ["*"] }))).status
    ).toBe(403);
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("creates a tenant key only after authentication and scope validation", async () => {
    const response = await POST(
      request("POST", { clientId: "a", name: " Integration ", scopes: ["access_control:read"] })
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Integration", createdBy: "u", clientId: "a" })
    );
    expect((await response.json()).rawKey).toBe("secret");
  });
  it("rejects invalid input without issuing credentials", async () => {
    for (const body of [
      { clientId: "a/b", name: "key" },
      { clientId: "a", name: "   " },
      { clientId: "a", name: "key", scopes: ["unknown"] },
    ])
      expect((await POST(request("POST", body))).status).toBe(400);
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("limits tenant listing and never returns the stored hash", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("private-hash");
    expect((await GET(request("GET", undefined, "?clientId=b"))).status).toBe(403);
  });
  it("rejects revocation of another tenant's key", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ clientId: "b" }) });
    expect((await DELETE(request("DELETE", undefined, "?id=key"))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("records the administrator when revoking an authorized key", async () => {
    expect((await DELETE(request("DELETE", undefined, "?id=key"))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: false, revokedBy: "u" })
    );
  });
});
