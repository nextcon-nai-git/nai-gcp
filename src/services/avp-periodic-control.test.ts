// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { CAMPAIGN_HEADERS, PROVIDER_HEADERS, PRICE_HEADERS } from "@/lib/avp-periodic-control";
const m = vi.hoisted(() => ({ metadata: vi.fn(), batch: vi.fn(), values: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ limit: () => ({ get: async () => ({ size: 0, docs: [] }) }) }) },
}));
vi.mock("googleapis/build/src/apis/sheets", () => ({
  auth: {
    GoogleAuth: class {
      constructor(options: unknown) {
        m.auth(options);
      }
    },
  },
  sheets: () => ({
    spreadsheets: { get: m.metadata, values: { batchGet: m.batch, get: m.values } },
  }),
}));
import { readAvpPeriodicControl } from "./avp-periodic-control";
const sources = {
  campaignSpreadsheetId: "a".repeat(30),
  accreditationSpreadsheetId: "b".repeat(30),
};
const property = (sheetId: number, title: string, columnCount: number) => ({
  properties: { sheetId, title, gridProperties: { rowCount: 10, columnCount } },
});
beforeEach(() => {
  vi.resetAllMocks();
  m.metadata.mockImplementation(async ({ spreadsheetId }) => ({
    data: {
      sheets:
        spreadsheetId === sources.campaignSpreadsheetId
          ? [property(7, "Controle", 32)]
          : spreadsheetId === sources.accreditationSpreadsheetId
            ? [property(8, "NAI Credenciamento", 24)]
            : [
                property(2026102002, "Prestadores NXC 2026", 12),
                property(2026102003, "Custos Observados AVP 2026", 11),
              ],
    },
  }));
  m.batch.mockResolvedValue({
    data: {
      valueRanges: [
        {
          values: [
            PROVIDER_HEADERS,
            [
              "Clínica sintética",
              "",
              "00000000000001",
              "Curitiba",
              "PR",
              "",
              "",
              "",
              "",
              "",
              "Sim",
              "2",
            ],
          ],
        },
        {
          values: [
            PRICE_HEADERS,
            [
              "Clínica sintética",
              "Curitiba/PR",
              "80",
              "ASO clínico",
              "Histórico",
              "2025-01-01",
              "",
              "Histórico sintético",
              "00000000000001",
              "",
              "2",
            ],
          ],
        },
      ],
    },
  });
  const row = CAMPAIGN_HEADERS.slice(0, -1).map(
    (h) =>
      ({
        ID: "1",
        Cidade: "Curitiba",
        UF: "PR",
        Nome: "Pessoa sintética",
        CPF: "00000000001",
        Status: "Agendado",
        "Dt. admissão": "01/01/2020",
        Conferência: "OK - vence",
      })[h] || ""
  );
  m.values.mockImplementation(async ({ spreadsheetId }) => ({
    data: {
      values:
        spreadsheetId === sources.campaignSpreadsheetId
          ? [[], [], [], CAMPAIGN_HEADERS.slice(0, -1), row]
          : [
              [],
              [
                "#",
                "Cidade",
                "UF",
                "STATUS",
                "NOME DA CLÍNICA QUE TRABALHAMOS",
                "CONTATO",
                "VALOR ATUAL",
                "VALOR NEGOCIADO",
                "PRAZO DE PAGAMENTO",
                "AUTORIZADO PARA AGENDAMENTO E SINALIZADO A EQUIPE?",
                "OBSREVAÇÃO",
                "CNPJ SOC",
              ],
              [
                "1",
                "Curitiba",
                "PR",
                "",
                "Clínica sintética",
                "",
                "80",
                "70",
                "",
                "Sim",
                "",
                "00000000000001",
              ],
            ],
    },
  }));
});
it("consulta as duas fontes atuais com escopo de leitura, conserva histórico e omite CPF da resposta", async () => {
  const result = await readAvpPeriodicControl(sources);
  expect(m.auth).toHaveBeenCalledWith({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  expect(m.batch.mock.calls[0][0].ranges).toHaveLength(2);
  expect(m.batch.mock.calls[0][0].ranges.join()).not.toContain("Campanha Periódicos 2026");
  expect(m.values).toHaveBeenCalledWith(
    expect.objectContaining({
      spreadsheetId: sources.campaignSpreadsheetId,
      range: "'Controle'!A1:AF10",
    }),
    expect.anything()
  );
  expect(result.people[0].progress).toBe("scheduled");
  expect(JSON.stringify(result)).not.toContain('"00000000001"');
  expect(result.clinics.flatMap((c) => c.prices).map((p) => p.cents)).toEqual([8000, 7000]);
  expect(result.cities[0].minClinicalCents).toBe(7000);
  expect(result.mapClinics?.[0].cents).toBe(7000);
  expect(result.cities[0].contracted).toBe(1);
  expect(result.clinics[0].contractConflict).toBe(false);
});
it("não troca silenciosamente a fonte atual por uma cópia quando há erro de acesso", async () => {
  m.values.mockRejectedValueOnce(new Error("403"));
  await expect(readAvpPeriodicControl(sources)).rejects.toThrow("403");
});
it("lê cabeçalhos reordenados além de AF e X com o limite real de colunas", async () => {
  const originalMetadata = m.metadata.getMockImplementation()!;
  const originalValues = m.values.getMockImplementation()!;
  m.metadata.mockImplementation(async (...args) => {
    const result = await originalMetadata(...args);
    if (
      [sources.campaignSpreadsheetId, sources.accreditationSpreadsheetId].includes(
        args[0].spreadsheetId
      )
    )
      result.data.sheets[0].properties.gridProperties.columnCount = 40;
    return result;
  });
  m.values.mockImplementation(async (...args) => {
    const result = await originalValues(...args);
    const offset = args[0].spreadsheetId === sources.campaignSpreadsheetId ? 4 : 28;
    result.data.values = result.data.values.map((row: unknown[]) => [
      ...Array(offset).fill(""),
      ...row,
    ]);
    const readWidth = args[0].range.includes(":AN") ? 40 : args[0].range.includes(":AF") ? 32 : 24;
    expect(args[0].range).toContain(":AN10");
    expect(
      result.data.values[args[0].spreadsheetId === sources.campaignSpreadsheetId ? 3 : 1].length
    ).toBeLessThanOrEqual(40);
    result.data.values = result.data.values.map((row: unknown[]) => row.slice(0, readWidth));
    return result;
  });
  const result = await readAvpPeriodicControl(sources);
  expect(result.people).toHaveLength(1);
  expect(result.clinics[0].contractReported).toBe(true);
  expect(m.values.mock.calls.map(([arg]) => arg.range)).toEqual([
    "'Controle'!A1:AN10",
    "'NAI Credenciamento'!A1:AN10",
  ]);
});
it("rejeita fontes com largura acima do limite antes de buscar os valores", async () => {
  const originalMetadata = m.metadata.getMockImplementation()!;
  m.metadata.mockImplementation(async (...args) => {
    const result = await originalMetadata(...args);
    if (args[0].spreadsheetId === sources.campaignSpreadsheetId)
      result.data.sheets[0].properties.gridProperties.columnCount = 257;
    return result;
  });
  await expect(readAvpPeriodicControl(sources)).rejects.toThrow("fora dos limites");
  expect(
    m.values.mock.calls.some(([arg]) => arg.spreadsheetId === sources.campaignSpreadsheetId)
  ).toBe(false);
});
