import React from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ role: "SUPER_ADMIN", fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: { uid: "admin" }, role: m.role }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: async () => "synthetic" }));
import { UserAccessSettings } from "./user-access-settings";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.role = "SUPER_ADMIN";
  m.fetch.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({
      name: "Synthetic",
      email: "test@example.test",
      revision: "r",
      active: true,
      warning: "",
      busy: false,
      account: null,
      companies: [{ id: "a", name: "Empresa autorizada", cnpj: "" }],
    }),
  });
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
it("hides account administration from non-admins", async () => {
  m.role = "OPERATIONS";
  await v.render(<UserAccessSettings kind="provider" id="p" name="Synthetic" />);
  expect(v.container.querySelector("button")).toBeNull();
  expect(m.fetch).not.toHaveBeenCalled();
});
it("opens restricted provider controls from the name configuration icon", async () => {
  await v.render(<UserAccessSettings kind="provider" id="p" name="Synthetic" />);
  await v.click("Configurar acesso de Synthetic");
  expect(m.fetch).toHaveBeenCalledWith(
    "/api/admin/user-access?kind=provider&id=p",
    expect.objectContaining({ cache: "no-store" })
  );
  expect(document.body.textContent).toContain("Sem contratos, faturamento, prontuários ou edição");
  expect(v.button("Criar login").disabled).toBe(true);
  expect(document.body.querySelector('select[aria-label="Perfil de acesso"]')).toBeNull();
});
it("requires an explicit employee profile and does not offer superadmin", async () => {
  await v.render(<UserAccessSettings kind="employee" id="e" name="Synthetic" />);
  await v.click("Configurar acesso de Synthetic");
  const select = document.body.querySelector(
    'select[aria-label="Perfil de acesso"]'
  ) as HTMLSelectElement;
  expect(select.value).toBe("");
  expect(select.textContent).not.toContain("SUPER_ADMIN");
  await v.input('select[aria-label="Perfil de acesso"]', "OPERATIONS");
  expect(document.body.textContent).toContain("Não é um acesso restrito por empresa");
});
