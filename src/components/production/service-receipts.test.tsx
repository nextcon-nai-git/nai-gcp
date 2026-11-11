import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ServiceReceiptItem,
  ServiceReceiptsSnapshot,
} from "@/lib/production/service-receipts";
import { ServiceReceipts, type ServiceReceiptCommand } from "./service-receipts";

const session = vi.hoisted(() => ({
  user: { uid: "admin" } as { uid: string } | null,
  fetch: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({
    user: session.user,
    role: "ADMIN",
    companyId: "nextcon",
    tenantId: "",
    isUserLoading: false,
    userError: null,
  }),
}));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: session.token }));
vi.mock("@/lib/contracts/integration", () => ({ hashContractFile: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import ProductionWorkspace from "./workspace";

let host: HTMLDivElement, root: Root;
const load = vi.fn<(signal: AbortSignal, version: number) => Promise<ServiceReceiptsSnapshot>>();
const save = vi.fn<(signal: AbortSignal, command: ServiceReceiptCommand) => Promise<unknown>>();
const open = vi.fn();
function item(overrides: Partial<ServiceReceiptItem> = {}): ServiceReceiptItem {
  return {
    key: "r1/c1/task1",
    recordId: "r1",
    cycleId: "c1",
    taskId: "task1",
    companyName: "Saúde Exemplo",
    cnpj: "11222333000181",
    contractName: "Contrato A",
    financeContractId: "f1",
    cycleName: "Entrega técnica",
    period: "2026-11",
    serviceType: "PGR",
    title: "Revisar PGR",
    owner: "José",
    due: "2026-11-20",
    operationalStatus: "done",
    documentationStatus: "reviewed",
    evidence: "Tarefa conferida",
    sourceReference: "Cláusula 4",
    sourceFingerprint: "a".repeat(64),
    deliveryEvidence: "Protocolo do ciclo",
    revision: 0,
    legacyCycleFinance: true,
    issues: [],
    financialStatus: "unallocated",
    billedCents: null,
    principalSettledCents: null,
    receivedCents: null,
    adjustmentCents: null,
    cashCents: null,
    reconciledCashCents: null,
    outstandingCents: null,
    costCents: null,
    unallocatedReceiptCount: 0,
    unreconciledCount: 0,
    billings: [],
    services: [],
    ...overrides,
  };
}
function snapshot(version = 3, items = [item()]): ServiceReceiptsSnapshot {
  return {
    centralVersion: version,
    financeVersion: 9,
    generatedAt: "2026-11-11T12:00:00Z",
    items,
    titles: [
      {
        id: "t1",
        contractId: "f1",
        description: "Título novembro",
        party: "Saúde Exemplo",
        competence: "2026-11",
        dueDate: "2026-11-30",
        amountCents: 20000,
        availableCents: 15000,
        externalReference: "NF 123",
      },
      {
        id: "other-title",
        contractId: "other-contract",
        description: "Outro cliente restrito",
        party: "Outro",
        competence: "2026-11",
        dueDate: "2026-11-30",
        amountCents: 10000,
        availableCents: 10000,
        externalReference: "",
      },
    ],
    settlements: [
      {
        id: "s1",
        titleId: "t1",
        date: "2026-11-11",
        reconciled: false,
        principalCents: 10000,
        interestCents: 200,
        fineCents: 100,
        discountCents: 500,
        withholdingCents: 1000,
        available: {
          principalCents: 10000,
          interestCents: 200,
          fineCents: 100,
          discountCents: 500,
          withholdingCents: 1000,
        },
      },
    ],
    services: [
      {
        id: "erp1",
        contractId: "f1",
        date: "2026-11-10",
        description: "Produção de PGR",
        supplier: "Engenharia",
        city: "Curitiba/PR",
        quantity: 2,
        costCents: 8000,
        billingMode: "included",
        linked: false,
      },
    ],
    issues: [],
    recovery: { billings: [], services: [] },
    summary: {
      count: items.length,
      unallocatedCount: items.length,
      reviewCount: 0,
      billedCents: 0,
      receivedCents: 0,
      outstandingCents: 0,
      costCents: 0,
      withoutTasksCount: 0,
    },
  };
}
function allocated(): ServiceReceiptItem {
  return item({
    financialStatus: "open",
    billedCents: 10000,
    principalSettledCents: 0,
    receivedCents: 0,
    adjustmentCents: 0,
    cashCents: 0,
    reconciledCashCents: 0,
    outstandingCents: 10000,
    billings: [
      {
        id: "allocation1",
        titleId: "t1",
        description: "Título novembro",
        amountCents: 10000,
        outstandingCents: 10000,
        evidence: "Cláusula de medição",
        voided: false,
        receipts: [],
        issues: [],
      },
    ],
  });
}
async function render(version = 3) {
  await act(async () =>
    root.render(
      <ServiceReceipts
        centralVersion={version}
        loadSnapshot={load}
        saveCommand={save}
        onOpen={open}
      />
    )
  );
}
async function click(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (button) => button.textContent === label
  );
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}
function form(label: string) {
  const result = host.querySelector<HTMLFormElement>(`form[aria-label="${label}"]`);
  expect(result, label).toBeTruthy();
  return result!;
}
function fill(target: HTMLFormElement, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values))
    (target.elements.namedItem(name) as HTMLInputElement).value = value;
}
async function select(input: HTMLSelectElement, value: string) {
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit(target: HTMLFormElement, reviewed = true) {
  (target.elements.namedItem("reviewed") as HTMLInputElement).checked = reviewed;
  await act(async () =>
    target.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  load.mockReset().mockResolvedValue(snapshot());
  save.mockReset().mockResolvedValue({ book: { version: 10 } });
  open.mockReset();
  session.user = { uid: "admin" };
  session.fetch.mockReset();
  session.token.mockReset().mockResolvedValue("test-token");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("services and receipt distribution", () => {
  it("corrects orphaned receipt, title and production associations without offering new distributions", async () => {
    const initial = snapshot(3, []);
    const origin = {
      recordId: "r1",
      cycleId: "removed-cycle",
      taskId: "removed-task",
      companyName: "Cliente da associação",
      contractName: "Contrato anterior",
      cycleName: "Ciclo replanejado",
      period: "2026-11",
    };
    initial.recovery = {
      billings: [
        {
          ...allocated().billings[0],
          ...origin,
          issues: ["A tarefa de origem não está disponível."],
          receipts: [
            {
              id: "orphan-receipt",
              settlementId: "s1",
              date: "2026-11-11",
              evidence: "Baixa anteriormente distribuída",
              voided: false,
              reversed: false,
              reconciled: false,
              principalCents: 5000,
              interestCents: 0,
              fineCents: 0,
              discountCents: 0,
              withholdingCents: 500,
            },
          ],
        },
      ],
      services: [
        {
          ...origin,
          serviceId: "orphan-production",
          description: "Produção antes do replanejamento",
          evidence: "Vínculo previamente conferido",
          issues: ["Ciclo de origem indisponível."],
        },
      ],
    };
    const afterReceipt = structuredClone(initial);
    afterReceipt.financeVersion = 10;
    afterReceipt.recovery.billings[0].receipts[0].voided = true;
    const afterTitle = structuredClone(afterReceipt);
    afterTitle.financeVersion = 11;
    afterTitle.recovery.billings = [];
    const afterUnlink = structuredClone(afterTitle);
    afterUnlink.financeVersion = 12;
    afterUnlink.recovery.services = [];
    load
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(afterReceipt)
      .mockResolvedValueOnce(afterTitle)
      .mockResolvedValueOnce(afterUnlink);
    await render();
    const recovery = host.querySelector(
      'section[aria-label="Associações que precisam de correção"]'
    )!;
    expect(recovery.textContent).toContain("Cliente da associação");
    expect(recovery.textContent).toContain("removed-cycle");
    expect(recovery.textContent).toContain("removed-task");
    expect(recovery.querySelector('form[aria-label="Anular distribuição do título"]')).toBeNull();
    expect(recovery.textContent).not.toContain("Salvar distribuição");
    expect(host.querySelectorAll('article[aria-label^="Serviço"]')).toHaveLength(0);
    const receiptForm = form("Anular distribuição da baixa");
    fill(receiptForm, { reason: "Corrigir tarefa removida" });
    await submit(receiptForm);
    expect(save.mock.calls[0][1]).toMatchObject({
      action: "voidServiceReceiptAllocation",
      id: "orphan-receipt",
      expectedVersion: 9,
      expectedCentralVersion: 3,
      reviewed: true,
      reason: "Corrigir tarefa removida",
    });
    expect(host.textContent).toContain("Distribuição da baixa anulada — histórico preservado");
    const titleForm = form("Anular distribuição do título");
    fill(titleForm, { reason: "Corrigir associação sem tarefa" });
    await submit(titleForm);
    expect(save.mock.calls[1][1]).toMatchObject({
      action: "voidServiceTitleAllocation",
      id: "allocation1",
      expectedVersion: 10,
      expectedCentralVersion: 3,
      reviewed: true,
    });
    const productionForm = form("Retirar vínculo de produção");
    fill(productionForm, { reason: "Retirar vínculo do ciclo removido" });
    await submit(productionForm);
    expect(save.mock.calls[2][1]).toMatchObject({
      action: "unlinkProductionService",
      serviceId: "orphan-production",
      expectedVersion: 11,
      expectedCentralVersion: 3,
      reviewed: true,
    });
    expect(
      host.querySelector('section[aria-label="Associações que precisam de correção"]')
    ).toBeNull();
  });
  it("keeps unknown amounts distinct from zero and separates the task from cycle delivery evidence", async () => {
    await render();
    const card = host.querySelector('article[aria-label="Serviço Revisar PGR de Saúde Exemplo"]')!;
    expect(card.textContent).toContain("Sem distribuição");
    expect(card.textContent).toContain("Entrega do ciclo: Protocolo do ciclo");
    expect(card.textContent).toContain("Revisão e evidência registradas");
    expect(card.textContent).toContain("registros financeiros anteriores");
    expect(card.querySelector("table")).toBeNull();
    expect(host.textContent).toContain("Central v3 · ERP v9");
    await click("Abrir ciclo na Central");
    expect(open).toHaveBeenCalledExactlyOnceWith("r1", "c1");
  });
  it("offers a partially distributed title only to services of the same record and cycle", async () => {
    const sameCycle = allocated();
    sameCycle.key = "r1/c1/task2";
    sameCycle.taskId = "task2";
    const otherCycle = allocated();
    otherCycle.key = "r1/c2/task3";
    otherCycle.cycleId = "c2";
    otherCycle.taskId = "task3";
    otherCycle.billings[0].id = "allocation-other-cycle";
    otherCycle.billings[0].titleId = "title-other-cycle";
    const data = snapshot(3, [item(), sameCycle, otherCycle]);
    data.titles.push(
      { ...data.titles[0], id: "title-other-cycle", description: "Título de outro ciclo" },
      { ...data.titles[0], id: "title-recovery", description: "Título com origem indisponível" }
    );
    data.recovery.billings.push({
      ...otherCycle.billings[0],
      id: "allocation-recovery",
      titleId: "title-recovery",
      recordId: "r2",
      cycleId: "c1",
      taskId: "removed-task",
      companyName: "Cliente da associação",
      contractName: "Contrato anterior",
      cycleName: "Origem indisponível",
      period: "2026-11",
    });
    load.mockResolvedValue(data);
    await render();
    const target = form("Salvar distribuição do título");
    const options = Array.from(target.querySelector("select")!.options).map(
      (option) => option.value
    );
    expect(options).toContain("t1");
    expect(options).not.toContain("title-other-cycle");
    expect(options).not.toContain("title-recovery");
    expect(host.textContent).toContain("Distribua cada título entre serviços do mesmo ciclo.");
  });
  it("requires reviewed explicit title allocation, validates the available amount and preserves both versions", async () => {
    await render();
    const target = form("Salvar distribuição do título");
    expect(target.textContent).not.toContain("Outro cliente restrito");
    await select(target.querySelector("select")!, "t1");
    fill(target, {
      amountCents: "151,00",
      evidence: "Memória de distribuição",
      reason: "Conferência do contrato",
    });
    await submit(target, false);
    expect(save).not.toHaveBeenCalled();
    expect(target.textContent).toContain("Confirme a conferência");
    await submit(target);
    expect(save).not.toHaveBeenCalled();
    expect(target.textContent).toContain("excede o saldo disponível");
    fill(target, { amountCents: "125,50" });
    await submit(target);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][1]).toMatchObject({
      action: "allocateServiceTitle",
      recordId: "r1",
      cycleId: "c1",
      taskId: "task1",
      titleId: "t1",
      amountCents: 12550,
      evidence: "Memória de distribuição",
      reason: "Conferência do contrato",
      reviewed: true,
      expectedVersion: 9,
      expectedCentralVersion: 3,
      sourceFingerprint: "a".repeat(64),
    });
    expect(save.mock.calls[0][1].requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("allocates only entered components from an existing settlement and enforces available balances", async () => {
    load.mockResolvedValue(snapshot(3, [allocated()]));
    await render();
    const target = form("Salvar distribuição da baixa");
    await select(target.querySelector("select")!, "s1");
    expect((target.elements.namedItem("principalCents") as HTMLInputElement).value).toBe("");
    fill(target, {
      principalCents: "80",
      interestCents: "2,01",
      fineCents: "1",
      discountCents: "5",
      withholdingCents: "10",
      evidence: "Baixa conferida no ERP",
      reason: "Distribuir pagamento",
    });
    await submit(target);
    expect(save).not.toHaveBeenCalled();
    expect(target.textContent).toContain("Juros excede o saldo disponível");
    fill(target, { interestCents: "2" });
    await submit(target);
    expect(save.mock.calls[0][1]).toMatchObject({
      action: "allocateServiceReceipt",
      billingAllocationId: "allocation1",
      settlementId: "s1",
      principalCents: 8000,
      interestCents: 200,
      fineCents: 100,
      discountCents: 500,
      withholdingCents: 1000,
      reviewed: true,
    });
  });
  it("links production costs without allocating the revenue of an included service", async () => {
    await render();
    const target = form("Salvar vínculo de produção");
    await select(target.querySelector("select")!, "erp1");
    fill(target, {
      evidence: "Produção do documento conferida",
      reason: "Identificar custo declarado",
    });
    await submit(target);
    expect(save.mock.calls[0][1]).toMatchObject({
      action: "linkProductionService",
      serviceId: "erp1",
      recordId: "r1",
      cycleId: "c1",
      taskId: "task1",
      sourceFingerprint: "a".repeat(64),
    });
    expect(save.mock.calls[0][1]).not.toHaveProperty("amountCents");
    expect(save).toHaveBeenCalledOnce();
  });
  it("requires receipt allocations to be annulled before their title allocation and retains annulled history", async () => {
    const service = allocated();
    service.billings[0].receipts.push({
      id: "receipt1",
      settlementId: "s1",
      date: "2026-11-11",
      principalCents: 5000,
      interestCents: 0,
      fineCents: 0,
      discountCents: 0,
      withholdingCents: 500,
      evidence: "Distribuição documentada",
      reversed: false,
      voided: false,
      reconciled: false,
    });
    load.mockResolvedValue(snapshot(3, [service]));
    await render();
    expect(
      host.querySelector('form[aria-label="Confirmar anulação da distribuição do título"]')
    ).toBeNull();
    const target = form("Confirmar anulação da distribuição da baixa");
    fill(target, { reason: "Corrigir associação do recebimento" });
    service.billings[0].receipts[0].voided = true;
    load.mockResolvedValue(snapshot(3, [service]));
    await submit(target);
    expect(save.mock.calls[0][1]).toMatchObject({
      action: "voidServiceReceiptAllocation",
      id: "receipt1",
      reason: "Corrigir associação do recebimento",
    });
    expect(host.textContent).toContain("Distribuição da baixa anulada");
    expect(
      host.querySelector('form[aria-label="Confirmar anulação da distribuição do título"]')
    ).not.toBeNull();
  });
  it("invalidates the snapshot on ambiguous save and repeats the identical command", async () => {
    save.mockRejectedValueOnce(new Error("Resposta interrompida"));
    await render();
    const target = form("Salvar distribuição do título");
    await select(target.querySelector("select")!, "t1");
    fill(target, {
      amountCents: "100",
      evidence: "Conferência assinada",
      reason: "Distribuir título",
    });
    await submit(target);
    const first = save.mock.calls[0][1];
    expect(host.textContent).not.toContain("Saúde Exemplo");
    expect(host.textContent).toContain("solicitação foi preservada");
    await click("Repetir solicitação preservada");
    expect(save.mock.calls[1][1]).toEqual(first);
    expect(host.textContent).toContain("Alteração salva e confirmada");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("removes stale values after refresh failure and rejects late snapshots for older Central versions", async () => {
    let finish!: (snapshot: ServiceReceiptsSnapshot) => void;
    load
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce(snapshot(4, [item({ companyName: "Versão nova" })]));
    await render();
    await click("Atualizar serviços");
    const oldSignal = load.mock.calls[1][0];
    await render(4);
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finish(snapshot(3, [item({ companyName: "Resposta antiga" })])));
    expect(host.textContent).toContain("Versão nova");
    expect(host.textContent).not.toContain("Resposta antiga");
    load.mockRejectedValueOnce(new Error("ERP indisponível"));
    await click("Atualizar serviços");
    expect(host.textContent).not.toContain("Versão nova");
    expect(host.textContent).toContain("ERP indisponível");
  });
  it("filters financial status and accent-insensitive searches without losing the exact service identity", async () => {
    load.mockResolvedValue(
      snapshot(3, [
        item(),
        item({
          key: "r2/c2/task2",
          recordId: "r2",
          cycleId: "c2",
          taskId: "task2",
          companyName: "Clínica São José",
          cnpj: "12ABC34501DE35",
          financialStatus: "review",
        }),
      ])
    );
    await render();
    const selectStatus = Array.from(host.querySelectorAll("label"))
      .find((label) => label.textContent?.startsWith("Filtrar situação financeira"))!
      .querySelector("select")!;
    await select(selectStatus, "review");
    const input = Array.from(host.querySelectorAll("label"))
      .find((label) => label.textContent?.startsWith("Buscar serviços"))!
      .querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "clinica sao"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelectorAll('article[aria-label^="Serviço"]')).toHaveLength(1);
    await click("Abrir ciclo na Central");
    expect(open).toHaveBeenCalledExactlyOnceWith("r2", "c2");
  });
});

describe("service receipt integration in the existing Central", () => {
  const central = { version: 3, records: [], audit: [] };
  const reply = (data: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => data,
  });
  it.each([401, 403])("clears private service data when the server returns %s", async (status) => {
    session.fetch
      .mockResolvedValueOnce(reply({ book: central, companies: [] }))
      .mockResolvedValueOnce(reply(snapshot()))
      .mockResolvedValueOnce(reply({ error: "Acesso revogado" }, status));
    vi.stubGlobal("fetch", session.fetch);
    await act(async () => root.render(<ProductionWorkspace />));
    await click("Serviços e recebimentos");
    expect(session.fetch.mock.calls[1][0]).toBe(
      "/api/production/service-receipts?expectedVersion=3"
    );
    expect(session.fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer test-token");
    expect(host.textContent).toContain("Saúde Exemplo");
    await click("Atualizar serviços");
    expect(host.textContent).not.toContain("Saúde Exemplo");
    expect(host.textContent).toContain("Acesso revogado");
  });
  it("aborts a service query on logout and never restores its late private response", async () => {
    let finish!: (reply: unknown) => void;
    session.fetch
      .mockResolvedValueOnce(reply({ book: central, companies: [] }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    vi.stubGlobal("fetch", session.fetch);
    await act(async () => root.render(<ProductionWorkspace />));
    await click("Serviços e recebimentos");
    const signal = session.fetch.mock.calls[1][1].signal as AbortSignal;
    session.user = null;
    await act(async () => root.render(<ProductionWorkspace />));
    expect(signal.aborted).toBe(true);
    await act(async () => finish(reply(snapshot())));
    expect(host.textContent).not.toContain("Saúde Exemplo");
    expect(host.textContent).toContain("Entre no NAI");
  });
});
