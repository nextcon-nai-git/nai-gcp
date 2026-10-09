import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireApiKey, handleApiGuardError, requireClient } from "./developer-api-guard";
const state = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      where() {
        return this;
      },
      limit() {
        return this;
      },
      doc() {
        return this;
      },
      get: state.get,
      update: state.update,
      add: state.add,
    }),
  },
}));
it("authenticates a server-side M2M credential and records use", async () => {
  state.get.mockResolvedValue({
    empty: false,
    docs: [
      {
        id: "key-a",
        data: () => ({ clientId: "a", scopes: ["pgr:read"], keyPrefix: "nai_live_test" }),
      },
    ],
  });
  const key = await requireApiKey(
    new NextRequest("https://example.test/api/pgr", { headers: { "x-api-key": "nai_live_test" } })
  );
  expect(key.clientId).toBe("a");
  expect(state.update).toHaveBeenCalled();
  expect(state.add).toHaveBeenCalled();
  expect(() => requireClient(key, "b")).toThrow("Isolamento Tenant");
});
it("does not return internal infrastructure errors to callers", async () => {
  const response = handleApiGuardError(new Error("secret internal host credential"));
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});
it("rejects records without a tenant before writing audit data", async () => {
  state.update.mockClear();
  state.get.mockResolvedValue({
    empty: false,
    docs: [{ id: "invalid", data: () => ({ scopes: ["*"] }) }],
  });
  await expect(
    requireApiKey(
      new NextRequest("https://example.test", { headers: { "x-api-key": "nai_live_test" } })
    )
  ).rejects.toThrow("sem vínculo");
  expect(state.update).not.toHaveBeenCalled();
});
