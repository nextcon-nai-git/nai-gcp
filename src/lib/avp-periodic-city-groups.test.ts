// @vitest-environment node
import { describe, expect, it } from "vitest";
import { groupPeriodicWorkByCity } from "./avp-periodic-city-groups";
import type { PeriodicWorkCard, PeriodicWorkState } from "./avp-periodic-workflow";

function card(
  id: string,
  overrides: Partial<PeriodicWorkCard> = {},
  person: Partial<PeriodicWorkCard["person"]> = {}
): PeriodicWorkCard {
  return {
    id,
    revision: 0,
    sourceVersion: "a".repeat(64),
    state: null,
    stage: "validar",
    blocked: false,
    sourceChanged: false,
    overdue: false,
    ...overrides,
    person: {
      id,
      name: "Nome sintético repetido",
      city: "Recife",
      cityKey: "RECIFE|PE",
      uf: "PE",
      unit: "Unidade sintética A",
      status: "Não iniciado",
      review: "Conferir",
      phone: "",
      email: "",
      admission: "2020-01-01",
      classification: "review",
      duplicateRows: 0,
      sourceRows: [5],
      workIdentityComplete: true,
      ...person,
    },
  };
}

function state(responsible: string, nextDate = ""): PeriodicWorkState {
  return {
    responsible,
    nextDate,
    stage: "validar",
    revision: 1,
    sourceVersion: "a".repeat(64),
    updatedAt: "2026-11-03T12:00:00Z",
    updatedBy: "operador-sintetico",
  };
}

describe("agrupamento dos vínculos periódicos por cidade", () => {
  it("usa campanha explícita e cityKey com UF, preservando vínculos de nomes iguais", () => {
    const first = card("vinculo-a");
    const second = card("vinculo-b", {}, { unit: "Unidade sintética B" });
    const anotherState = card("vinculo-c", {}, { cityKey: "RECIFE|BA", uf: "BA" });
    const groups = groupPeriodicWorkByCity([first, second, anotherState], "2026");
    const recife = groups.find((group) => group.cityKey === "RECIFE|PE")!;
    expect(groups).toHaveLength(2);
    expect(recife).toMatchObject({ key: "2026:RECIFE|PE", campaign: "2026", total: 2 });
    expect(recife.cards).toEqual([first, second]);
    expect(recife.cards.map((item) => item.id)).toEqual(["vinculo-a", "vinculo-b"]);
    expect(groupPeriodicWorkByCity([first], "campanha-explicita")[0].key).toBe(
      "campanha-explicita:RECIFE|PE"
    );
    expect(groupPeriodicWorkByCity([])).toEqual([]);
  });

  it("mantém o denominador completo quando filtros selecionam o grupo", () => {
    const cards = [
      card("a", { state: state("Ana") }),
      card("b", { stage: "agendar", state: state("Bruno") }),
      card("c", { stage: "resgatar_aso" }, { unit: "Unidade sintética B" }),
      card("d", { blocked: true }, { classification: "cancelled" }),
    ];
    const selected = groupPeriodicWorkByCity(cards).filter(
      (group) => group.owners.includes("Ana") && group.stageCounts.resgatar_aso > 0
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      total: 4,
      active: 3,
      cancelled: 1,
      pending: 3,
      kitSent: null,
      appointmentsConfirmed: 1,
      examsPerformed: 1,
      asoReceived: 0,
    });
    expect(selected[0].cards).toHaveLength(4);
    expect(selected[0].owners).toEqual(["Ana", "Bruno"]);
    expect(selected[0].units).toEqual(["Unidade sintética A", "Unidade sintética B"]);
    expect(selected[0].stageCounts).toEqual({
      validar: 1,
      agendar: 1,
      confirmar_realizacao: 0,
      resgatar_aso: 1,
      conferir_esocial: 0,
      concluido: 0,
    });
    expect(selected[0].priority.label).toBe("Validar convocação");
  });

  it("projeta indicadores municipais sem inventar kit enviado", () => {
    const group = groupPeriodicWorkByCity([
      card("validar"),
      card("agenda", { stage: "confirmar_realizacao" }),
      card("realizado", { stage: "resgatar_aso" }),
      card("aso", { stage: "conferir_esocial" }),
      card("kit", {}, { status: "Kit enviado" }),
      card("aso-fonte", {}, { asoReceivedAt: "03/11/2026" }),
      card("bloqueado", { stage: "conferir_esocial", blocked: true }),
    ])[0];
    expect(group).toMatchObject({
      total: 7,
      kitSent: 1,
      appointmentsConfirmed: 3,
      examsPerformed: 2,
      asoReceived: 2,
    });
    expect(groupPeriodicWorkByCity([card("sem-sinal")])[0].kitSent).toBeNull();
  });

  it("conclui somente os ativos aplicáveis e não inclui cancelados no progresso", () => {
    const group = groupPeriodicWorkByCity([
      card("a", { stage: "concluido" }),
      card("b", { blocked: true, sourceChanged: true }, { classification: "cancelled" }),
    ])[0];
    expect(group).toMatchObject({
      total: 2,
      active: 1,
      cancelled: 1,
      completed: 1,
      pending: 0,
      blocked: 0,
      sourceChanged: 0,
      complete: true,
      priority: { label: "Concluída" },
    });
  });

  it("nunca apresenta um grupo só de cancelados como concluído", () => {
    const group = groupPeriodicWorkByCity([
      card("cancelado", { blocked: true, overdue: true }, { classification: "cancelled" }),
    ])[0];
    expect(group).toMatchObject({
      total: 1,
      active: 0,
      cancelled: 1,
      completed: 0,
      pending: 0,
      blocked: 0,
      overdue: 0,
      unassigned: 0,
      complete: false,
      priority: { label: "Sem registros ativos" },
    });
  });

  it("revoga a conclusão agregada diante de fonte alterada ou bloqueio ativo", () => {
    const group = groupPeriodicWorkByCity([
      card("concluido", { stage: "concluido" }),
      card("fonte-alterada", { stage: "concluido", sourceChanged: true }),
      card("bloqueado", { stage: "concluido", blocked: true }),
    ])[0];
    expect(group).toMatchObject({
      active: 3,
      completed: 1,
      pending: 2,
      blocked: 1,
      sourceChanged: 1,
      complete: false,
      priority: { rank: 0 },
    });
    expect(group.stageCounts.concluido).toBe(3);
  });

  it("usa prazos e responsáveis dos pendentes ativos, ignorando datas impossíveis", () => {
    const group = groupPeriodicWorkByCity([
      card("futuro", { state: state("Ana", "2026-11-06") }),
      card("vencido", { state: state("Bruno", "2026-11-02"), overdue: true }),
      card("sem-responsavel", { state: state("   ", "2026-02-30") }),
      card("sem-estado"),
      card("concluido", {
        stage: "concluido",
        overdue: true,
        state: state("Carla", "2026-10-01"),
      }),
      card(
        "cancelado",
        { overdue: true, state: state("Daniel", "2026-09-01") },
        { classification: "cancelled" }
      ),
    ])[0];
    expect(group).toMatchObject({
      pending: 4,
      overdue: 1,
      unassigned: 2,
      nextDate: "2026-11-02",
      priority: { label: "Ações vencidas", rank: 1 },
    });
    expect(group.owners).toEqual(["Ana", "Bruno", "Carla", "Daniel"]);
    expect(groupPeriodicWorkByCity([card("sem-data")])[0].nextDate).toBeNull();
  });

  it("prioriza fonte e bloqueios, depois vencidos, etapa inicial e conclusão", () => {
    const inCity = (city: string, overrides: Partial<PeriodicWorkCard>) =>
      card(city, overrides, { city, cityKey: `${city}|PE` });
    const input = [
      inCity("Concluída", { stage: "concluido" }),
      inCity("Resgate", { stage: "resgatar_aso" }),
      inCity("Agenda", { stage: "agendar" }),
      inCity("Validação", {}),
      inCity("Vencida", { stage: "conferir_esocial", overdue: true }),
      inCity("Fonte", { sourceChanged: true }),
      card(
        "cancelado",
        {},
        { city: "Cancelada", cityKey: "Cancelada|PE", classification: "cancelled" }
      ),
    ];
    expect(groupPeriodicWorkByCity(input).map((group) => group.city)).toEqual([
      "Fonte",
      "Vencida",
      "Validação",
      "Agenda",
      "Resgate",
      "Concluída",
      "Cancelada",
    ]);
    expect(groupPeriodicWorkByCity([inCity("Bloqueio", { blocked: true })])[0].priority.rank).toBe(
      0
    );
  });

  it("desempata por data, quantidade pendente e cidade sem modificar os cards", () => {
    const inCity = (id: string, city: string, nextDate: string) =>
      card(id, { state: state("Ana", nextDate) }, { city, cityKey: `${city}|PE` });
    const input = Object.freeze([
      inCity("z", "Zeta", "2026-11-05"),
      inCity("b", "Beta", "2026-11-05"),
      inCity("a1", "Alfa", "2026-11-05"),
      inCity("a2", "Alfa", "2026-11-05"),
      inCity("p", "Primeira", "2026-11-04"),
      inCity("s", "Sem data", ""),
    ]);
    const original = JSON.stringify(input);
    const groups = groupPeriodicWorkByCity(input);
    expect(groups.map((group) => group.city)).toEqual([
      "Primeira",
      "Alfa",
      "Beta",
      "Zeta",
      "Sem data",
    ]);
    expect(JSON.stringify(input)).toBe(original);
    expect(groups.find((group) => group.city === "Alfa")!.cards[0]).toBe(input[2]);
  });
});
