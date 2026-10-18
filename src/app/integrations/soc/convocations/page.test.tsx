import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  role: "ADMIN",
  user: { uid: "admin", getIdToken: async () => "token" },
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: mocks.user, role: mocks.role, tenantId: null }),
}));
import ConvocationsPage from "./page";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.role = "ADMIN";
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ snapshot: null }) });
  vi.stubGlobal("fetch", mocks.fetch);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("offers read-only operations reload without import controls", async () => {
  mocks.role = "OPERATIONS";
  await act(async () => root.render(<ConvocationsPage />));
  expect(host.querySelector('input[type="file"]')).toBeNull();
  expect(host.textContent).toContain("Recarregar base salva");
});
it("retains confirmed import success when the subsequent refresh fails", async () => {
  await act(async () => root.render(<ConvocationsPage />));
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ imported: true, summary: { rows: 42 } }),
    })
    .mockRejectedValueOnce(Error("offline"));
  const input = host.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File(["csv"], "base.csv")] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(host.textContent).toContain("Importação salva: 42 linhas");
  expect(host.textContent).toContain(
    "A importação foi salva, mas não foi possível atualizar a consulta"
  );
  expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(
    1
  );
});
