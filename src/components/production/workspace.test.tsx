import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommand, CommandSchema, emptyBook } from "@/lib/production/model";
const state = vi.hoisted(() => ({
  user: { uid: "admin" } as { uid: string } | null,
  fetch: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: state.user }), useStorage: () => ({}) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: async () => "test-token" }));
vi.mock("@/lib/contracts/integration", () => ({
  hashContractFile: state.hash,
  preserveContractSource: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import ProductionWorkspace from "./workspace";
let root: Root, host: HTMLDivElement;
const company = { id: "c1", name: "Cliente teste", cnpj: "11222333000181" };
const c = CommandSchema.parse({
  action: "create",
  requestId: "fa57b815-55d0-42bc-b01c-de52cbdb320a",
  expectedVersion: 0,
  recordId: "r1",
  companyId: "c1",
  cnpj: company.cnpj,
  name: "Contrato teste",
  owner: "Gestora",
  terms: {
    scope: "Serviço teste",
    units: "Unidade A",
    deliverables: "Relatório",
    valueCents: 10000,
    startsOn: "2026-10-01",
    endsOn: "",
    paymentTerms: "Mensal",
    recurring: true,
  },
  document: null,
  effectiveOn: "2026-10-01",
  evidence: "Revisado",
  reviewed: true,
});
const book = applyCommand(emptyBook(), c, "admin", "now", "hash", company.name);
const reply = (data: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});
async function render() {
  await act(async () => {
    root.render(<ProductionWorkspace />);
  });
}
async function click(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(label)
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.click();
  });
}
async function selectRecord() {
  const select = Array.from(host.querySelectorAll("select")).find((s) =>
    Array.from(s.options).some((o) => o.value === "r1")
  )!;
  await act(async () => {
    select.value = "r1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.user = { uid: "admin" };
  state.fetch.mockReset().mockResolvedValue(reply({ book, companies: [company] }));
  vi.stubGlobal("fetch", state.fetch);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("production workspace", () => {
  it("renders nine work instructions and three agent entry points", async () => {
    await render();
    await click("Instruções de trabalho");
    expect(host.textContent).toContain("versão 1.0");
    expect(host.querySelectorAll("ol")).toHaveLength(9);
    await click("3 agentes IA");
    await selectRecord();
    for (const name of ["NAI Comercial", "NAI Operacional", "NAI Faturamento"])
      expect(host.textContent).toContain(name);
  });
  it("shows commercial and six cycle cards with separate finance totals", async () => {
    await render();
    await selectRecord();
    expect(host.textContent).toContain("0/9 cards concluídos");
    expect(
      Array.from(host.querySelectorAll("summary")).filter(
        (s) => s.textContent === "Editar card e consultar passo a passo"
      )
    ).toHaveLength(9);
    expect(host.textContent).toContain("Medido");
    expect(host.textContent).toContain("Faturado registrado");
    expect(host.textContent).toContain("Recebido registrado");
  });
  it("does not report success on an ambiguous save and retries the identical command", async () => {
    await render();
    await selectRecord();
    const form = Array.from(host.querySelectorAll("form")).find((f) =>
      f.textContent?.includes("Salvar card")
    )!;
    (form.elements.namedItem("reason") as HTMLTextAreaElement).value = "Atualização de responsável";
    state.fetch.mockResolvedValueOnce(reply({ error: "Indisponível" }, 503));
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(host.textContent).not.toContain("Alteração salva e confirmada");
    expect(host.textContent).toContain("Repetir a mesma solicitação");
    const first = state.fetch.mock.calls.at(-1)![1].body;
    state.fetch.mockResolvedValueOnce(reply(book));
    await click("Repetir a mesma solicitação");
    expect(state.fetch.mock.calls.at(-1)![1].body).toBe(first);
    expect(host.textContent).toContain("Alteração salva e confirmada");
  });
  it("does not retain one user's records after sign-out", async () => {
    await render();
    await selectRecord();
    expect(host.textContent).toContain(company.name);
    state.user = null;
    await render();
    expect(host.textContent).not.toContain(company.name);
    expect(host.textContent).toContain("Entre no NAI");
  });
  it("submits consultations without sending messages or mutating the central", async () => {
    await render();
    await click("3 agentes IA");
    await selectRecord();
    state.fetch.mockResolvedValueOnce(reply({ answer: "RASCUNHO NÃO ENVIADO", basedOnVersion: 1 }));
    await click("Consultar NAI Comercial");
    const [path, options] = state.fetch.mock.calls.at(-1)!;
    expect(path).toBe("/api/production/assistant");
    expect(JSON.parse(options.body)).toMatchObject({
      action: "consult",
      stage: "comercial",
      recordId: "r1",
    });
    expect(host.textContent).toContain("RASCUNHO NÃO ENVIADO");
  });
});

describe("PDF preservation in the central", () => {
  it.each([true, false])(
    "uses an authenticated bounded upload and verifies the response (%s)",
    async (valid) => {
      state.hash.mockResolvedValue("a".repeat(64));
      await render();
      await click("Novo registro");
      const file = new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" });
      state.fetch.mockResolvedValueOnce(
        reply({ source: { sha256: (valid ? "a" : "b").repeat(64), sizeBytes: file.size } })
      );
      const input = host.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [file] });
      await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(state.fetch).toHaveBeenLastCalledWith(
        "/api/production/source",
        expect.objectContaining({
          method: "PUT",
          body: file,
          signal: expect.any(AbortSignal),
          headers: { Authorization: "Bearer test-token", "Content-Type": "application/pdf" },
        })
      );
      expect(host.textContent).toContain(
        valid ? "Fonte preservada:" : "A integridade do arquivo enviado não foi confirmada."
      );
      expect(host.textContent?.includes("Fonte preservada:")).toBe(valid);
    }
  );
});
