import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodicWorkCard } from "@/lib/avp-periodic-workflow";

const session = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: async () => "test-token" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
}));
vi.mock("@/firebase", () => ({ useUser: () => session }));
import { AvpPeriodicWork } from "./avp-periodic-work";

let root: Root, host: HTMLDivElement;
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const snapshot = (cards: PeriodicWorkCard[]) => ({ checkedAt: "2026-11-03T12:00:00Z", cards });
type CardOverrides = Partial<Omit<PeriodicWorkCard, "person">> & {
  person?: Partial<PeriodicWorkCard["person"]>;
};
function card(index = 1, overrides: CardOverrides = {}): PeriodicWorkCard {
  const hash = index.toString(16).padStart(64, "0");
  return {
    id: `periodico-2026-${hash}`,
    revision: 0,
    sourceVersion: hash,
    state: null,
    stage: "validar",
    blocked: false,
    sourceChanged: false,
    overdue: false,
    ...overrides,
    person: {
      id: `fonte-sintetica-${index}`,
      name: `Pessoa sintética ${index}`,
      city: "Curitiba",
      uf: "PR",
      cityKey: "CURITIBA|PR",
      unit: "Unidade sintética",
      status: "Agendado",
      review: "Conferir",
      classification: "review",
      duplicateRows: 0,
      phone: "",
      email: "",
      admission: "2024-01-02",
      sourceRows: [index + 1],
      workIdentityComplete: true,
      ...overrides.person,
    },
  };
}
function savedCard(
  index: number,
  stage: PeriodicWorkCard["stage"],
  responsible: string,
  overrides: CardOverrides = {}
): PeriodicWorkCard {
  const item = card(index, overrides);
  return {
    ...item,
    stage,
    revision: 3,
    state: {
      sourceVersion: item.sourceVersion,
      revision: 3,
      stage,
      responsible,
      nextDate: "2026-11-04",
      updatedAt: "2026-11-03T12:00:00Z",
      updatedBy: "operador-sintetico",
    },
  };
}
function deferredResponse() {
  let resolve!: (result: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const history = () => ({
  history: [
    {
      updatedAt: "2026-11-02T12:00:00Z",
      responsible: "Responsável restrito sintético",
      stage: "validar",
      evidence: "Evidência privada sintética",
      evidenceDate: "2026-11-02",
    },
  ],
});
const fetchMock = () => vi.fn<typeof fetch>();
type FetchMock = ReturnType<typeof fetchMock>;
const patches = (mock: FetchMock) => mock.mock.calls.filter(([, init]) => init?.method === "PATCH");

function button(name: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (element) => element.getAttribute("aria-label") === name || element.textContent?.trim() === name
  );
  expect(found, `Botão ausente: ${name}`).toBeDefined();
  return found!;
}
async function click(name: string, scope: ParentNode = host) {
  await act(async () => button(name, scope).click());
}
function cityArticle(label = "Curitiba/PR") {
  const found = [...host.querySelectorAll("article")].find(
    (element) => element.getAttribute("aria-label") === label
  );
  expect(found, `Cidade ausente: ${label}`).toBeDefined();
  return found!;
}
function rows() {
  return [
    ...host.querySelectorAll('table[aria-label="Colaboradores e vínculos da campanha"] tbody tr'),
  ];
}
function pagination(kind: "cidades" | "colaboradores") {
  const found = host.querySelector(`nav[aria-label="Páginas de ${kind}"]`);
  expect(found).not.toBeNull();
  return found!;
}
async function input(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(prototype.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })
    );
  });
}
function editorField(label: string): HTMLInputElement | HTMLSelectElement {
  const field = [...host.querySelectorAll("form label")]
    .find((element) => element.textContent?.trim().startsWith(label))
    ?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  expect(field, `Campo ausente: ${label}`).toBeDefined();
  return field!;
}
async function fillNextAction() {
  await input(editorField("Responsável"), "Operação sintética");
  await input(editorField("Etapa"), "agendar");
  await input(editorField("Data da próxima ação"), "2026-11-04");
  await input(
    editorField("Referência da evidência"),
    "Validação sintética de vínculo e periodicidade"
  );
  await input(editorField("Data da evidência"), "2026-11-03");
}
async function render() {
  await act(async () => root.render(<AvpPeriodicWork />));
}
async function openCity(label = "Curitiba/PR") {
  await click(`Abrir colaboradores de ${label}`);
}
const editLabel = (item: PeriodicWorkCard) =>
  `Registrar próxima ação de ${item.person.name} — ${item.person.unit}`;
const historyLabel = (item: PeriodicWorkCard) =>
  `Histórico e evidências de ${item.person.name} — ${item.person.unit}`;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.user = { uid: "a", getIdToken: async () => "test-token" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("periódicos por cidade", () => {
  it("abre agrupado por cidade e UF, preserva vínculos e só mostra nomes ao abrir a cidade", async () => {
    const cards = [
      card(1),
      card(2, { person: { unit: "Outra unidade sintética" } }),
      card(3, { person: { uf: "SC", cityKey: "CURITIBA|SC" } }),
    ];
    const mock = fetchMock().mockImplementation(async () => response(snapshot(cards)));
    vi.stubGlobal("fetch", mock);
    await render();
    expect(button("Cidades").getAttribute("aria-pressed")).toBe("true");
    expect(button("Colaboradores").getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(cityArticle().textContent).toContain("2 registros · 2 unidades");
    expect(cityArticle("Curitiba/SC").textContent).toContain("1 registros");
    expect(host.textContent).not.toContain(cards[0].person.name);
    await openCity();
    expect(rows()).toHaveLength(2);
    expect(host.textContent).toContain(cards[0].person.name);
    expect(host.textContent).not.toContain(cards[2].person.name);
    await click("Voltar às cidades");
    await click("Colaboradores");
    expect(rows()).toHaveLength(3);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(patches(mock)).toHaveLength(0);
  });

  it.each([
    ["Etapa dos registros", "concluido"],
    ["Unidade dos registros", "Unidade concluída"],
    ["Responsável dos registros", "Equipe sintética"],
    ["busca", "Pessoa concluída sintética"],
  ])("o filtro %s não encolhe o denominador nem conclui a cidade", async (label, value) => {
    const done = savedCard(2, "concluido", "Equipe sintética", {
      person: { name: "Pessoa concluída sintética", unit: "Unidade concluída" },
    });
    const cards = [
      card(1),
      done,
      card(3, { blocked: true, person: { classification: "cancelled" } }),
    ];
    const mock = fetchMock().mockImplementation(async () => response(snapshot(cards)));
    vi.stubGlobal("fetch", mock);
    await render();
    const filter =
      label === "busca"
        ? host.querySelector<HTMLInputElement>('input[type="search"]')!
        : host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    await input(filter, value);
    const summary = cityArticle();
    expect(summary.textContent).toContain("3 registros");
    expect(summary.textContent).toContain("1 de 3 registros correspondem aos filtros");
    expect(summary.textContent).toContain("1 de 2 ativos concluídos");
    expect(summary.textContent).toContain("Validar convocação");
    const progress = summary.querySelector('[role="progressbar"]')!;
    expect(progress.getAttribute("aria-valuemax")).toBe("2");
    expect(progress.getAttribute("aria-valuenow")).toBe("1");
    await openCity();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain(done.person.name);
    expect(host.textContent).toContain("1 de 3 registros correspondem aos filtros");
    await click("Ver todos da cidade");
    expect(rows()).toHaveLength(2);
    expect(host.textContent).toContain("3 de 3 registros correspondem aos filtros");
    await click("Cancelados (1)");
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Cancelado na fonte");
    expect(patches(mock)).toHaveLength(0);
  });

  it("reajusta a paginação de 12 cidades quando a atualização reduz o total", async () => {
    const cards = Array.from({ length: 13 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return card(index + 1, {
        person: { city: `Cidade sintética ${number}`, cityKey: `CIDADE SINTETICA ${number}|PR` },
      });
    });
    const mock = fetchMock()
      .mockResolvedValueOnce(response(snapshot(cards)))
      .mockResolvedValueOnce(response(snapshot(cards.slice(0, 12))));
    vi.stubGlobal("fetch", mock);
    await render();
    expect(host.querySelectorAll("article")).toHaveLength(12);
    await click("Próxima", pagination("cidades"));
    expect(pagination("cidades").textContent).toContain("Página 2 de 2");
    expect(host.querySelectorAll("article")).toHaveLength(1);
    await click("Atualizar cards");
    expect(pagination("cidades").textContent).toContain("Página 1 de 1");
    expect(host.querySelectorAll("article")).toHaveLength(12);
    expect(patches(mock)).toHaveLength(0);
  });

  it("pagina 15 vínculos e mantém a cidade aberta quando a atualização reduz as páginas", async () => {
    const cards = Array.from({ length: 16 }, (_, index) => card(index + 1));
    const mock = fetchMock()
      .mockResolvedValueOnce(response(snapshot(cards)))
      .mockResolvedValueOnce(response(snapshot(cards.slice(0, 15))));
    vi.stubGlobal("fetch", mock);
    await render();
    await openCity();
    expect(rows()).toHaveLength(15);
    await click("Próxima", pagination("colaboradores"));
    expect(pagination("colaboradores").textContent).toContain("Página 2 de 2");
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain(cards[15].person.name);
    await click("Atualizar cards");
    expect(pagination("colaboradores").textContent).toContain("Página 1 de 1");
    expect(rows()).toHaveLength(15);
    expect(patches(mock)).toHaveLength(0);
  });

  it("mostra os indicadores municipais sem inferir kit enviado quando a fonte não comprova", async () => {
    const cards = [
      card(1),
      savedCard(2, "confirmar_realizacao", "Equipe sintética"),
      savedCard(3, "resgatar_aso", "Equipe sintética"),
      savedCard(4, "conferir_esocial", "Equipe sintética"),
      card(5, { person: { status: "Kit enviado" } }),
      card(6, { person: { asoReceivedAt: "03/11/2026" } }),
    ];
    const mock = fetchMock().mockImplementation(async () => response(snapshot(cards)));
    vi.stubGlobal("fetch", mock);
    await render();
    const summary = cityArticle();
    const metrics = summary.querySelector('[aria-label="Indicadores operacionais da cidade"]')!;
    expect(metrics).not.toBeNull();
    expect(metrics.textContent).toContain("1");
    expect(metrics.querySelector('[title^="Kits enviados"]')?.textContent).toContain("1");
    expect(
      metrics.querySelector('[title="Agendamentos confirmados na esteira"]')?.textContent
    ).toContain("3");
    expect(
      metrics.querySelector('[title="Exames com realização registrada"]')?.textContent
    ).toContain("2");
    expect(metrics.querySelector('[title="ASOs recebidos"]')?.textContent).toContain("2");

    const noKit = fetchMock().mockImplementation(async () => response(snapshot([card(7)])));
    vi.stubGlobal("fetch", noKit);
    await click("Atualizar cards");
    expect(
      cityArticle().querySelector('[title^="A fonte atual não possui evidência"]')?.textContent
    ).toContain("—");
  });

  it("mantém validação e responsável ausente mesmo com agenda informada na fonte", async () => {
    const item = card(1, {
      person: {
        sourceAppointment: {
          date: "04/11/2026",
          time: "08:00",
          clinic: "Clínica sintética",
          city: "Curitiba",
          uf: "PR",
        },
      },
    });
    const mock = fetchMock().mockImplementation(async () => response(snapshot([item])));
    vi.stubGlobal("fetch", mock);
    await render();
    expect(cityArticle().textContent).toContain("Validar convocação");
    expect(cityArticle().textContent).toContain("Responsável: Não informado");
    await openCity();
    const cells = rows()[0].querySelectorAll("td");
    expect(cells[1].textContent).toBe("Validar convocação");
    expect(cells[2].textContent).toContain("Não informado");
    await click("Agendas");
    const agendas = host.querySelector('table[aria-label="Agendas por unidade e clínica"]')!;
    expect(agendas.textContent).toContain("Clínica sintética");
    expect(agendas.textContent).toContain("04/11/2026");
    expect(host.textContent).toContain("A confirmação e o avanço permanecem individuais");
    expect(patches(mock)).toHaveLength(0);
  });

  it("separa agendas globais vazias da mesma unidade em cidades diferentes", async () => {
    const cards = [
      card(1),
      card(2, { person: { city: "Recife", uf: "PE", cityKey: "RECIFE|PE" } }),
    ];
    const mock = fetchMock().mockImplementation(async () => response(snapshot(cards)));
    vi.stubGlobal("fetch", mock);
    await render();
    await click("Colaboradores");
    await click("Agendas");
    const agendaRows = [
      ...host.querySelectorAll('table[aria-label="Agendas por unidade e clínica"] tbody tr'),
    ];
    expect(agendaRows).toHaveLength(2);
    expect(agendaRows.some((row) => row.textContent?.includes("Curitiba/PR"))).toBe(true);
    expect(agendaRows.some((row) => row.textContent?.includes("Recife/PE"))).toBe(true);
    for (const row of agendaRows) {
      expect(row.textContent).toContain("Unidade sintética");
      expect(row.textContent).toContain("Clínica a definir");
      expect(row.querySelector("td:last-child")?.textContent).toBe("1");
    }
    expect(patches(mock)).toHaveLength(0);
  });

  it("salva exatamente um PATCH para o vínculo escolhido sem avançar os demais da cidade", async () => {
    const other = card(1, { person: { name: "Pessoa homônima sintética", unit: "Unidade Alfa" } });
    const target = savedCard(2, "validar", "Equipe anterior", {
      person: { name: other.person.name, unit: "Unidade Beta" },
    });
    const updated = savedCard(2, "agendar", "Operação sintética", { person: target.person });
    const mock = fetchMock()
      .mockResolvedValueOnce(response(snapshot([other, target])))
      .mockResolvedValueOnce(response({ saved: true }))
      .mockResolvedValueOnce(response(snapshot([other, updated])));
    vi.stubGlobal("fetch", mock);
    await render();
    await openCity();
    await click(editLabel(target));
    await fillNextAction();
    await click("Salvar registro");
    expect(patches(mock)).toHaveLength(1);
    const [url, init] = patches(mock)[0];
    expect(url).toBe("/api/clients/grupo-avp/periodic-work");
    expect(JSON.parse(String(init?.body))).toEqual({
      id: target.id,
      sourceVersion: target.sourceVersion,
      revision: target.revision,
      responsible: "Operação sintética",
      stage: "agendar",
      nextDate: "2026-11-04",
      evidence: "Validação sintética de vínculo e periodicidade",
      evidenceDate: "2026-11-03",
      evidenceKind: "eligibility",
      clinic: "",
      appointmentTime: "",
      receiptNumber: "",
      nonApplicabilityReason: "",
    });
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(host.querySelector("form")).toBeNull();
    expect(rows()[0].querySelectorAll("td")[1].textContent).toBe("Validar convocação");
    expect(rows()[1].querySelectorAll("td")[1].textContent).toBe("Agendar");
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("preserva a etapa e o rascunho após 409 sem repetir PATCH nem avançar a cidade", async () => {
    const target = card();
    const mock = fetchMock()
      .mockResolvedValueOnce(response(snapshot([target, card(2)])))
      .mockResolvedValueOnce(
        response({ error: "Outro operador atualizou o card. Recarregue." }, 409)
      );
    vi.stubGlobal("fetch", mock);
    await render();
    await openCity();
    await click(editLabel(target));
    await fillNextAction();
    await click("Salvar registro");
    expect(host.textContent).toContain("Outro operador atualizou o card. Recarregue.");
    expect(editorField("Referência da evidência").value).toBe(
      "Validação sintética de vínculo e periodicidade"
    );
    expect(rows().map((row) => row.querySelectorAll("td")[1].textContent)).toEqual([
      "Validar convocação",
      "Validar convocação",
    ]);
    expect(patches(mock)).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])(
    "remove histórico e grupos após atualização negada com %s",
    async (status) => {
      const target = card();
      const mock = fetchMock()
        .mockResolvedValueOnce(response(snapshot([target])))
        .mockResolvedValueOnce(response(history()))
        .mockResolvedValueOnce(response({ error: "Acesso revogado" }, status));
      vi.stubGlobal("fetch", mock);
      await render();
      await openCity();
      await click(historyLabel(target));
      expect(host.textContent).toContain("Evidência privada sintética");
      await click("Atualizar cards");
      expect(host.textContent).toContain("Acesso revogado");
      expect(host.textContent).not.toContain("Evidência privada sintética");
      expect(host.textContent).not.toContain("Responsável restrito sintético");
      expect(host.textContent).not.toContain(target.person.name);
      expect(host.querySelectorAll("article, table, form")).toHaveLength(0);
      expect(patches(mock)).toHaveLength(0);
    }
  );

  it("limpa o editor e os dados privados quando o PATCH recebe acesso revogado", async () => {
    const target = card();
    const mock = fetchMock()
      .mockResolvedValueOnce(response(snapshot([target])))
      .mockResolvedValueOnce(response({ error: "Acesso revogado" }, 403));
    vi.stubGlobal("fetch", mock);
    await render();
    await openCity();
    await click(editLabel(target));
    await fillNextAction();
    await click("Salvar registro");
    expect(host.textContent).toContain("Acesso revogado");
    expect(host.textContent).not.toContain(target.person.name);
    expect(host.querySelectorAll("article, table, form")).toHaveLength(0);
    expect(patches(mock)).toHaveLength(1);
  });

  it.each([401, 403])(
    "revoga o snapshot ao receber histórico tardio %s mesmo após voltar às cidades",
    async (status) => {
      const target = card();
      const pending = deferredResponse();
      const mock = fetchMock()
        .mockResolvedValueOnce(response(snapshot([target])))
        .mockReturnValueOnce(pending.promise);
      vi.stubGlobal("fetch", mock);
      await render();
      await openCity();
      await click(historyLabel(target));
      await click("Voltar às cidades");
      expect(cityArticle().textContent).toContain("1 registros");
      await act(async () =>
        pending.resolve(response({ error: "Acesso revogado no histórico" }, status))
      );
      expect(host.textContent).toContain("Acesso revogado no histórico");
      expect(host.querySelectorAll("article, table, form")).toHaveLength(0);
      expect(host.textContent).not.toContain(target.person.name);
      expect(patches(mock)).toHaveLength(0);
    }
  );

  it("ignora histórico bem-sucedido tardio depois de paginar os colaboradores", async () => {
    const cards = Array.from({ length: 16 }, (_, index) => card(index + 1));
    const pending = deferredResponse();
    const mock = fetchMock()
      .mockResolvedValueOnce(response(snapshot(cards)))
      .mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", mock);
    await render();
    await openCity();
    await click(historyLabel(cards[0]));
    await click("Próxima", pagination("colaboradores"));
    expect(rows()).toHaveLength(1);
    await act(async () => pending.resolve(response(history())));
    expect(host.textContent).not.toContain("Evidência privada sintética");
    expect(host.textContent).not.toContain("Responsável restrito sintético");
    expect(rows()[0].textContent).toContain(cards[15].person.name);
    expect(patches(mock)).toHaveLength(0);
  });

  it("descarta grupos, seleção e rascunho ao sair da sessão", async () => {
    const target = card();
    const mock = fetchMock().mockImplementation(async () => response(snapshot([target])));
    vi.stubGlobal("fetch", mock);
    await render();
    await openCity();
    await click(editLabel(target));
    await fillNextAction();
    session.user = null;
    await render();
    expect(host.querySelectorAll("article, table, form")).toHaveLength(0);
    expect(host.textContent).not.toContain(target.person.name);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(patches(mock)).toHaveLength(0);
  });

  it("não exibe resposta de campanha pendente da identidade anterior", async () => {
    const pending = deferredResponse();
    const other = card(2, {
      person: { city: "Recife", uf: "PE", cityKey: "RECIFE|PE", name: "Pessoa da nova sessão" },
    });
    const mock = fetchMock()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(response(snapshot([other])));
    vi.stubGlobal("fetch", mock);
    await render();
    session.user = { uid: "b", getIdToken: async () => "other-token" };
    await render();
    await act(async () => pending.resolve(response(snapshot([card()]))));
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(cityArticle("Recife/PE")).toBeDefined();
    expect(host.textContent).not.toContain("Curitiba");
    expect(button("Cidades").getAttribute("aria-pressed")).toBe("true");
    expect(mock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "Bearer other-token" });
    expect(patches(mock)).toHaveLength(0);
  });

  it.each([200, 401])(
    "ignora histórico tardio %s da sessão anterior sem expor nem apagar a sessão nova",
    async (status) => {
      const target = card();
      const other = card(2, {
        person: { city: "Recife", uf: "PE", cityKey: "RECIFE|PE", name: "Pessoa da nova sessão" },
      });
      const pending = deferredResponse();
      const mock = fetchMock()
        .mockResolvedValueOnce(response(snapshot([target])))
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce(response(snapshot([other])));
      vi.stubGlobal("fetch", mock);
      await render();
      await openCity();
      await click(historyLabel(target));
      session.user = { uid: "b", getIdToken: async () => "other-token" };
      await render();
      await act(async () =>
        pending.resolve(
          response(status === 200 ? history() : { error: "Revogação da sessão antiga" }, status)
        )
      );
      expect(cityArticle("Recife/PE")).toBeDefined();
      expect(host.textContent).not.toContain("Curitiba");
      expect(host.textContent).not.toContain("Evidência privada sintética");
      expect(host.textContent).not.toContain("Revogação da sessão antiga");
      expect(host.querySelector("form")).toBeNull();
      expect(button("Cidades").getAttribute("aria-pressed")).toBe("true");
      expect(patches(mock)).toHaveLength(0);
    }
  );
});
