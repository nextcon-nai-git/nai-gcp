import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  collection: vi.fn(),
  group: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mock.collection, collectionGroup: mock.group },
}));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ role: "ADMIN", tenantId: "tenant-a", servedCompanies: [] });
  const query = { limit: () => ({ get: mock.get }) };
  mock.group.mockReturnValue(query);
  mock.collection.mockReturnValue({ doc: () => ({ collection: () => query }) });
  mock.get.mockResolvedValue({ docs: [], size: 0 });
});
it("blocks foreign company reads before touching Firestore", async () => {
  expect(
    (await GET(new NextRequest("https://nai.test/api/employees?company=tenant-b"))).status
  ).toBe(403);
  expect(mock.collection).not.toHaveBeenCalled();
  expect(mock.group).not.toHaveBeenCalled();
});
it("never uses global collection groups for tenant all requests", async () => {
  const response = await GET(new NextRequest("https://nai.test/api/employees?company=all"));
  expect(response.status).toBe(200);
  expect(mock.group).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("requires authentication", async () => {
  mock.auth.mockRejectedValue(new AuthError("Unauthorized", 401));
  expect((await GET(new NextRequest("https://nai.test/api/employees"))).status).toBe(401);
  expect(mock.get).not.toHaveBeenCalled();
});
