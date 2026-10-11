import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  summarizeOmieDre,
  suggestOmieDreActions,
  type OmieDreQuery,
  type OmieDreReport,
  type OmieDreRow,
} from "@/lib/financial/omie-dre";
import type { SavedFinancialActionBatch } from "@/lib/financial/actions";

const mocks = vi.hoisted(() => ({ user: null as User | null, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
// Exercise the real page wrapper and component together; no Omie production request is made.
import OmieDrePage from "@/app/financial/omie/dre/page";

const query: OmieDreQuery = { start: "2026-01-01", end: "2026-09-30", dateBasis: "registration" };
const rows: OmieDreRow[] = [
  {
    id: "row-revenue",
    date: "2026-01-15",
    type: "Receita",
    group: "Receitas de serviços",
    account: "Receitas sintéticas",
    category: "Serviços prestados",
    amountCents: 150000,
    partyId: "client-test",
    partyName: "Cliente sintético",
    partyCnpj: null,
    identityStatus: "name_only",
    city: "Cidade teste",
    state: "PR",
  },
  {
    id: "row-engineer",
    date: "2026-07-15",
    type: "Despesa",
    group: "Custos de serviços",
    account: "Engenharia sintética",
    category: "Engenharia de segurança do trabalho",
    amountCents: -32000,
    partyId: "engineer-test",
    partyName: "Fornecedor sintético de engenharia",
    partyCnpj: "12.345.678/0001-95",
    identityStatus: "cnpj",
    city: "Cidade teste",
    state: "PR",
  },
  {
    id: "row-exams",
    date: "2026-08-15",
    type: "Despesa",
    group: "Custos de serviços",
    account: "Exames sintéticos",
    category: "Exames ocupacionais",
    amountCents: -15000,
    partyId: "clinic-test",
    partyName: "Clínica sintética para teste",
    partyCnpj: "98.765.432/0001-98",
    identityStatus: "cnpj",
    city: "Município sintético",
    state: "PR",
  },
  {
    id: "row-reversal",
    date: "2026-09-15",
    type: "Despesa",
    group: "Custos de serviços",
    account: "Engenharia sintética",
    category: "Engenharia de segurança do trabalho",
    amountCents: 2000,
    partyId: "engineer-test",
    partyName: "Fornecedor sintético de engenharia",
    partyCnpj: "12.345.678/0001-95",
    identityStatus: "cnpj",
    city: "Cidade teste",
    state: "PR",
  },
];
function reportFixture(company = "Empresa sintética da conta A", entries = rows): OmieDreReport {
  const source: Omit<OmieDreReport, "suggestedActions"> = {
    schemaVersion: 1,
    company,
    cnpj: "11.222.333/0001-44",
    query,
    queriedAt: "2026-10-11T12:00:00.000Z",
    sourceSha256: "a".repeat(64),
    rows: structuredClone(entries),
    summary: summarizeOmieDre(entries, query),
    warnings: ["Fonte sintética de teste; classificação e NFs precisam de conferência."],
  };
  return { ...source, suggestedActions: suggestOmieDreActions(source) };
}
function savedBatch(report: OmieDreReport): SavedFinancialActionBatch {
  const id = "f".repeat(64);
  const now = "2026-10-11T12:01:00.000Z";
  return {
    ...structuredClone(report.suggestedActions),
    id,
    importHash: "b".repeat(64),
    version: 1,
    importedAt: now,
    importedBy: "finance-a",
    updatedAt: now,
    updatedBy: "finance-a",
    actions: report.suggestedActions.actions.map((action, index) => ({
      ...structuredClone(action),
      id: (index + 1).toString(16).padStart(64, "0"),
      batchId: id,
      version: 1,
      updatedAt: now,
      updatedBy: "finance-a",
    })),
  };
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function account(uid: string): User {
  return { uid, getIdToken: vi.fn().mockResolvedValue(`token-${uid}`) } as unknown as User;
}
let container: HTMLDivElement;
let root: Root;
function text() {
  return (container.textContent || "").replace(/\u00a0/g, " ");
}
function findButton(label: string) {
  return Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label)
  );
}
function button(label: string) {
  const found = findButton(label);
  expect(found, label).toBeDefined();
  return found!;
}
async function mount() {
  await act(async () => root.render(<OmieDrePage />));
}
async function consult() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function changeField(label: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[aria-label="${label}"]`
  )!;
  await act(async () => {
    const prototype =
      field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.user = account("finance-a");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Omie DRE workspace session and financial workflow", () => {
  it("does not fetch or expose report/actions before an authenticated consultation", async () => {
    mocks.user = null;
    await mount();
    await consult();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    expect(text()).toContain("Entre no NAI com acesso à administração financeira");
    expect(text()).not.toContain("Contas da DRE");
    expect(findButton("Exportar lançamentos CSV")).toBeUndefined();
    expect(findButton("cards de ações")).toBeUndefined();
  });

  it("shows the queried period, date basis, account signs and narrower purchasing period, and invalidates them after a filter change", async () => {
    mocks.fetch.mockResolvedValueOnce(json(reportFixture()));
    await mount();
    await changeField("Data inicial", query.start);
    await changeField("Data final", query.end);
    await changeField("Base de datas no Omie", query.dateBasis);
    await consult();
    const [path, options] = mocks.fetch.mock.calls[0];
    const requested = new URL(path, "https://example.test");
    expect(Object.fromEntries(requested.searchParams)).toEqual(query);
    expect(options).toMatchObject({
      cache: "no-store",
      headers: { Authorization: "Bearer token-finance-a" },
    });
    expect(text()).toContain("01/01/2026 a 30/09/2026 · Registro");
    expect(text()).toContain("01/07/2026 a 30/09/2026 · até três meses");
    const accountTable = container.querySelector("table")!;
    expect(accountTable.textContent).toContain("Engenharia sintética");
    expect(accountTable.textContent?.replace(/\u00a0/g, " ")).toContain("-R$ 300,00");
    expect(accountTable.textContent?.replace(/\u00a0/g, " ")).toContain("-R$ 150,00");
    expect(text()).toContain("Soma algébrica das linhas consultadasR$ 1.050,00");
    expect(text()).toContain(
      "Fonte sintética de teste; classificação e NFs precisam de conferência."
    );
    expect(text()).toContain("Município sintético/PR");
    await changeField("Data inicial", "2026-02-01");
    expect(text()).not.toContain("Empresa sintética da conta A");
    expect(findButton("cards de ações")).toBeUndefined();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("clears a prior report when Omie fails and provides no fictional fallback amounts or cards", async () => {
    mocks.fetch
      .mockResolvedValueOnce(json(reportFixture()))
      .mockResolvedValueOnce(json({ error: "Omie indisponível para esta consulta" }, 503));
    await mount();
    await consult();
    expect(text()).toContain("Empresa sintética da conta A");
    await consult();
    expect(text()).toContain("Omie indisponível para esta consulta");
    expect(text()).not.toContain("Empresa sintética da conta A");
    expect(text()).not.toContain("Engenharia sintética");
    expect(text()).not.toContain("Soma algébrica");
    expect(text()).not.toContain("1.159.556");
    expect(findButton("cards de ações")).toBeUndefined();
    expect(findButton("Exportar lançamentos CSV")).toBeUndefined();
  });

  it("does not offer cards or fabricated account totals for a valid empty Omie report", async () => {
    mocks.fetch.mockResolvedValueOnce(json(reportFixture("Empresa vazia de teste", [])));
    await mount();
    await consult();
    expect(text()).toContain("0 lançamentos retornados");
    expect(text()).not.toContain("Contas da DRE");
    expect(text()).not.toContain("Soma algébrica");
    expect(findButton("cards de ações")).toBeUndefined();
  });

  it.each([200, 403])(
    "ignores the previous account's late %i response without clearing or overwriting the new report",
    async (lateStatus) => {
      const late = deferred<Response>();
      const first = reportFixture();
      const second = reportFixture("Empresa sintética exclusiva da conta B");
      mocks.fetch
        .mockResolvedValueOnce(json(first))
        .mockReturnValueOnce(late.promise)
        .mockResolvedValueOnce(json(second));
      await mount();
      await consult();
      expect(text()).toContain(first.company);
      await consult();
      mocks.user = account("finance-b");
      await mount();
      expect(text()).not.toContain(first.company);
      await consult();
      expect(text()).toContain(second.company);
      await act(async () =>
        late.resolve(
          json(lateStatus === 200 ? first : { error: "Acesso antigo revogado" }, lateStatus)
        )
      );
      expect(text()).toContain(second.company);
      expect(text()).not.toContain(first.company);
      expect(text()).not.toContain("Acesso antigo revogado");
    }
  );

  it.each([401, 403])(
    "removes report, sources and CSV after the active account's card request loses access (%i)",
    async (status) => {
      mocks.fetch
        .mockResolvedValueOnce(json(reportFixture()))
        .mockResolvedValueOnce(json({ error: "Acesso financeiro revogado" }, status));
      await mount();
      await consult();
      expect(findButton("Exportar lançamentos CSV")).toBeDefined();
      await act(async () => button("cards de ações").click());
      expect(text()).toContain("Acesso financeiro revogado");
      expect(text()).not.toContain("Empresa sintética da conta A");
      expect(text()).not.toContain("Fornecedor sintético de engenharia");
      expect(text()).not.toContain("SHA-256 da consulta");
      expect(findButton("Exportar lançamentos CSV")).toBeUndefined();
      expect(findButton("cards de ações")).toBeUndefined();
      expect(text()).not.toContain("cards salvos");
    }
  );

  it("does not report success on a POST 409 and allows the user to review the unchanged report", async () => {
    const pending = deferred<Response>();
    mocks.fetch.mockResolvedValueOnce(json(reportFixture())).mockReturnValueOnce(pending.promise);
    await mount();
    await consult();
    await act(async () => button("cards de ações").click());
    expect(text()).toContain("Salvando cards…");
    expect(text()).not.toContain("cards salvos");
    await act(async () =>
      pending.resolve(json({ error: "Chave já usada por outro conteúdo; revise a consulta" }, 409))
    );
    expect(text()).toContain("Chave já usada por outro conteúdo; revise a consulta");
    expect(text()).not.toContain("cards salvos");
    expect(text()).not.toContain("O progresso foi preservado");
    expect(text()).toContain("Empresa sintética da conta A");
    expect(button("cards de ações").disabled).toBe(false);
  });

  it("sends the evidenced suggestions and confirms success only after POST returns the saved batch", async () => {
    const report = reportFixture();
    const confirmed = savedBatch(report);
    const pending = deferred<Response>();
    mocks.fetch
      .mockResolvedValueOnce(json(report))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(json({ batch: confirmed, alreadySaved: true }));
    await mount();
    await consult();
    await act(async () => button("cards de ações").click());
    expect(text()).not.toContain("cards salvos");
    const [path, options] = mocks.fetch.mock.calls[1];
    expect(path).toBe("/api/financial/actions");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(report.suggestedActions);
    expect(JSON.parse(options.body).actions[0].evidence[0].sourceSha256).toBe(report.sourceSha256);
    await act(async () => pending.resolve(json({ batch: confirmed, alreadySaved: false })));
    expect(text()).toContain(
      `${confirmed.actions.length} cards salvos no painel de ações financeiras.`
    );
    await act(async () => button("cards de ações").click());
    expect(text()).toContain(
      "Os cards desta consulta já estão salvos. O progresso foi preservado."
    );
  });

  it("discards a pending card confirmation after logout, including when the same account signs back in", async () => {
    const report = reportFixture();
    const pending = deferred<Response>();
    mocks.fetch
      .mockResolvedValueOnce(json(report))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(json(report));
    await mount();
    await consult();
    await act(async () => button("cards de ações").click());
    mocks.user = null;
    await mount();
    await act(async () =>
      pending.resolve(json({ batch: savedBatch(report), alreadySaved: false }))
    );
    expect(text()).not.toContain(report.company);
    expect(text()).not.toContain("cards salvos");
    mocks.user = account("finance-a");
    await mount();
    await consult();
    expect(text()).toContain(report.company);
    expect(text()).not.toContain("cards salvos");
  });
});
