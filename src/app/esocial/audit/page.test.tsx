import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ui } from "../../../../tests/ui/harness";
const mock = vi.hoisted(() => ({ company: "canonical", error: null as Error | null }));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({
    activeClientId: mock.company,
    canBrowseAllCompanies: true,
    authorizedCompanies: [],
  }),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: { uid: "test" } }),
  useFirestore: () => ({}),
}));
vi.mock("@/hooks/use-company-directory", () => ({
  useCompanyDirectory: () => ({
    data: mock.error ? [] : [{ id: "canonical", name: "Empresa canônica", cnpj: "12345678000100" }],
    error: mock.error,
    isLoading: false,
  }),
}));
import Page from "./page";
let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
  mock.company = "canonical";
  mock.error = null;
});
afterEach(async () => view.cleanup());
it("uses the selected registered identity and never claims a successful empty audit", async () => {
  await view.render(<Page />);
  expect(view.container.textContent).toContain("12345678000100");
  expect(view.container.textContent).toContain("Auditoria não realizada");
  expect(view.button("Reprocessar Auditoria").disabled).toBe(true);
  mock.company = "unknown";
  await view.render(<Page />);
  expect(view.container.textContent).not.toContain("12345678000100");
  expect(view.container.textContent).not.toContain("44.882.110");
  mock.error = new Error("denied");
  await view.render(<Page />);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("indisponível");
  expect(view.container.textContent).not.toContain("Nenhuma inconsistência");
});
