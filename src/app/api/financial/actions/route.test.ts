import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { FINANCIAL_ACTION_IMPORT_MAX_BYTES } from "@/lib/financial/actions";
import {
  actionImportFixture,
  savedActionBatchFixture,
} from "../../../../../tests/fixtures/financial-actions";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/financial-actions", () => ({
  listFinancialActions: mocks.list,
  importFinancialActions: mocks.save,
  updateFinancialAction: mocks.update,
}));
import { GET, POST, PATCH } from "./route";

const methods = { GET, POST, PATCH };
const admin = { uid: "admin", role: "SUPER_ADMIN", tenantId: null };
function request(method: keyof typeof methods, body?: string) {
  return new NextRequest("https://example.test/api/financial/actions", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "GET" ? {} : { body: body || "not-json" }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(admin);
});

describe("financial actions authenticated API", () => {
  it.each(["GET", "POST", "PATCH"] as const)(
    "requires authentication for %s and disables shared caches",
    async (method) => {
      mocks.auth.mockRejectedValue(new AuthError("Sessão necessária", 401));
      const response = await methods[method](request(method));
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Authorization");
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );
  it.each(["GET", "POST", "PATCH"] as const)(
    "rejects tenant admins before reading %s payloads or calling services",
    async (method) => {
      mocks.auth.mockResolvedValue({ ...admin, role: "ADMIN", tenantId: "client-a" });
      const response = await methods[method](request(method, "invalid JSON"));
      expect(response.status).toBe(403);
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );
  it("returns a confirmed import and forwards the versioned update without accepting a user identity", async () => {
    const batch = savedActionBatchFixture();
    mocks.save.mockResolvedValue({ batch, alreadySaved: true });
    const response = await POST(request("POST", JSON.stringify(actionImportFixture)));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ alreadySaved: true, batch: { id: batch.id } });
    expect(mocks.save).toHaveBeenCalledWith(admin, actionImportFixture);
    const patch = {
      batchId: batch.id,
      actionId: batch.actions[0].id,
      expectedVersion: 1,
      status: "in_progress",
    };
    mocks.update.mockResolvedValue({ batch, action: batch.actions[0] });
    expect((await PATCH(request("PATCH", JSON.stringify(patch)))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(admin, patch);
  });
  it("bounds actual request bytes even without a Content-Length header and rejects malformed JSON", async () => {
    const tooLarge = await POST(request("POST", " ".repeat(FINANCIAL_ACTION_IMPORT_MAX_BYTES + 1)));
    expect(tooLarge.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    expect((await POST(request("POST", "{broken"))).status).toBe(400);
    expect((await PATCH(request("PATCH", " ".repeat(32 * 1024 + 1)))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("preserves collision/concurrency status and redacts unexpected storage errors", async () => {
    mocks.update.mockRejectedValue(new AuthError("Versão antiga", 409));
    expect((await PATCH(request("PATCH", "{}"))).status).toBe(409);
    mocks.list.mockRejectedValue(new Error("private bucket token and financial payload"));
    const response = await GET(request("GET"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private bucket");
  });
});
