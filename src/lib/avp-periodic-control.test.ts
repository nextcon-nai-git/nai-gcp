// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildAvpPeriodicControl,
  CAMPAIGN_HEADERS,
  PROVIDER_HEADERS,
  PRICE_HEADERS,
} from "./avp-periodic-control";
const person = (id = "1", cpf = "00000000001", city = "Fortaleza - ASCEC", uf = "CE") => {
  const r = Array<string>(31).fill("");
  r[0] = id;
  r[1] = city;
  r[2] = uf;
  r[3] = "Pessoa de teste";
  r[4] = cpf;
  r[6] = "Não iniciado";
  r[22] = "01/01/2020";
  r[28] = "OK - vence na campanha";
  r[30] = String(Number(id) + 4);
  return r;
};
const provider = (cnpj = "00000000000001", city = "Fortaleza", uf = "CE", active = "Sim") => [
  "Clínica A",
  "Razão A",
  cnpj,
  city,
  uf,
  "(00) 0000-0000",
  "",
  "",
  "Rua A",
  "Hora marcada",
  active,
  "2",
];
const price = (
  value: string | number = "50",
  cnpj = "00000000000001",
  location = "Fortaleza/CE",
  service = "Exame ocupacional / ASO"
) => [
  "Clínica A",
  location,
  value,
  service,
  "Preço informado",
  "2026-10-19",
  "",
  "Ref-1",
  cnpj,
  "",
  "9",
];
const build = (people = [person()], providers = [provider()], prices: unknown[][] = [price()]) =>
  buildAvpPeriodicControl(
    [CAMPAIGN_HEADERS, ...people],
    [PROVIDER_HEADERS, ...providers],
    [PRICE_HEADERS, ...prices]
  );
describe("controle da campanha periódica e rede AVP", () => {
  it("projeta uma única agenda da fonte aparada, ignorando repetições e linhas sem agenda", () => {
    const first = person();
    first.splice(
      7,
      5,
      " 04/11/2026 ",
      " 08:30 ",
      " Clínica de teste ",
      " Cidade de teste ",
      " CE "
    );
    const repeated = person("2");
    repeated.splice(7, 5, "04/11/2026", "08:30", "Clínica de teste", "Cidade de teste", "CE");
    const empty = person("3");
    const baseline = build([person(), person("2"), empty]).people[0];

    expect(build([first, repeated, empty]).people[0]).toEqual({
      ...baseline,
      sourceAppointment: {
        date: "04/11/2026",
        time: "08:30",
        clinic: "Clínica de teste",
        city: "Cidade de teste",
        uf: "CE",
      },
    });
  });
  it("preserva a agenda parcial sem inventar horário ou local nem avançar o status", () => {
    const partial = person();
    partial[7] = " 2026-11-04 ";
    partial[8] = " ";
    partial[9] = " Clínica parcial ";
    const baseline = build().people[0];

    expect(build([partial]).people[0]).toEqual({
      ...baseline,
      sourceAppointment: {
        date: "2026-11-04",
        time: "",
        clinic: "Clínica parcial",
        city: "",
        uf: "",
      },
    });
  });
  it("sinaliza agendas divergentes no mesmo vínculo sem escolher uma delas", () => {
    const first = person();
    first.splice(7, 5, "04/11/2026", "08:30", "Clínica de teste", "Cidade de teste", "CE");
    const conflicting = person("2");
    conflicting.splice(7, 5, "04/11/2026", "09:00", "Clínica de teste", "Cidade de teste", "CE");
    const baseline = build([person(), person("2")]).people[0];

    expect(build([first, conflicting]).people[0]).toEqual({
      ...baseline,
      sourceAppointmentConflict: true,
    });
    expect(build([conflicting, first]).people[0].sourceAppointment).toBeUndefined();
  });
  it("não cria referência de agenda quando a fonte não informa seus campos", () => {
    const withoutAppointment = person();
    withoutAppointment[6] = "Agendado";
    withoutAppointment.splice(7, 5, " ", "", " ", "", " ");
    const result = build([withoutAppointment]).people[0];

    expect(result.status).toBe("Agendado");
    expect(result).not.toHaveProperty("sourceAppointment");
    expect(result).not.toHaveProperty("sourceAppointmentConflict");
  });
  it.each([
    ["Sim", ""],
    ["", "Sim"],
    ["Sim", "", "Não"],
  ])("distingue ausência de evidência de contrato de uma negativa explícita: %j", (...states) => {
    const result = build(
      [person()],
      states.map((state) => provider(undefined, undefined, undefined, state))
    );
    const conflict = states.includes("Não");
    expect(result.clinics[0].contractReported).toBe(!conflict);
    expect(result.clinics[0].contractConflict).toBe(conflict);
    expect(result.cities[0].contracted).toBe(conflict ? 0 : 1);
  });
  it("deduplica o mesmo CPF, admissão, unidade e município sem expor CPF", () => {
    const duplicate = person("2");
    duplicate[1] = "Fortaleza - ASSOBES Jóquei";
    const d = build([person(), duplicate]);
    expect(d.summary).toMatchObject({
      sourceRows: 2,
      uniquePeople: 1,
      duplicates: 1,
      review: 1,
      cities: 1,
    });
    expect(d.people[0].sourceRows).toEqual([5, 6]);
    expect(JSON.stringify(d.people)).not.toContain("00000000001");
    expect(d.cities[0].contracted).toBe(1);
  });
  it("preserva vínculos de unidades e municípios distintos para o mesmo CPF e admissão", () => {
    const first = person();
    first[19] = "Unidade A";
    const otherUnit = person("2");
    otherUnit[19] = "Unidade B";
    const otherCity = person("3", "00000000001", "Marabá", "PA");
    otherCity[19] = "Unidade A";
    const result = build([first, otherUnit, otherCity]);
    expect(result.summary).toMatchObject({ sourceRows: 3, uniquePeople: 1, duplicates: 0 });
    expect(result.people.map((p) => [p.unit, p.cityKey])).toEqual([
      ["Unidade A", "FORTALEZA|CE"],
      ["Unidade B", "FORTALEZA|CE"],
      ["Unidade A", "MARABA|PA"],
    ]);
  });
  it("mantém cancelamentos e em-dia da fonte fora do grupo sem ressalvas", () => {
    const cancelled = person();
    cancelled[6] = "Cancelado / N/A";
    const review = person("2", "00000000002");
    review[28] = "Conferir - em dia pela base do cliente";
    const d = build([cancelled, review, person("3", "00000000003")]);
    expect(d.summary).toMatchObject({ cancelled: 1, review: 1, listed: 1 });
  });
  it("conta só a ausência explícita como falta na cidade", () => {
    const records = ["Faltou", "Falta de CPF", "Faltou informar o CNPJ", "Cancelado?"].map(
      (status, i) => {
        const row = person(String(i + 1), String(i + 1).padStart(11, "0"));
        row[6] = status;
        return row;
      }
    );
    const result = build(records);
    expect(result.cities[0]).toMatchObject({ total: 4, cancelled: 1, review: 3 });
    expect(result.people.map((p) => p.progress)).toEqual([
      "cancelled",
      "unknown",
      "unknown",
      "unknown",
    ]);
  });
  it("não junta pessoas de admissões diferentes nem municípios de UFs diferentes", () => {
    const other = person("2");
    other[22] = "01/01/2021";
    other[2] = "SP";
    const d = build([person(), other]);
    expect(d.summary.uniquePeople).toBe(1);
    expect(d.cities).toHaveLength(2);
    expect(d.cities.find((c) => c.uf === "SP")?.contracted).toBe(0);
  });
  it("não atribui preço de uma filial a outra e mantém ambiguidade sem localidade", () => {
    const d = build(
      [person()],
      [provider(), provider("00000000000001", "Recife", "PE")],
      [price("50", "00000000000001", "A confirmar")]
    );
    expect(d.unmatchedPrices).toHaveLength(1);
    expect(d.clinics.every((c) => !c.prices.length)).toBe(true);
  });
  it("consolida repetições de CNPJ/município preservando contatos e conflitos de contrato", () => {
    const second = provider("00000000000001", "Fortaleza", "CE", "Não");
    second[5] = "(00) 9999-9999";
    const d = build([person()], [provider(), second]);
    expect(d.summary.clinics).toBe(1);
    expect(d.clinics[0].phones).toHaveLength(2);
    expect(d.clinics[0].contractConflict).toBe(true);
    expect(d.cities[0].contracted).toBe(0);
  });
  it("separa pacote, preços ausentes e limite inclusivo de R$40", () => {
    const d = build(
      [person()],
      [provider()],
      [
        price("40"),
        price("40,01"),
        price("180", undefined, undefined, "Pacote de três exames"),
        price(""),
      ]
    );
    expect(d.summary.above40).toBe(1);
    expect(d.cities[0].minClinicalCents).toBe(4000);
    expect(d.clinics[0].prices[2]).toMatchObject({ cents: 18000, clinical: false });
    expect(d.clinics[0].prices[3].cents).toBeNull();
    expect(build([person()], [provider()], [price("40")]).summary.above40).toBe(1);
    expect(build([person()], [provider()], [price("39,99")]).summary.above40).toBe(0);
  });
  it("conserva clínicas do histórico sem lhes atribuir contrato ou tarifa de outro município", () => {
    const d = build(
      [person("1", "00000000001", "Recife", "PE")],
      [provider()],
      [price("60", "00000000000002", "Recife/PE")]
    );
    const city = d.cities[0];
    expect(city.contracted).toBe(0);
    expect(city.historical).toBe(1);
    expect(city.action).toContain("Confirmar credenciamento");
    expect(d.clinics.find((c) => c.origin === "price-history")?.contractReported).toBe(false);
  });
  it("preserva prestador sem local sem contá-lo como cobertura", () => {
    const d = build(
      [person()],
      [provider("00000000000001", "", "")],
      [price("50", "00000000000001", "A confirmar")]
    );
    expect(d.clinics).toHaveLength(1);
    expect(d.cities[0].contracted).toBe(0);
  });
  it("localiza cadastro mestre por CNPJ e município sem inventar contrato", () => {
    const d = buildAvpPeriodicControl(
      [CAMPAIGN_HEADERS, person()],
      [PROVIDER_HEADERS, provider("00000000000002", "Recife", "PE")],
      [PRICE_HEADERS, price("50", "00000000000003", "A confirmar")],
      [
        {
          name: "Clínica NAI",
          type: "CLINIC",
          cnpj: "00000000000001",
          city: "Fortaleza",
          state: "CE",
          active: true,
        },
      ]
    );
    expect(d.clinics.find((c) => c.origin === "nai")).toMatchObject({
      naiRegistered: true,
      naiActive: true,
      contractReported: false,
    });
    expect(d.cities[0].action).toContain("Confirmar credenciamento");
  });
  it("rejeita cabeçalhos trocados e fonte vazia em vez de exibir um zero saudável", () => {
    expect(() => buildAvpPeriodicControl([], [], [])).toThrow();
    expect(() =>
      buildAvpPeriodicControl(
        [CAMPAIGN_HEADERS],
        [PROVIDER_HEADERS, provider()],
        [PRICE_HEADERS, price()]
      )
    ).toThrow("incompletas");
  });
});
