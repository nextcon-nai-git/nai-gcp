import { describe, it, expect } from "vitest";
import { EsocialXmlService } from "@/services/esocial/xml-generator";

describe("eSocial XML Service Unit Tests", () => {
  it("deve gerar XML para o evento S-2210 (CAT) com sanitização de CNPJ/CPF", () => {
    const xml = EsocialXmlService.generateS2210({
      cnpjEmpregador: "12.345.678/0001-90",
      cpfTrabalhador: "123.456.789-00",
      dtAcid: "2026-08-20",
      tpCat: "1",
      iniciatCAT: "1",
      tpLocal: "1",
    });

    expect(xml).toContain("<nrInsc>12345678000190</nrInsc>");
    expect(xml).toContain("<cpfTrab>12345678900</cpfTrab>");
    expect(xml).toContain("<evtCat");
    expect(xml).toContain("<dtAcid>2026-08-20</dtAcid>");
  });

  it("deve gerar XML para S-2220 (ASO) escapando caracteres especiais XML", () => {
    const xml = EsocialXmlService.generateS2220({
      cnpjEmpregador: "12.345.678/0001-90",
      cpfTrabalhador: "123.456.789-00",
      dataAso: "2026-08-21",
      tipoAso: "1",
      resultadoAso: "1",
      medicoNome: "Dr. João & Dra. Maria <Cardiologia>",
      medicoCrm: "12345",
      medicoUf: "SP",
    });

    expect(xml).toContain("Dr. João &amp; Dra. Maria &lt;Cardiologia&gt;");
    expect(xml).toContain("<nrInsc>12345678000190</nrInsc>");
    expect(xml).toContain("<evtMonit");
  });

  it("deve gerar XML para S-2240 (Agentes Nocivos)", () => {
    const xml = EsocialXmlService.generateS2240({
      cnpjEmpregador: "12345678000190",
      cpfTrabalhador: "12345678900",
      dataInicio: "2026-01-01",
      ambienteNome: "Setor de Usinagem & Montagem",
      ambienteDesc: "Ambiente com ruído contínuo > 85dB",
      codigoAgente: "01.01.001",
    });

    expect(xml).toContain("<evtExpRisco");
    expect(xml).toContain("Setor de Usinagem &amp; Montagem");
    expect(xml).toContain("<codAgNoc>01.01.001</codAgNoc>");
  });
});
