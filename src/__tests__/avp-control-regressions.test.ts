import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { AVP_TEST_ASOS } from "./avp-test-fixture";
import {
  mergeSpreadsheetData,
  normalizeAsoStatus,
  parseExcelBuffer,
} from "@/lib/avp-sheet-importer";
import { buildAvpQueueCsv } from "@/lib/avp-queue-export";
import { getActiveNavigationHref, normalizeNavigationSearch } from "@/lib/navigation";

describe("Preservação da fila AVP", () => {
  const original = {
    ...AVP_TEST_ASOS[0],
    numero: "1",
    status: "AGENDADO" as const,
    urgencia: "URGENTE" as const,
    responsavel: "Atendente de teste",
    nomeClinica: "Clínica de teste",
  };

  it("uma planilha parcial não apaga status, urgência ou responsável", () => {
    const result = mergeSpreadsheetData([original], [{ Nº: "1", "Valor ASO": "35,00" }]);
    expect(result.mergedAsos[0]).toMatchObject({
      status: "AGENDADO",
      urgencia: "URGENTE",
      responsavel: original.responsavel,
      valorAso: "35,00",
    });
    expect(original).not.toHaveProperty("valorAso", "35,00");
  });

  it.each([
    { UF: "ma", Cidade: "Imperatriz", Colaborador: "Pessoa fictícia" },
    { Cidade: "Imperatriz", UF: "ma", Colaborador: "Pessoa fictícia" },
  ])("respeita a UF separada independente da ordem das colunas", (row) => {
    expect(mergeSpreadsheetData([], [row]).mergedAsos[0]).toMatchObject({
      cidade: "Imperatriz",
      uf: "MA",
    });
  });

  it("registra correções de endereço, CNPJ e PIX como atualizações", () => {
    const result = mergeSpreadsheetData(
      [
        {
          ...original,
          enderecoClinica: "Endereço antigo",
          chavePix: "pix-antigo",
          cnpjClinica: "antigo",
        },
      ],
      [
        {
          Nº: "1",
          Endereço: "Endereço corrigido",
          CNPJ: "cnpj-teste",
          PIX: "pix-teste",
          Observações: "Confirmar custo",
        },
      ]
    );
    expect(result.updatedCount).toBe(1);
    expect(result.mergedAsos[0]).toMatchObject({
      enderecoClinica: "Endereço corrigido",
      chavePix: "pix-teste",
      cnpjClinica: "cnpj-teste",
      observacoes: "Confirmar custo",
    });
    expect(result.diffLog.map((entry) => entry.campo)).toEqual(
      expect.arrayContaining(["chavePix", "cnpjClinica", "enderecoClinica"])
    );
  });

  it("não atribui a outra pessoa um número já usado", () => {
    const result = mergeSpreadsheetData(
      [original],
      [{ Nº: "1", Colaborador: "Outra pessoa fictícia", Status: "EXAME FEITO" }]
    );
    expect(result.success).toBe(false);
    expect(result.mergedAsos).toEqual([original]);
    expect(result.errors[0]).toContain("outro colaborador");
  });

  it("distingue cidades homônimas pela UF e recusa identificação ambígua", () => {
    const existing = [
      { ...original, id: "teste-sp", cidade: "Bonfim", uf: "SP", numero: "1" },
      { ...original, id: "teste-mg", cidade: "Bonfim", uf: "MG", numero: "2" },
    ];
    const result = mergeSpreadsheetData(existing, [
      { Colaborador: original.colaborador, Cidade: "Bonfim", UF: "MG", "Valor ASO": "35" },
    ]);
    expect(result.updatedCount).toBe(1);
    expect(result.mergedAsos[0].valorAso).toBe(original.valorAso);
    expect(result.mergedAsos[1].valorAso).toBe("35");
    const ambiguous = mergeSpreadsheetData(existing, [
      { Colaborador: original.colaborador, Cidade: "Bonfim", "Valor ASO": "35" },
    ]);
    expect(ambiguous.success).toBe(false);
    expect(ambiguous.mergedAsos).toEqual(existing);
    expect(ambiguous.errors[0]).toContain("mais de uma solicitação");
  });

  it("reserva os números explícitos antes de numerar pedidos novos", () => {
    const result = mergeSpreadsheetData(
      [],
      [
        { Colaborador: "Pessoa sem número", Cidade: "Imperatriz / MA" },
        { Nº: "1", Colaborador: "Pessoa numerada", Cidade: "Imperatriz / MA" },
      ]
    );
    expect(result.addedCount).toBe(2);
    expect(result.mergedAsos.map((item) => item.numero)).toEqual(["2", "1"]);
    expect(result.errors).toEqual([]);
  });

  it("ignora linhas sem identificação e não duplica o mesmo pedido no arquivo", () => {
    const result = mergeSpreadsheetData(
      [],
      [
        { Coluna: "Texto sem dados de ASO" },
        { Nº: "10", Colaborador: "Pessoa fictícia", Cidade: "Imperatriz / MA" },
        { Nº: "10", Colaborador: "Pessoa fictícia", Cidade: "Imperatriz / MA", Status: "AGENDADO" },
      ]
    );
    expect(result.addedCount).toBe(1);
    expect(result.mergedAsos).toHaveLength(1);
    expect(result.mergedAsos[0].status).toBe("AGENDADO");
    expect(result.errors).toHaveLength(1);
  });

  it.each(["Não agendado", "Exame não realizado", "Não concluído"])(
    "não confirma um exame negado: %s",
    (status) => {
      expect(normalizeAsoStatus(status)).toBe("NÃO INICIADO");
    }
  );

  it("lê datas reais de células Excel em formato brasileiro", async () => {
    const { Workbook } = await import("exceljs");
    const book = new Workbook();
    const sheet = book.addWorksheet("Fila");
    sheet.addRow(["Colaborador", "Data Pedido"]);
    sheet.addRow(["Pessoa fictícia", new Date("2026-10-04T00:00:00Z")]);
    const buffer = await book.xlsx.writeBuffer();
    const rows = await parseExcelBuffer(buffer as ArrayBuffer);
    expect(rows[0]["Data Pedido"]).toBe("04/10/2026");
  });
});

describe("Exportação AVP para Excel", () => {
  it("preserva acentos, aspas, quebras de linha e todos os contatos", () => {
    const item = {
      ...AVP_TEST_ASOS[0],
      colaborador: 'Pessoa "fictícia"; teste',
      oQueFazer: "Linha 1\nLinha 2 #referência",
      emailClinica: "clinica@example.test",
      valorAso: "39,90",
    };
    const csv = buildAvpQueueCsv([item]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [row] = Papa.parse<Record<string, string>>(csv, { header: true, delimiter: ";" }).data;
    expect(row.COLABORADOR).toBe(item.colaborador);
    expect(row["O QUE FAZER"]).toBe(item.oQueFazer);
    expect(row.EMAIL).toBe(item.emailClinica);
    expect(row["VALOR ASO"]).toBe("39,90");
    const imported = mergeSpreadsheetData([], [row]).mergedAsos[0];
    expect(imported.oQueFazer).toBe(item.oQueFazer);
    expect(imported.uf).toBe(item.uf);
  });

  it.each(["=1+1", "+COMANDO", "-COMANDO", "@COMANDO", "\t=1+1", "  =1+1"])(
    "trata como texto a fórmula %j",
    (value) => {
      const csv = buildAvpQueueCsv([{ ...AVP_TEST_ASOS[0], oQueFazer: value }]);
      const [row] = Papa.parse<Record<string, string>>(csv, { header: true, delimiter: ";" }).data;
      expect(row["O QUE FAZER"]).toBe("'" + value);
    }
  );
});

describe("Navegação de módulos", () => {
  it("destaca Grupo AVP sem marcar também Clientes", () => {
    expect(
      getActiveNavigationHref("/clients/grupo-avp", ["/", "/clients", "/clients/grupo-avp"])
    ).toBe("/clients/grupo-avp");
    expect(
      getActiveNavigationHref("/clients/empresa-teste", ["/clients", "/clients/grupo-avp"])
    ).toBe("/clients");
    expect(getActiveNavigationHref("/clients-outro", ["/clients"])).toBeNull();
  });
  it("encontra módulos mesmo sem acentos", () => {
    expect(normalizeNavigationSearch("  Saúde Ocupacional ")).toContain("saude");
  });
});
