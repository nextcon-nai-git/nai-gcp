import { describe, it, expect } from "vitest";
import {
  formatGoogleSheetsCsvUrl,
  normalizeAsoStatus,
  extractCityAndUf,
  parseSpreadsheetText,
  mergeSpreadsheetData,
} from "@/lib/avp-sheet-importer";
import { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";

describe("AVP Sheet Sync & Importer Suite", () => {
  describe("formatGoogleSheetsCsvUrl", () => {
    it("converte URL padrão de edição do Google Sheets para endpoint CSV de exportação", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing";
      const { csvUrl, error } = formatGoogleSheetsCsvUrl(url);
      expect(error).toBeUndefined();
      expect(csvUrl).toBe(
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv"
      );
    });

    it("preserva o parâmetro gid quando a URL aponta para aba específica", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=123456789";
      const { csvUrl } = formatGoogleSheetsCsvUrl(url);
      expect(csvUrl).toContain("gid=123456789");
      expect(csvUrl).toContain("export?format=csv");
    });

    it("converte link de arquivo compartilhado do Google Drive", () => {
      const url = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing";
      const { csvUrl } = formatGoogleSheetsCsvUrl(url);
      expect(csvUrl).toBe(
        "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=csv"
      );
    });

    it("retorna erro amigável para URL inválida", () => {
      const { csvUrl, error } = formatGoogleSheetsCsvUrl("https://exemplo.com/invalido");
      expect(csvUrl).toBe("");
      expect(error).toBeDefined();
    });
  });

  describe("normalizeAsoStatus", () => {
    it("reconhece variações de AGENDADO", () => {
      expect(normalizeAsoStatus("Agendado")).toBe("AGENDADO");
      expect(normalizeAsoStatus("AGENDADO PARA 15/09")).toBe("AGENDADO");
    });

    it("reconhece variações de NÃO INICIADO", () => {
      expect(normalizeAsoStatus("Não iniciado")).toBe("NÃO INICIADO");
      expect(normalizeAsoStatus("nao iniciado")).toBe("NÃO INICIADO");
      expect(normalizeAsoStatus("pendente")).toBe("NÃO INICIADO");
    });

    it("reconhece variações de EXAME FEITO", () => {
      expect(normalizeAsoStatus("Exame Feito")).toBe("EXAME FEITO");
      expect(normalizeAsoStatus("Concluído")).toBe("EXAME FEITO");
      expect(normalizeAsoStatus("Realizado")).toBe("EXAME FEITO");
    });

    it("reconhece 2ª Via, SOC, Reagendamento e PIX", () => {
      expect(normalizeAsoStatus("2ª via ASO")).toBe("2 VIA ASO");
      expect(normalizeAsoStatus("Cadastrando no SOC")).toBe("CADASTRANDO NO SOC");
      expect(normalizeAsoStatus("Reagendar com urgência")).toBe("REAGENDAMENTO");
      expect(normalizeAsoStatus("Enviar comprovante PIX")).toBe("ENVIAR COMPROV. PAG");
      expect(normalizeAsoStatus("Gestor cancelou a vaga")).toBe("GESTOR CANCELOU");
      expect(normalizeAsoStatus("Candidato desistiu da vaga")).toBe("DESISTIU DA VAGA");
    });
  });

  describe("extractCityAndUf", () => {
    it("extrai corretamente cidade e UF de formatos variados", () => {
      expect(extractCityAndUf("Fortaleza / CE")).toEqual({ cidade: "Fortaleza", uf: "CE" });
      expect(extractCityAndUf("Acaraú - CE")).toEqual({ cidade: "Acaraú", uf: "CE" });
      expect(extractCityAndUf("São Paulo/SP")).toEqual({ cidade: "São Paulo", uf: "SP" });
      expect(extractCityAndUf("Recife")).toEqual({ cidade: "Recife", uf: "BR" });
    });
  });

  describe("parseSpreadsheetText", () => {
    it("converte texto TSV (copiado do Google Sheets / Excel com tabs) em linhas de dados", () => {
      const tsvText = `Nº\tURGÊNCIA\tCOLABORADOR\tCIDADE\tSTATUS\tRESPONSÁVEL
1\tURGENTE\tMaria Silva\tFortaleza / CE\tAGENDADO\tKELLY
2\t\tJoão Santos\tRecife / PE\tNÃO INICIADO\tLETÍCIA`;

      const rows = parseSpreadsheetText(tsvText);
      expect(rows).toHaveLength(2);
      expect(rows[0]["COLABORADOR"]).toBe("Maria Silva");
      expect(rows[0]["CIDADE"]).toBe("Fortaleza / CE");
    });

    it("converte texto CSV separado por vírgula ou ponto-e-vírgula", () => {
      const csvText = `Nº;COLABORADOR;CIDADE;STATUS
1;Carlos Lima;Sobral / CE;EXAME FEITO`;

      const rows = parseSpreadsheetText(csvText);
      expect(rows).toHaveLength(1);
      expect(rows[0]["COLABORADOR"]).toBe("Carlos Lima");
    });
  });

  describe("mergeSpreadsheetData", () => {
    const baseMockList: GrupoAvpAso[] = [
      {
        id: "avp_mock_1",
        numero: "1",
        urgencia: "NORMAL",
        urgenciaRaw: "NORMAL",
        dataPedido: "01/09/2026",
        dataPedidoIso: "2026-09-01",
        diasParado: 2,
        cidadeRaw: "Fortaleza / CE",
        cidade: "Fortaleza",
        uf: "CE",
        colaborador: "Ana Beatriz",
        tipoExame: "Admissional",
        telefoneGestor: "85999990001",
        oQueFazer: "Aguardando clínica",
        status: "NÃO INICIADO",
        responsavel: "KELLY",
        dataAgendada: "",
        dataAgendadaIso: "",
        tipoSolicitacao: "Admissional",
        nomeClinica: "",
        telefoneClinica: "",
        emailClinica: "",
        valorAso: "",
        cnpjClinica: "",
        chavePix: "",
        pixRealizado: "NÃO",
        enderecoClinica: "",
      },
      {
        id: "avp_mock_2",
        numero: "2",
        urgencia: "URGENTE",
        urgenciaRaw: "URGENTE",
        dataPedido: "02/09/2026",
        dataPedidoIso: "2026-09-02",
        diasParado: 1,
        cidadeRaw: "Carpina / PE",
        cidade: "Carpina",
        uf: "PE",
        colaborador: "Bruno Costa",
        tipoExame: "Admissional",
        telefoneGestor: "81999990002",
        oQueFazer: "Contatar clínica",
        status: "NÃO INICIADO",
        responsavel: "LETÍCIA",
        dataAgendada: "",
        dataAgendadaIso: "",
        tipoSolicitacao: "Admissional",
        nomeClinica: "",
        telefoneClinica: "",
        emailClinica: "",
        valorAso: "",
        cnpjClinica: "",
        chavePix: "",
        pixRealizado: "NÃO",
        enderecoClinica: "",
      },
    ];

    it("atualiza status e data de agendamento de ASO existente por número", () => {
      const incoming = [
        {
          Nº: "1",
          COLABORADOR: "Ana Beatriz",
          CIDADE: "Fortaleza / CE",
          STATUS: "AGENDADO",
          "DATA AGENDADA": "18/09/2026 08:30",
          "NOME CLÍNICA": "Clínica Médica Aldeota",
          "VALOR ASO": "120,00",
        },
      ];

      const result = mergeSpreadsheetData(baseMockList, incoming);

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(result.addedCount).toBe(0);

      const updatedItem = result.mergedAsos.find((a) => a.id === "avp_mock_1");
      expect(updatedItem).toBeDefined();
      expect(updatedItem?.status).toBe("AGENDADO");
      expect(updatedItem?.dataAgendada).toBe("18/09/2026 08:30");
      expect(updatedItem?.nomeClinica).toBe("Clínica Médica Aldeota");
      expect(updatedItem?.valorAso).toBe("120,00");

      // O segundo item permanece inalterado
      const secondItem = result.mergedAsos.find((a) => a.id === "avp_mock_2");
      expect(secondItem?.status).toBe("NÃO INICIADO");
    });

    it("adiciona novo colaborador quando não existe na fila", () => {
      const incoming = [
        {
          Nº: "99",
          COLABORADOR: "Novo Candidato Teste",
          CIDADE: "Sobral / CE",
          STATUS: "AGENDADO",
          RESPONSÁVEL: "KELLY",
          "DATA AGENDADA": "20/09/2026",
        },
      ];

      const result = mergeSpreadsheetData(baseMockList, incoming);

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
      expect(result.mergedAsos).toHaveLength(3);

      const newItem = result.mergedAsos.find((a) => a.colaborador === "Novo Candidato Teste");
      expect(newItem).toBeDefined();
      expect(newItem?.status).toBe("AGENDADO");
      expect(newItem?.cidade).toBe("Sobral");
      expect(newItem?.uf).toBe("CE");
    });
  });
});

describe("Importação XLSX", () => {
  it("lê cabeçalhos e linhas de um arquivo real gerado em memória", async () => {
    const { Workbook } = await import("exceljs");
    const { parseExcelBuffer } = await import("@/lib/avp-sheet-importer");
    const book = new Workbook();
    const sheet = book.addWorksheet("Fila");
    sheet.addRows([
      ["Colaborador", "Cidade", "Status"],
      ["Pessoa sintética", "Curitiba / PR", "Agendado"],
    ]);
    const bytes = await book.xlsx.writeBuffer();
    const rows = await parseExcelBuffer(bytes as unknown as ArrayBuffer);
    expect(rows).toEqual([
      { Colaborador: "Pessoa sintética", Cidade: "Curitiba / PR", Status: "Agendado" },
    ]);
  });
});
