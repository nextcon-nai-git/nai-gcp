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
});
it("não troca silenciosamente a fonte atual por uma cópia quando há erro de acesso", async () => {
  m.values.mockRejectedValueOnce(new Error("403"));
  await expect(readAvpPeriodicControl(sources)).rejects.toThrow("403");
});
