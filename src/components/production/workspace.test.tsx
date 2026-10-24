import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommand, CommandSchema, emptyBook } from "@/lib/production/model";
import {
  billingQueueSummary,
  type BillingQueueItem,
  type BillingQueueSnapshot,
} from "@/lib/production/billing-queue";
const state = vi.hoisted(() => ({
  user: { uid: "admin" } as { uid: string } | null,
  role: "ADMIN",
  companyId: "nextcon",
  tenantId: "",
  isUserLoading: false,
  userError: null as Error | null,
  fetch: vi.fn(),
  hash: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({
    user: state.user,
    role: state.role,
    companyId: state.companyId,
    tenantId: state.tenantId,
    isUserLoading: state.isUserLoading,
    userError: state.userError,
  }),
  useStorage: () => ({}),
}));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: state.token }));
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
function billingSnapshot(version = book.version, cycleId = "r1_initial"): BillingQueueSnapshot {
  const item: BillingQueueItem = {
    key: `r1:${cycleId}`,
    recordId: "r1",
    cycleId,
    company: "Cliente na fila privada",
    cnpj: company.cnpj,
    contract: "Contrato teste",
    service: "Entrega em conferência",
    period: "2026-10",
    competence: "2026-10",
    revision: 0,
    owner: "Gestora",
    due: "2026-10-20",
    origin: "delivery",
    status: "measurement",
    issues: [],
    nextAction: "Conferir a medição",
    delivered: true,
    recurring: false,
    obligations: { total: 0, completed: 0, waived: 0 },
    measuredCents: 0,
    invoicedCents: 0,
    balanceCents: null,
    measurementApproved: false,
    financeTitleId: "",
    linkedTitle: null,
    candidateCount: 0,
    candidates: [],
  };
  return {
    centralVersion: version,
    financeVersion: 5,
    generatedAt: "2026-10-19T12:00:00Z",
    items: [item],
    summary: billingQueueSummary([item]),
  };
}
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
  state.role = "ADMIN";
  state.companyId = "nextcon";
  state.tenantId = "";
  state.isUserLoading = false;
  state.userError = null;
  state.token.mockReset().mockResolvedValue("test-token");
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
  vi.useRealTimers();
});
describe("production workspace", () => {
  it("loads the billing handoff for the visible version and opens its exact cycle without a mutation", async () => {
    const cycles = structuredClone(book);
    cycles.records[0].cycles.push({
      ...structuredClone(cycles.records[0].cycles[0]),
      id: "billing-target",
      period: "2026-11",
    });
    state.fetch.mockResolvedValueOnce(reply({ book: cycles, companies: [company] }));
    await render();
    state.fetch.mockResolvedValueOnce(reply(billingSnapshot(book.version, "billing-target")));
    await click("Operação e faturamento");
    expect(host.textContent).toContain("Cliente na fila privada");
    const request = state.fetch.mock.calls.find(([url]) =>
      String(url).includes("/billing-queue?")
    )!;
    expect(request[0]).toBe(`/api/production/billing-queue?expectedVersion=${book.version}`);
    expect(request[1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      headers: { Authorization: "Bearer test-token" },
    });
    await click("Conferir ciclo");
    const select = Array.from(host.querySelectorAll("select")).find((element) =>
      Array.from(element.options).some((option) => option.value === "billing-target")
    )!;
    expect(select.value).toBe("billing-target");
    expect(host.querySelector('[aria-label="Operação e faturamento"]')).toBeNull();
    expect(state.fetch.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
  });
  it.each([401, 403, "non-json"] as const)(
    "clears the Central when the billing query denies access: %s",
    async (denial) => {
      await render();
      await selectRecord();
      state.fetch.mockResolvedValueOnce(
        denial === "non-json"
          ? {
              ok: false,
              status: 403,
              json: async () => {
                throw new Error("HTML denial");
              },
            }
          : reply({ error: "Acesso à fila revogado" }, denial)
      );
      await click("Operação e faturamento");
      expect(host.textContent).not.toContain("Contrato teste");
      expect(host.textContent).not.toContain(company.name);
      expect(host.textContent).not.toContain("Cliente na fila privada");
      expect(host.textContent).toContain(
        denial === "non-json" ? "Verifique sua sessão" : "Acesso à fila revogado"
      );
    }
  );
  it("invalidates the billing query when refreshing the Central yields a new version", async () => {
    await render();
    state.fetch.mockResolvedValueOnce(reply(billingSnapshot()));
    await click("Operação e faturamento");
    expect(host.textContent).toContain("Cliente na fila privada");
    const updated = { ...structuredClone(book), version: book.version + 1 };
    state.fetch
      .mockResolvedValueOnce(reply({ book: updated, companies: [company] }))
      .mockImplementationOnce(() => new Promise(() => {}));
    await click("Atualizar");
    expect(host.textContent).not.toContain("Cliente na fila privada");
    expect(host.textContent).toContain("Consultando a Central e o ERP");
    expect(state.fetch.mock.lastCall?.[0]).toBe(
      `/api/production/billing-queue?expectedVersion=${updated.version}`
    );
  });
  it.each(["logout", "new-user", "role", "companyId", "tenantId"] as const)(
    "ignores a late billing response after %s",
    async (change) => {
      await render();
      let finish!: (response: unknown) => void;
      state.fetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      await click("Operação e faturamento");
      const signal = state.fetch.mock.lastCall?.[1].signal as AbortSignal;
      if (change === "logout") state.user = null;
      else if (change === "new-user") state.user = { uid: "next-admin" };
      else state[change] = "changed";
      state.fetch.mockResolvedValueOnce(
        reply({ book: { ...emptyBook(), version: book.version }, companies: [] })
      );
      await render();
      expect(signal.aborted).toBe(true);
      await act(async () => finish(reply(billingSnapshot())));
      expect(host.textContent).not.toContain("Cliente na fila privada");
      expect(host.textContent).not.toContain("Contrato teste");
      if (change === "logout") expect(host.textContent).toContain("Entre no NAI");
    }
  );
  it.each(["role", "companyId", "tenantId"] as const)(
    "discards loaded financial data immediately when %s changes",
    async (field) => {
      await render();
      await selectRecord();
      expect(host.textContent).toContain(company.name);
      state.fetch.mockResolvedValueOnce(reply(billingSnapshot()));
      await click("Operação e faturamento");
      expect(host.textContent).toContain("Cliente na fila privada");
      state.fetch.mockImplementationOnce(() => new Promise(() => {}));
      state[field] = "changed";
      await render();
      expect(host.textContent).not.toContain(company.name);
      expect(host.textContent).not.toContain("Contrato teste");
      expect(host.textContent).not.toContain("Cliente na fila privada");
    }
  );
  it.each(["loading", "error"])(
    "hides existing data while session validation is %s",
    async (condition) => {
      await render();
      await selectRecord();
      const calls = state.fetch.mock.calls.length;
      if (condition === "loading") state.isUserLoading = true;
      else state.userError = new Error("Profile unavailable");
      await render();
      expect(host.textContent).not.toContain(company.name);
      expect(state.fetch).toHaveBeenCalledTimes(calls);
    }
  );

  it("keeps an alphanumeric customer visible when searching its formatted CNPJ", async () => {
    const alpha = structuredClone(book);
    alpha.records[0].cnpj = "12ABC34501DE35";
    state.fetch.mockResolvedValue(reply({ book: alpha, companies: [company] }));
    await render();
    const label = Array.from(host.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("Buscar cliente, CNPJ ou contrato")
    )!;
    const input = label.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "12.ABC.345/01DE-35"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector('option[value="r1"]')).not.toBeNull();
  });

  it("clears loaded contracts when the server revokes financial access", async () => {
    await render();
    await selectRecord();
    expect(host.textContent).toContain("Contrato teste");
    state.fetch.mockResolvedValueOnce(reply({ error: "Acesso financeiro revogado" }, 403));
    await click("Atualizar");
    expect(host.textContent).toContain("Acesso financeiro revogado");
    expect(host.textContent).not.toContain("Contrato teste");
    expect(host.textContent).not.toContain(company.name);
  });
  it.each(["finance", "assistant", "source", "extract"])(
    "clears every protected view after %s authorization fails",
    async (endpoint) => {
      await render();
      await selectRecord();
      if (endpoint === "assistant") await click("3 agentes IA");
      if (["source", "extract"].includes(endpoint)) {
        await click("Novo registro");
        state.hash.mockResolvedValue("a".repeat(64));
        const file = new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" });
        state.fetch.mockResolvedValueOnce(
          endpoint === "source"
            ? reply({ error: "Sessão revogada" }, 403)
            : reply({ source: { sha256: "a".repeat(64), sizeBytes: file.size } })
        );
        const input = host.querySelector('input[type="file"]')!;
        Object.defineProperty(input, "files", { value: [file] });
        await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
      }
      if (endpoint !== "source") {
        state.fetch.mockResolvedValueOnce(reply({ error: "Sessão revogada" }, 403));
        await click(
          endpoint === "finance"
            ? "Consultar contratos e títulos"
            : endpoint === "assistant"
              ? "Consultar NAI Comercial"
              : "Identificar cliente e dados com IA"
        );
      }
      expect(host.textContent).toContain("Sessão revogada");
      expect(host.textContent).not.toContain("Contrato teste");
      expect(host.textContent).not.toContain(company.name);
      expect(host.querySelector('input[type="file"]')).toBeNull();
      state.fetch.mockResolvedValueOnce(reply({ book, companies: [company] }));
      await click("Atualizar");
      expect(host.textContent).toContain("Contrato teste");
    }
  );
  it("clears private data even when a denial is not JSON", async () => {
    await render();
    await selectRecord();
    state.fetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => {
        throw new Error("HTML denial");
      },
    });
    await click("Consultar contratos e títulos");
    expect(host.textContent).not.toContain(company.name);
    expect(host.textContent).toContain("Verifique sua sessão");
  });
  it("refreshes priorities across midnight in Brasília without user action", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T02:59:59.500Z"));
    const datedBook = structuredClone(book);
    datedBook.records[0].commercial[0].due = "2026-10-19";
    state.fetch.mockResolvedValue(reply({ book: datedBook, companies: [company] }));
    await render();
    expect(host.textContent).toContain("Vence hoje");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(host.textContent).not.toContain("Vence hoje");
    expect(host.textContent).toContain("Prazo vencido");
  });
  it("never carries edited billing values into a different cycle", async () => {
    const cycles = structuredClone(book);
    cycles.records[0].cycles[0].measuredCents = 10000;
    cycles.records[0].cycles.push({
      ...structuredClone(cycles.records[0].cycles[0]),
      id: "second",
      period: "2026-11",
      measuredCents: 20000,
    });
    state.fetch.mockResolvedValue(reply({ book: cycles, companies: [company] }));
    await render();
    await selectRecord();
    const select = Array.from(host.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.value === "second")
    )!;
    const edited = host.querySelector<HTMLInputElement>('input[name="measuredCents"]')!;
    expect(edited.value).toBe("200");
    edited.value = "999";
    await act(async () => {
      select.value = "r1_initial";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector<HTMLInputElement>('input[name="measuredCents"]')!.value).toBe("100");
  });
  it("does not send a mutation if its credential arrives after logout", async () => {
    await render();
    await selectRecord();
    let finish!: (token: string) => void;
    state.token.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const form = Array.from(host.querySelectorAll("form")).find((f) =>
      f.textContent?.includes("Salvar card")
    )!;
    (form.elements.namedItem("reason") as HTMLTextAreaElement).value = "Conferir responsável";
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    state.user = null;
    await render();
    await act(async () => {
      finish("old-token");
    });
    expect(state.fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(
      0
    );
    expect(host.textContent).toContain("Entre no NAI");
  });
  it("does not overwrite a refreshed central with an older initial response", async () => {
    let finish!: (value: unknown) => void;
    state.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const updated = structuredClone(book);
    updated.records[0].name = "Versão confirmada após atualização";
    state.fetch.mockResolvedValueOnce(reply({ book: updated, companies: [company] }));
    await click("Atualizar");
    await act(async () => {
      finish(reply({ book, companies: [company] }));
    });
    expect(host.textContent).toContain("Versão confirmada após atualização");
    expect(
      Array.from(host.querySelectorAll("option")).find((o) => o.value === "r1")?.textContent
    ).toContain("Versão confirmada após atualização");
  });
  it("shows ERP divergence and clears stale results when refreshing fails", async () => {
    await render();
    await selectRecord();
    state.fetch.mockResolvedValueOnce(
      reply({
        version: 4,
        contracts: [],
        titles: [],
        cycles: [
          {
            cycleId: "r1_initial",
            titleId: "t1",
            status: "pending",
            issues: ["1 baixa sem conciliação bancária"],
            outstandingCents: 0,
            receipts: { receivedCents: 9000, adjustmentCents: 1000 },
          },
        ],
      })
    );
    await click("Consultar contratos e títulos");
    expect(host.textContent).toContain("Recebimento ou conciliação pendente");
    expect(host.textContent).toContain("1 baixa sem conciliação bancária");
    state.fetch.mockResolvedValueOnce(reply({ error: "ERP indisponível" }, 503));
    await click("Consultar contratos e títulos");
    expect(host.textContent).not.toContain("Conferência com o ERP · versão 4");
    expect(host.textContent).toContain("ERP indisponível");
  });
  it("abre o procedimento completo dentro da central sem alterar cards", async () => {
    await render();
    const calls = state.fetch.mock.calls.length;
    await click("Procedimento completo");
    expect(host.textContent).toContain("Procedimento completo do contrato ao recebimento");
    expect(host.querySelectorAll('details[id^="pop-"]')).toHaveLength(9);
    expect(state.fetch).toHaveBeenCalledTimes(calls);
    await click("Esteira de produção");
    await selectRecord();
    expect(host.textContent).toContain("0/9 cards concluídos");
    state.user = null;
    await render();
    expect(host.textContent).not.toContain("Procedimento completo");
  });
  it("renders nine work instructions and three agent entry points", async () => {
    await render();
    await click("Instruções de trabalho");
    expect(host.textContent).toContain("versão 1.2");
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
  it("does not upload a file after the source form is dismissed during hashing", async () => {
    let finish!: (hash: string) => void;
    state.hash.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await click("Novo registro");
    const input = host.querySelector('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" })],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("Novo registro");
    await act(async () => {
      finish("a".repeat(64));
    });
    expect(state.fetch.mock.calls.some(([url]) => url === "/api/production/source")).toBe(false);
  });
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

describe("addendum consolidation", () => {
  it.each([false, true])(
    "preserves all existing obligations after partial extraction (new duty: %s)",
    async (hasNewDuty) => {
      const duty = {
        id: "pgr",
        title: "Elaborar PGR",
        serviceType: "PGR" as const,
        owner: "Engenharia",
        due: "2026-10-30",
        trigger: "",
        deadlineRule: "Prazo contratado",
        sourceReference: "Contrato, cláusula 4",
        sourceExcerpt: "Elaborar o PGR da unidade.",
      };
      const currentBook = structuredClone(book);
      currentBook.records[0].revisions[0].terms.obligations = [duty];
      state.fetch.mockResolvedValue(reply({ book: currentBook, companies: [company] }));
      state.hash.mockResolvedValue("a".repeat(64));
      await render();
      await selectRecord();
      await click("Documentos e aditivos");
      const file = new File(["%PDF-1.7"], "aditivo.pdf", { type: "application/pdf" });
      const source = {
        sha256: "a".repeat(64),
        sizeBytes: file.size,
        storagePath: `internos_nextcon/contract-sources/${"a".repeat(64)}`,
        generation: "1",
      };
      const form = Array.from(host.querySelectorAll("form")).find((f) =>
        f.querySelector('input[type="file"]')
      )!;
      const kind = Array.from(form.querySelectorAll("select")).find((s) =>
        Array.from(s.options).some((o) => o.value === "aditivo")
      )!;
      await act(async () => {
        kind.value = "aditivo";
        kind.dispatchEvent(new Event("change", { bubbles: true }));
      });
      state.fetch.mockResolvedValueOnce(reply({ source }));
      const input = form.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [file] });
      await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      state.fetch.mockResolvedValueOnce(
        reply({
          extraction: {
            clientName: null,
            cnpj: null,
            scope: null,
            units: null,
            deliverables: null,
            valueCents: 20000,
            startsOn: null,
            endsOn: null,
            paymentTerms: null,
            recurring: null,
            obligations: hasNewDuty ? [{ ...duty, title: "Realizar ASO", serviceType: "ASO" }] : [],
            references: [],
            pending: [],
          },
        })
      );
      await click("Identificar cliente e dados com IA");
      expect(form.querySelector<HTMLInputElement>('[name="obligation.pgr.title"]')?.value).toBe(
        duty.title
      );
      expect(form.querySelectorAll('[name="obligationId"]')).toHaveLength(1);
      expect(form.textContent).toContain("As obrigações vigentes foram mantidas");
      expect(form.textContent?.includes("Sugestões do aditivo para conferência")).toBe(hasNewDuty);
      (form.elements.namedItem("evidence") as HTMLTextAreaElement).value =
        "Aditivo financeiro conferido; serviços mantidos";
      state.fetch.mockResolvedValueOnce(reply(currentBook));
      await act(async () => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      const payload = JSON.parse(state.fetch.mock.calls.at(-1)![1].body);
      expect(payload).toMatchObject({
        action: "amend",
        terms: { obligations: [duty], valueCents: 20000 },
      });
    }
  );
});
