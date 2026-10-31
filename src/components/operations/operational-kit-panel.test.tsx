import React, { act } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
import type { KitPreview } from "@/lib/operational-kits";
const m = vi.hoisted(() => ({
  token: vi.fn(),
  fetch: vi.fn(),
  preview: vi.fn(),
  selection: vi.fn(),
  busy: vi.fn(),
}));
// Keep the hook object stable, like the actual authentication provider.
const authUser = { uid: "admin", getIdToken: m.token };
vi.mock("@/firebase", () => ({ useUser: () => ({ user: authUser }) }));
import { OperationalKitPanel } from "./operational-kit-panel";
const catalog = {
  employees: [{ id: "e1", name: "Teste", role: "Assistente", department: "Admin" }],
  clinics: [{ id: "c1", name: "Clínica", city: "Curitiba" }],
  documents: [
    { id: "a".repeat(64), name: "PCMSO.pdf" },
    { id: "b".repeat(64), name: "PGR.pdf" },
  ],
  history: [],
};
const preview: KitPreview = {
  proposalId: "preview-id",
  expiresAt: Date.now() + 60000,
  company: "Teste",
  clinic: "Clínica",
  clinicAddress: "Rua",
  cycle: "2026-11",
  examType: "periodico",
  employees: catalog.employees,
  documents: catalog.documents.map((d) => ({ ...d, purpose: d.name })),
  exams: ["Clínico"],
  risks: ["Conforme PGR"],
  pcmsoDoctor: "Médico",
  pcmsoCrm: "123/SP",
};
let view: ReturnType<typeof ui>;
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
const element = (p: KitPreview | null = null, disabled = false) => (
  <OperationalKitPanel
    companyId="ONE"
    preview={p}
    onPreview={m.preview}
    onSelection={m.selection}
    onBusy={m.busy}
    disabled={disabled}
  />
);
beforeEach(() => {
  vi.clearAllMocks();
  m.token.mockResolvedValue("token");
  m.fetch.mockResolvedValue(response(catalog));
  vi.stubGlobal("fetch", m.fetch);
  view = ui();
});
afterEach(async () => {
  await view.cleanup();
  vi.unstubAllGlobals();
});
describe("operational kit review UI", () => {
  it("requires review, sends only the saved proposal and does not claim SOC delivery", async () => {
    await view.render(element(preview));
    expect(view.button("Confirmar e gerar").disabled).toBe(true);
    await act(async () => {
      view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click();
    });
    expect(view.button("Confirmar e gerar").disabled).toBe(false);
    m.fetch.mockResolvedValue(
      response({
        results: [{ id: "kit1", employeeName: "Teste", filename: "Kit.pdf", reused: true }],
      })
    );
    await view.click("Confirmar e gerar");
    expect(JSON.parse(m.fetch.mock.calls.at(-1)![1].body)).toEqual({
      action: "confirm",
      companyId: "ONE",
      proposalId: "preview-id",
      reviewed: true,
    });
    expect(view.container.textContent).toContain("Nenhum envio ou pedido SOC realizado");
    expect(view.container.textContent).toContain("Kit existente reutilizado");
  });
  it("invalidates the prior preview when selected inputs change", async () => {
    await view.render(element(preview));
    await view.input('input[type="month"]', "2026-12");
    expect(m.preview).toHaveBeenLastCalledWith(null);
    expect(m.selection).toHaveBeenLastCalledWith(undefined);
    expect(view.button("Confirmar e gerar").disabled).toBe(true);
  });
  it("blocks changes while the chat is preparing the selected batch", async () => {
    await view.render(element(preview, true));
    expect(view.container.querySelector("fieldset")?.disabled).toBe(true);
    expect(view.button("Confirmar e gerar").disabled).toBe(true);
  });
  it("does not show a late confirmation after the session is unmounted", async () => {
    await view.render(element(preview));
    await act(async () => {
      view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click();
    });
    const pending = deferred<ReturnType<typeof response>>();
    m.fetch.mockReturnValue(pending.promise);
    await act(async () => {
      view.button("Confirmar e gerar").click();
    });
    await view.cleanup();
    await act(async () => pending.resolve(response({ results: [] })));
    expect(m.preview).not.toHaveBeenCalled();
  });
});
