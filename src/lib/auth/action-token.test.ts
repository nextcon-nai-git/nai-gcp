import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  auth: { currentUser: null as null | { getIdToken: () => Promise<string> } },
}));
vi.mock("firebase/auth", () => ({ getAuth: () => state.auth }));
import { getActionIdToken } from "./action-token";
beforeEach(() => {
  state.auth.currentUser = null;
});
describe("action credential lifecycle", () => {
  it("requires a signed-in account and returns a token only for the same session", async () => {
    await expect(getActionIdToken()).rejects.toThrow("Entre no NAI");
    state.auth.currentUser = { getIdToken: async () => "synthetic-token" };
    await expect(getActionIdToken()).resolves.toBe("synthetic-token");
  });
  it.each(["logout", "switch"])("discards a credential resolved after %s", async (change) => {
    let finish!: (token: string) => void;
    state.auth.currentUser = {
      getIdToken: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    const pending = getActionIdToken();
    state.auth.currentUser = change === "logout" ? null : { getIdToken: async () => "other-token" };
    finish("old-token");
    await expect(pending).rejects.toThrow("sessão mudou");
  });
  it("preserves authentication errors without returning any credential", async () => {
    state.auth.currentUser = {
      getIdToken: async () => {
        throw new Error("credential unavailable");
      },
    };
    await expect(getActionIdToken()).rejects.toThrow("credential unavailable");
  });
});
