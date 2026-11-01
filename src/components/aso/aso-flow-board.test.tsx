import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AsoFlowCard, AsoFlowRow } from "@/lib/aso-flow";

const session = vi.hoisted(() => ({
  user: { uid: "operator-a", getIdToken: async () => "test-token" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
}));
const fileRows = vi.hoisted(() => ({ rows: [] as AsoFlowRow[] }));
vi.mock("@/firebase", () => ({ useUser: () => session }));
vi.mock("@/lib/aso-flow-import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/aso-flow-import")>()),
  readAsoFlowFile: async () => fileRows.rows,
}));
vi.mock("@/components/clients/avp-periodic-map", () => ({
  AvpPeriodicMap: ({ people }: { people: Array<{ id: string; progress: string }> }) => (
    <div data-testid="flow-map">
      {people.map((person) => (
        <span key={person.id} data-progress={person.progress}>
          {person.id}
        </span>
      ))}
    </div>
  ),
}));
import AsoFlowBoard, { asoFlowMapPeople } from "./aso-flow-board";

const capabilities = {
  socGeneration: false,
  socHref: "https://sistema.soc.com.br/WebSoc/",
  emailSend: false,
  emailMonitoring: false,
  socPdfReception: false,
};
const clinic = {
  id: "clinic-test",
  name: "Clínica de teste",
  email: "clinic@example.invalid",
  companyIds: ["company-test"],
};
const makeCard = (index = 1): AsoFlowCard => ({
  id: index.toString(16).padStart(64, "0"),
  version: 1,
  companyId: "company-test",
  companyName: "Empresa de teste",
  cnpj: "00000000000000",
  employeeId: `person-${index}`,
  employeeName: `Pessoa de teste ${index}`,
  city: "Curitiba",
  state: "PR",
  unit: "Unidade teste",
  examType: "periodico",
  cycle: "2026-11",
  roleTitle: "Cargo",
  department: "Setor",
  status: "pending",
  sourceName: "teste.csv",
  sourceRow: index + 1,
  clientEmail: "client@example.invalid",
  events: [],
  createdAt: "2026-11-01T12:00:00Z",
  createdBy: "operator-a",
  updatedAt: "2026-11-01T12:00:00Z",
  updatedBy: "operator-a",
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const list = (cards: AsoFlowCard[]) => ({
  cards,
  clinics: [clinic],
  nextCursor: null,
  capabilities,
});
const makeCandidate = (index = 1) => ({
  id: (index + 10).toString(16).repeat(64),
  fileName: `Retorno_${index}.pdf`,
  from: "clinic@example.invalid",
  subject: `Retorno de teste ${index}`,
  receivedAt: "2026-11-01T12:00:00Z",
});
const mailbox = (...candidates: ReturnType<typeof makeCandidate>[]) => ({
  status: {
    configured: true,
    monitoringConfigured: true,
    mailbox: "mailbox@example.invalid",
  },
  candidates,
  nextCursor: null,
  truncated: false,
});
const receivedCard = (): AsoFlowCard => ({
  ...makeCard(),
  version: 2,
  status: "received",
  aso: {
    hash: "d".repeat(64),
    fileName: "Retorno_1.pdf",
    size: 100,
    source: "email",
    reference: "Gmail message-1 / anexo part-1",
    receivedAt: "2026-11-01T12:00:00Z",
    receivedBy: "operator-a",
    examDate: "2026-11-01",
  },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const isDirectory = (url: unknown) => String(url).includes("/companies");
const directory = () =>
  json({
    companies: [{ id: "company-test", name: "Empresa de teste", active: true }],
    requiresSelection: false,
  });
let host: HTMLDivElement, root: Root;
const render = async () => {
  await act(async () => root.render(<AsoFlowBoard />));
};
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === text
  )!;
const click = async (text: string) => {
  expect(button(text), text).toBeTruthy();
  await act(async () => button(text).click());
};
function inputValue(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
async function openReturns() {
  await render();
  await click("Pessoa de teste 1");
  await click("Retornos por e-mail");
}
async function selectReturn(index = 0) {
  const radio = document.querySelectorAll<HTMLInputElement>('[name="aso-candidate"]')[index];
  await act(async () => radio.click());
}
async function confirmReturn(examDate = "2026-11-01") {
  const form = document.querySelector<HTMLFormElement>('[role="dialog"] form')!;
  await act(async () => {
    inputValue(form.querySelector<HTMLInputElement>('input[type="date"]')!, examDate);
    form
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((checkbox) => checkbox.click());
  });
  return form;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.user = { uid: "operator-a", getIdToken: async () => "test-token" };
  fileRows.rows = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(async (url) =>
        isDirectory(url) ? directory() : json(list([makeCard()]))
      )
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("esteira compartilhada de ASOs", () => {
  it("carrega clientes antes dos cards e consulta a carteira grande somente após seleção", async () => {
    const companies = Array.from({ length: 31 }, (_, i) => ({
      id: `company-${i}`,
      name: `Cliente ${i}`,
      active: true,
    }));
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? json({ companies, requiresSelection: true })
        : json(list([{ ...makeCard(), companyId: "company-30", companyName: "Cliente 30" }]))
    );
    await render();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => !isDirectory(url))).toHaveLength(0);
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Cliente da esteira"]')!;
    expect(select.options).toHaveLength(32);
    expect(select.disabled).toBe(false);
    expect(host.textContent).toContain("Selecione um cliente para abrir os cards");
    await act(async () => {
      select.value = "company-30";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(String(vi.mocked(fetch).mock.calls.find(([url]) => !isDirectory(url))![0])).toBe(
      "/api/aso-flow?companyId=company-30"
    );
    expect(host.textContent).toContain("Pessoa de teste 1");
  });
  it("mantém o cliente do link na consulta e oferece saída explícita para toda a carteira", async () => {
    await act(async () => root.render(<AsoFlowBoard initialCompany="company-test" />));
    expect(String(vi.mocked(fetch).mock.calls.find(([url]) => !isDirectory(url))![0])).toBe(
      "/api/aso-flow?companyId=company-test"
    );
    const filter = host.querySelector<HTMLSelectElement>('[aria-label="Cliente da esteira"]')!;
    expect(filter.value).toBe("company-test");
    expect(filter.disabled).toBe(true);
    expect(
      host.querySelector<HTMLAnchorElement>('a[href="/health-control?tab=esteira"]')?.textContent
    ).toBe("Todos os clientes");
  });
  it("usa o mesmo progresso dos cards para o mapa e exige PDF para estado recebido", () => {
    const pending = makeCard(),
      scheduled = { ...makeCard(2), status: "scheduled" as const };
    const missing = { ...makeCard(3), status: "received" as const };
    const received = {
      ...makeCard(4),
      status: "received" as const,
      aso: {
        hash: "h",
        fileName: "aso.pdf",
        size: 123,
        receivedAt: "2026-11-01",
        receivedBy: "operator",
        reference: "test",
        source: "upload" as const,
        examDate: "2026-11-01",
      },
    };
    expect(
      asoFlowMapPeople([
        pending,
        scheduled,
        missing,
        received,
        { ...makeCard(5), status: "no_show" },
      ]).map((p) => p.progress)
    ).toEqual(["pending", "scheduled", "pending", "received", "cancelled"]);
  });
  it("atualiza card e mapa apenas com a confirmação do servidor, sem simples avanço de coluna", async () => {
    const saved = {
      ...makeCard(),
      status: "scheduled" as const,
      version: 2,
      clinic,
      appointment: {
        date: "2026-11-04",
        time: "09:00",
        reference: "confirmado-teste",
        confirmedBy: "operator-a",
        confirmedAt: "2026-11-01T12:00:00Z",
      },
    };
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      isDirectory(url)
        ? directory()
        : init?.method === "POST"
          ? json({ card: saved })
          : json(list([makeCard()]))
    );
    await render();
    await click("Pessoa de teste 1");
    expect(document.body.textContent).not.toContain("Avançar etapa");
    const form = document.querySelector<HTMLFormElement>("[role=dialog] form")!;
    await act(async () => {
      const select = form.querySelector<HTMLSelectElement>('[name="clinicId"]')!;
      select.value = clinic.id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      inputValue(form.querySelector('[name="date"]')!, "2026-11-04");
      inputValue(form.querySelector('[name="time"]')!, "09:00");
      inputValue(form.querySelector('[name="reference"]')!, "confirmado-teste");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      action: "schedule",
      id: makeCard().id,
      version: 1,
      clinicId: clinic.id,
    });
    expect(document.body.textContent).toContain("Card e mapa atualizados");
    await click("Close");
    await click("Mapa");
    expect(host.querySelector('[data-progress="scheduled"]')).not.toBeNull();
  });
  it("desabilita envio real sem conexão e não executa transmissão ao abrir o card", async () => {
    await render();
    await click("Pessoa de teste 1");
    await click("Enviar e-mail");
    expect(document.body.textContent).toContain("conexão de e-mail ainda não está configurada");
    expect(button("Enviar kit à clínica").disabled).toBe(true);
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      0
    );
  });
  it("permite conferir novamente o destinatário de um ASO já revisado sem trocar o PDF", async () => {
    const card: AsoFlowCard = {
      ...makeCard(),
      status: "reviewed",
      clientEmail: "",
      aso: {
        hash: "d".repeat(64),
        fileName: "ASO_teste.pdf",
        size: 100,
        source: "upload",
        reference: "received-test",
        receivedAt: "2026-11-01T12:00:00Z",
        receivedBy: "operator-a",
        examDate: "2026-11-01",
      },
    };
    const updated = { ...card, version: 2, clientEmail: "updated@example.invalid" };
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      isDirectory(url)
        ? directory()
        : init?.method === "POST"
          ? json({ card: updated })
          : json(list([card]))
    );
    await render();
    await click("Pessoa de teste 1");
    await click("Conferir destinatário");
    expect(document.body.textContent).toContain("Ainda não informado");
    const form = document.querySelector<HTMLFormElement>('[role="dialog"] form')!;
    await act(async () => {
      form
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((checkbox) => checkbox.click());
    });
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    const payload = JSON.parse(
      String(vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST")![1]?.body)
    );
    expect(payload).toMatchObject({
      action: "review_aso",
      identityConfirmed: true,
      documentChecked: true,
      id: card.id,
      version: 1,
    });
    expect(document.body.textContent).toContain("updated@example.invalid");
  });
  it("mantém anexos de e-mail como candidatos até a conferência explícita", async () => {
    const candidate = {
      id: "b".repeat(64),
      fileName: "Retorno_teste.pdf",
      from: "clinic@example.invalid",
      subject: "Retorno de teste",
      receivedAt: "2026-11-01T12:00:00Z",
    };
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? json({
              status: {
                configured: true,
                monitoringConfigured: true,
                mailbox: "mailbox@example.invalid",
              },
              candidates: String(url).includes("cursor=") ? [candidate] : [],
              nextCursor: String(url).includes("cursor=") ? null : "c".repeat(64),
              truncated: !String(url).includes("cursor="),
            })
          : json(list([makeCard()]))
    );
    await render();
    await click("Pessoa de teste 1");
    await click("Retornos por e-mail");
    expect(document.body.textContent).toContain("Retorno_teste.pdf");
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/email"))
    ).toHaveLength(2);
    const radio = document.querySelector<HTMLInputElement>('[name="aso-candidate"]')!;
    await act(async () => radio.click());
    expect(button("Receber ASO para conferência").disabled).toBe(true);
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      0
    );
  });
  it("serializa a consulta inicial de retornos com as ações do card", async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? pending.promise
          : json(list([makeCard()]))
    );
    await openReturns();
    expect(document.body.textContent).toContain("Consultando anexos deste card");
    expect(button("Atualizar lista").disabled).toBe(true);
    expect(button("Agendamento").disabled).toBe(true);
    await act(async () => {
      button("Atualizar lista").click();
      button("Agendamento").click();
      button("Close").click();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/email"))
    ).toHaveLength(1);
    await act(async () => pending.resolve(json(mailbox(makeCandidate()))));
    expect(document.body.textContent).toContain("Retorno_1.pdf");
    expect(button("Atualizar lista").disabled).toBe(false);
    expect(button("Agendamento").disabled).toBe(false);
  });
  it("descarta a seleção e a conferência quando atualiza a lista de anexos", async () => {
    let reads = 0;
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? json(++reads === 1 ? mailbox(makeCandidate()) : mailbox())
          : json(list([makeCard()]))
    );
    await openReturns();
    await selectReturn();
    await confirmReturn();
    expect(button("Receber ASO para conferência").disabled).toBe(false);
    await click("Atualizar lista");
    expect(document.body.textContent).toContain("Nenhum anexo aguardando conferência neste card");
    expect(document.querySelector('[role="dialog"] form')).toBeNull();
    expect(document.querySelector('[name="aso-candidate"]')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      0
    );
  });
  it("não repete a consulta inicial após falha até a atualização explícita", async () => {
    let reads = 0;
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? ++reads === 1
            ? json({ error: "Caixa temporariamente indisponível." }, 503)
            : json(mailbox(makeCandidate()))
          : json(list([makeCard()]))
    );
    await openReturns();
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
      "Caixa temporariamente indisponível"
    );
    expect(reads).toBe(1);
    expect(button("Atualizar lista").disabled).toBe(false);
    await click("Atualizar lista");
    expect(reads).toBe(2);
    expect(document.body.textContent).toContain("Retorno_1.pdf");
    expect(document.querySelector('[role="dialog"] [role="alert"]')).toBeNull();
  });
  it("não reutiliza data nem confirmações de um PDF ao selecionar outro anexo", async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? json(mailbox(makeCandidate(), makeCandidate(2)))
          : json(list([makeCard()]))
    );
    await openReturns();
    await selectReturn();
    await confirmReturn();
    expect(button("Receber ASO para conferência").disabled).toBe(false);
    await selectReturn(1);
    const form = document.querySelector<HTMLFormElement>('[role="dialog"] form')!;
    expect(form.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe("");
    expect(
      [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(
        (checkbox) => !checkbox.checked
      )
    ).toBe(true);
    expect(button("Receber ASO para conferência").disabled).toBe(true);
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      0
    );
  });
  it("mantém o card aberto e envia uma única recepção até obter a confirmação", async () => {
    const pending = deferred<Response>();
    let accepted = false;
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? init?.method === "POST"
            ? pending.promise
            : json(accepted ? mailbox() : mailbox(makeCandidate()))
          : json(list([makeCard()]))
    );
    await openReturns();
    await selectReturn();
    const form = await confirmReturn();
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const posts = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({
      action: "receive",
      id: makeCard().id,
      version: 1,
      candidateId: makeCandidate().id,
      examDate: "2026-11-01",
      identityConfirmed: true,
      documentChecked: true,
    });
    expect(button("Agendamento").disabled).toBe(true);
    expect(button("Receber ASO para conferência").disabled).toBe(true);
    expect(form.querySelector<HTMLInputElement>('input[type="date"]')!.disabled).toBe(true);
    await act(async () => {
      button("Agendamento").click();
      button("Close").click();
    });
    expect(document.querySelector('[role="dialog"] form')).toBe(form);
    expect(document.body.textContent).not.toContain("Na pasta do cliente");
    accepted = true;
    await act(async () => pending.resolve(json({ card: receivedCard() })));
    expect(document.body.textContent).toContain("ASO recebido");
    expect(document.body.textContent).not.toContain("Na pasta do cliente");
    expect(document.body.textContent).not.toContain("Card encerrado");
    expect(button("Conferir ASO").disabled).toBe(false);
    expect(document.querySelector('[name="aso-candidate"]')).toBeNull();
    expect(document.body.textContent).toContain("Nenhum anexo aguardando conferência neste card");
    expect(
      vi.mocked(fetch).mock.calls.filter(
        ([url, init]) => String(url).includes("/email") && init?.method !== "POST"
      )
    ).toHaveLength(2);
  });
  it("exibe falha de recepção sem concluir o card nem repetir o POST automaticamente", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? init?.method === "POST"
            ? json({ error: "Recepção não confirmada. Confira antes de repetir." }, 503)
            : json(mailbox(makeCandidate()))
          : json(list([makeCard()]))
    );
    await openReturns();
    await selectReturn();
    const form = await confirmReturn();
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
      "Recepção não confirmada"
    );
    expect(document.body.textContent).not.toContain("Card encerrado");
    expect(document.body.textContent).not.toContain("Na pasta do cliente");
    expect(button("Receber ASO para conferência").disabled).toBe(false);
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      1
    );
    await click("Close");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("ignora a confirmação tardia de recepção após trocar de usuário", async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      isDirectory(url)
        ? directory()
        : String(url).includes("/email")
          ? init?.method === "POST"
            ? pending.promise
            : json(mailbox(makeCandidate()))
          : json(list([makeCard()]))
    );
    await openReturns();
    await selectReturn();
    const form = await confirmReturn();
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    session.user = { uid: "operator-b", getIdToken: async () => "second-test-token" };
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : json(list([{ ...makeCard(2), employeeName: "Pessoa da conta atual" }]))
    );
    await render();
    await act(async () => pending.resolve(json({ card: receivedCard() })));
    expect(host.textContent).toContain("Pessoa da conta atual");
    expect(host.textContent).not.toContain("Pessoa de teste 1");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(button("Atualizar").disabled).toBe(false);
  });
  it("impede novos envios enquanto o resultado anterior está em conferência", async () => {
    const card = {
      ...makeCard(),
      mailLock: {
        outboxId: "test-outbox",
        documentHash: "test-hash",
        kind: "kit" as const,
        recipient: clinic.email,
        version: 1,
        startedAt: "2026-11-01T12:00:00Z",
      },
    };
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      isDirectory(url)
        ? directory()
        : init?.method === "POST"
          ? json({ card, reconciled: false, message: "Envio ainda em conferência." })
          : json(list([card]))
    );
    await render();
    await click("Pessoa de teste 1");
    expect(button("Enviar e-mail").disabled).toBe(true);
    expect(button("Salvar registro").disabled).toBe(true);
    await click("Verificar envio");
    expect(
      JSON.parse(
        String(vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST")![1]?.body)
      )
    ).toEqual({ action: "reconcile", id: card.id });
    expect(document.body.textContent).toContain("Envio ainda em conferência");
  });
  it("confere e importa mais de 200 linhas sem corte, em lotes sequenciais após confirmação", async () => {
    fileRows.rows = Array.from({ length: 201 }, (_, index) => ({
      companyCnpj: "00000000000000",
      employeeCpf: "00000000000",
      employeeName: `Pessoa ${index}`,
      city: "Curitiba",
      state: "PR",
      unit: "Unidade",
      examType: "periodico",
      cycle: "2026-11",
      sourceRow: index + 2,
    }));
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (isDirectory(url)) return directory();
      if (init?.method !== "POST") return json(list([]));
      const body = JSON.parse(String(init.body));
      if (body.action === "preview")
        return json({
          preview: {
            rows: body.rows.map((row: AsoFlowRow) => ({
              row,
              index: row.sourceRow,
              state: "ready",
              errors: [],
              id: makeCard(row.sourceRow).id,
              companyName: "Empresa de teste",
            })),
            ready: body.rows.length,
            existing: 0,
            blocked: 0,
          },
        });
      return json({
        created: body.rows.length,
        unchanged: 0,
        cards: body.rows.map((row: AsoFlowRow) => makeCard(row.sourceRow)),
      });
    });
    await render();
    const fileInput = host.querySelector<HTMLInputElement>(
      '[aria-label="Planilha de solicitações ASO"]'
    )!;
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [new File(["test"], "teste.csv", { type: "text/csv" })],
    });
    await act(async () => fileInput.dispatchEvent(new Event("change", { bubbles: true })));
    const payloads = () =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([, init]) => init?.method === "POST")
        .map(([, init]) => JSON.parse(String(init?.body)));
    expect(payloads().map((p) => [p.action, p.rows.length])).toEqual([
      ["preview", 200],
      ["preview", 1],
    ]);
    await click("Criar 201 cards prontos");
    expect(payloads().map((p) => [p.action, p.rows.length])).toEqual([
      ["preview", 200],
      ["preview", 1],
      ["import", 200],
      ["import", 1],
    ]);
    expect(document.body.textContent).toContain("201 cards criados");
  });
  it("apaga dados da esteira e prévia quando a autorização é revogada", async () => {
    await render();
    expect(host.textContent).toContain("Pessoa de teste 1");
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: "Acesso revogado" }, 403));
    await click("Atualizar");
    expect(host.textContent).toContain("Acesso revogado");
    expect(host.textContent).not.toContain("Pessoa de teste 1");
  });
  it("não mostra uma resposta tardia da conta anterior", async () => {
    let resolveFirst!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      })
    );
    await render();
    session.user = { uid: "operator-b", getIdToken: async () => "second-test-token" };
    vi.mocked(fetch).mockImplementation(async (url) =>
      isDirectory(url)
        ? directory()
        : json(list([{ ...makeCard(2), employeeName: "Pessoa da conta atual" }]))
    );
    await render();
    await act(async () =>
      resolveFirst(
        json({
          companies: [{ id: "old-company", name: "Pessoa da conta anterior", active: true }],
          requiresSelection: false,
        })
      )
    );
    expect(host.textContent).toContain("Pessoa da conta atual");
    expect(host.textContent).not.toContain("Pessoa da conta anterior");
  });
});
