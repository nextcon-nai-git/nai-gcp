import { describe, it, expect } from "vitest";
import { parseAvpSourceValues } from "@/lib/avp-source-parser";
import { parseBrlCents, avpCostSummary, avpElapsedDays } from "@/lib/avp-costs";
import { buildAvpKml } from "@/lib/avp-kml-export";
import { aggregateAvpLocalities } from "@/lib/avp-geo-data";
import { AVP_TEST_ASOS } from "./avp-test-fixture";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { requireClinicalAccess } from "@/lib/auth/require-clinical-access";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { extractCityAndUf } from "@/lib/avp-sheet-importer";

const headers = [
  "Nº",
  "URGÊNCIA",
  "DATA DO PEDIDO",
  "DIAS PARADO",
  "CIDADE",
  "COLABORADOR",
  "EXAME",
  "TELEFONE DO GESTOR",
  "O QUE FAZER",
  "STATUS",
  "RESPONSÁVEL",
  "DATA AGENDADA",
  "OBSERVAÇÕES",
  "TIPO DE SOLICITAÇÃO",
  "NOME CLÍNICA",
  "TELEFONE",
  "EMAIL",
  "VALOR ASO",
  "CNPJ",
  "CHAVE PIX",
  "PIX REALIZADO?",
  "ENDEREÇO CLÌNICA",
];
const row = [
  "",
  "E-MAIL",
  "03/10/2026",
  "1",
  "Imperatriz/MA",
  "Pessoa fictícia",
  "CLÍNICO",
  "",
  "Agendar",
  "ESPERANDO CNPJ E VALOR",
  "Equipe",
  "",
  "Confirmar tabela",
  "ADMISSIONAL",
  "Clínica de teste",
  "(99) 99999-0000",
  "contato@example.test",
  "R$ 45,00",
  "cnpj de teste",
  "pix de teste",
  "NÃO",
  "Endereço de teste",
];
const context = (
  role: AuthContext["role"],
  tenantId: string | null = "GRUPO_AVP",
  servedCompanies: string[] = []
): AuthContext => ({
  uid: "test",
  role,
  tenantId,
  servedCompanies,
  email: "test@example.test",
  permissions: [],
});

describe("Leitura da fonte AVP", () => {
  it("usa o intervalo autorizado de 10 minutos", () =>
    expect(AVP_SOURCE.intervalSeconds).toBe(600));
  it("interpreta a UF acentuada sem alterar a cidade", () =>
    expect(extractCityAndUf("Oriximiná/ Pá")).toEqual({ cidade: "Oriximiná", uf: "PA" }));
  it("preserva campos distintos, status, preço e número ausente", () => {
    const { rows } = parseAvpSourceValues([headers, row]);
    expect(rows[0]).toMatchObject({
      numero: "",
      urgencia: "E-MAIL",
      status: "ESPERANDO CNPJ E VALOR",
      observacoes: "Confirmar tabela",
      oQueFazer: "Agendar",
      valorAso: "R$ 45,00",
      tipoSolicitacao: "ADMISSIONAL",
      uf: "MA",
      cnpjClinica: "cnpj de teste",
      chavePix: "pix de teste",
      sourceRow: 2,
    });
  });
  it("mantém pedidos duplicados como registros distintos", () => {
    const result = parseAvpSourceValues([headers, row, row]);
    expect(result.rows).toHaveLength(2);
    expect(new Set(result.rows.map((item) => item.id)).size).toBe(2);
    expect(result.warnings).toHaveLength(1);
  });
  it("não muda a identidade quando status e preço mudam ou a ordem muda", () => {
    const second = [...row];
    second[5] = "Outra pessoa fictícia";
    const edited = [...row];
    edited[9] = "AGENDADO";
    edited[17] = "35,00";
    const before = parseAvpSourceValues([headers, row, second]).rows;
    const after = parseAvpSourceValues([headers, second, edited]).rows;
    expect(before[0].id).toBe(after[1].id);
  });
  it("não transforma um status desconhecido em solicitação nova", () => {
    const changed = [...row];
    changed[9] = "REVISÃO ESPECIAL";
    expect(parseAvpSourceValues([headers, changed]).rows[0]).toMatchObject({
      status: "STATUS NÃO RECONHECIDO",
      statusRaw: "REVISÃO ESPECIAL",
    });
  });
  it.each(["AG. RETORNO DO GESTOR", "AG. RETORNO DO COLABORADOR", "RESGATAR ASO"])(
    "preserva o status %s",
    (status) => {
      const changed = [...row];
      changed[9] = status;
      expect(parseAvpSourceValues([headers, changed]).rows[0].status).toBe(status);
    }
  );
  it("recusa fonte vazia ou incorreta para preservar a última versão", () => {
    expect(() => parseAvpSourceValues([headers, []])).toThrow();
    expect(() => parseAvpSourceValues([["COMO USAR"], ["instrução"]])).toThrow();
  });
  it("recusa coluna ausente ou duplicada em vez de apagar campos", () => {
    const missing = [...headers];
    missing[19] = "OUTRO CAMPO";
    expect(() => parseAvpSourceValues([missing, row])).toThrow();
    expect(() => parseAvpSourceValues([[...headers, "CHAVE PIX"], row])).toThrow();
  });
});

describe("Custos, prazos e mapa", () => {
  it.each([
    ["R$ 40,00", 4000],
    ["1.250,50", 125050],
    ["45.50", 4550],
    ["0,00", 0],
    ["45 / 50", null],
    ["35 a 45", null],
    ["Não informado", null],
    ["-10", null],
    ["", null],
  ])("interpreta %s sem inventar média", (value, expected) =>
    expect(parseBrlCents(value)).toBe(expected)
  );
  it("distingue igual ao alvo, acima e custo desconhecido", () => {
    const items = ["40", "40,01", ""].map((valorAso) => ({ ...AVP_TEST_ASOS[0], valorAso }));
    expect(avpCostSummary(items)).toMatchObject({
      quoted: 2,
      missing: 1,
      aboveTarget: 1,
      grossMarginCents: -1,
    });
  });
  it("calcula o prazo na data brasileira e preserva pedidos concluídos", () => {
    const aso = {
      ...AVP_TEST_ASOS[0],
      dataPedido: "03/10/2026",
      status: "NÃO INICIADO" as const,
      diasParado: 8,
    };
    expect(avpElapsedDays(aso, new Date("2026-10-05T01:00:00Z"))).toBe(1);
    expect(
      avpElapsedDays({ ...aso, status: "EXAME FEITO" }, new Date("2026-10-05T12:00:00Z"))
    ).toBe(8);
    expect(avpElapsedDays({ ...aso, dataPedido: "31/02/2026" })).toBe(8);
  });
  it("não coloca cidade desconhecida em Brasília", () => {
    const [loc] = aggregateAvpLocalities([
      { ...AVP_TEST_ASOS[0], cidade: "Cidade ainda não confirmada", uf: "MA" },
    ]);
    expect(loc.geoKnown).toBe(false);
    expect(Number.isNaN(loc.lat)).toBe(true);
    expect(buildAvpKml(loc.asos)).not.toContain("<Point>");
  });
  it.each([
    ["Vitória", "ES"],
    ["Campo Grande", "MS"],
    ["Cuiabá", "MT"],
    ["Tubarão", "SC"],
  ])("localiza %s pela base pública municipal", (cidade, uf) => {
    const [loc] = aggregateAvpLocalities([{ ...AVP_TEST_ASOS[0], cidade, uf }]);
    expect(loc.geoKnown).toBe(true);
    expect(Number.isFinite(loc.lat)).toBe(true);
    expect(Number.isFinite(loc.lng)).toBe(true);
  });
  it("exporta custos, formas e WhatsApp sem nomes de colaboradores ou HTML injetado", () => {
    const aso = {
      ...AVP_TEST_ASOS[0],
      cidade: "Imperatriz",
      uf: "MA",
      colaborador: "SEGREDO PESSOAL",
      valorAso: "45",
      nomeClinica: "<script>alert(1)</script>",
      telefoneClinica: "(99) 99999-0000",
    };
    const kml = buildAvpKml([aso]);
    const xml = new DOMParser().parseFromString(kml, "application/xml");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(kml).toContain("#above");
    expect(kml).toContain("#alternatives");
    expect(kml).toContain("https://wa.me/");
    expect(kml).not.toContain("SEGREDO PESSOAL");
    expect(kml).not.toContain("<script>");
    expect(kml).toContain("%3F");
  });
});

describe("Isolamento de acesso", () => {
  it("nega AVP para conta sem vínculo ou ainda não liberada", () => {
    expect(() => requireAvpAccess(context("HR", "outra"))).toThrow();
    expect(() => requireAvpAccess(context("GUEST"))).toThrow();
    expect(() => requireAvpAccess(context("PROVIDER", "clinic", ["GRUPO_AVP"]))).not.toThrow();
  });
  it("nega prontuário a RH e ao médico sem vínculo", () => {
    expect(() => requireClinicalAccess(context("HR"), "GRUPO_AVP")).toThrow();
    expect(() => requireClinicalAccess(context("DOCTOR", "outra"), "GRUPO_AVP")).toThrow();
    expect(() =>
      requireClinicalAccess(context("DOCTOR", "clinic", ["GRUPO_AVP"]), "GRUPO_AVP")
    ).not.toThrow();
  });
});
