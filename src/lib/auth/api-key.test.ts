import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireApiKey } from "./api-key";
const mock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: mock.get,
    }),
  },
}));
beforeEach(() => vi.clearAllMocks());
it.each([undefined, "", null])(
  "rejects a credential without tenant (%s) instead of granting GLOBAL",
  async (clientId) => {
    mock.get.mockResolvedValue({
      empty: false,
      docs: [{ id: "key", data: () => ({ clientId, scopes: ["*"] }) }],
    });
    await expect(
      requireApiKey(new NextRequest("https://example.test", { headers: { "x-api-key": "key" } }))
    ).rejects.toThrow("sem vínculo");
  }
);
it("preserves an explicitly assigned tenant and scopes", async () => {
  mock.get.mockResolvedValue({
    empty: false,
    docs: [{ id: "key", data: () => ({ clientId: "a", scopes: ["pgr:read"] }) }],
  });
  await expect(
    requireApiKey(new NextRequest("https://example.test", { headers: { "x-api-key": "key" } }))
  ).resolves.toMatchObject({ clientId: "a", scopes: ["pgr:read"] });
});
