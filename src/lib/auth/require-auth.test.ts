import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: mocks.verify },
  adminDb: { collection: () => ({ doc: () => ({ get: mocks.get }) }) },
}));
import { requireAuth } from "./require-auth";
beforeEach(() => {
  mocks.verify
    .mockReset()
    .mockResolvedValue({ uid: "expert", email: "expert@example.test", role: "SUPER_ADMIN" });
  mocks.get.mockReset().mockResolvedValue({
    exists: true,
    data: () => ({
      email: "expert@example.test",
      role: "SCOPED_PROVIDER",
      accessEnabled: true,
      servedCompanies: ["allowed"],
      permissions: ["*"],
    }),
  });
});
const request = (path: string, method = "GET") =>
  new NextRequest(`https://nai.test${path}`, {
    method,
    headers: { authorization: "Bearer synthetic" },
  });
it("allows only GET on the exclusive workspace using the stored role", async () => {
  expect((await requireAuth(request("/api/expert/workspace?company=allowed"))).role).toBe(
    "SCOPED_PROVIDER"
  );
  expect(mocks.verify).toHaveBeenCalledWith("synthetic", true);
});
it.each([
  "/api/financial/monthly-billing",
  "/api/pgr/records",
  "/api/admin/expert-accounts",
  "/api/clients/grupo-avp",
  "/action",
])("blocks other APIs even with a forged global claim or wildcard (%s)", async (path) => {
  await expect(requireAuth(request(path))).rejects.toMatchObject({ status: 403 });
});
it.each(["POST", "PUT", "PATCH", "DELETE"])("denies mutation %s", async (method) => {
  await expect(requireAuth(request("/api/expert/workspace", method))).rejects.toMatchObject({
    status: 403,
  });
});
it("rejects revoked access and revoked authentication", async () => {
  mocks.get.mockResolvedValue({
    exists: true,
    data: () => ({ role: "SCOPED_PROVIDER", accessEnabled: false }),
  });
  await expect(requireAuth(request("/api/expert/workspace"))).rejects.toMatchObject({
    status: 403,
  });
  mocks.verify.mockRejectedValue(new Error("revoked"));
  await expect(requireAuth(request("/api/expert/workspace"))).rejects.toMatchObject({
    status: 401,
  });
});
