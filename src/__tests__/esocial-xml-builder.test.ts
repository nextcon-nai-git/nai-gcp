import { describe, it, expect } from "vitest";
import {
  EsocialXmlBuilder,
  S2220Payload,
  S2240Payload,
  escapeXml,
} from "@/services/esocial/xml-builder";

describe("NAI - eSocial v.S-1.2 XML Builder Compliance Suite", () => {
  describe("escapeXml", () => {
    it("deve escapar caracteres especiais para XML válido", () => {
      expect(escapeXml("Empresa & Filhos <Ltda> \"2026\" 'Oficial'")).toBe(
        "Empresa &amp; Filhos &lt;Ltda&gt; &quot;2026&quot; &apos;Oficial&apos;"
      );
      expect(escapeXml("")).toBe("");
    });
  });

  describe("S-2220 - Monitoramento da Saúde do Trabalhador", () => {
    it("deve gerar XML oficial estruturado com namespace e tags regulamentares", () => {
      const payload: S2220Payload = {
        ideEmpregador: {
          tpInsc: 1,
          nrInsc: "12.345.678/0001-90",
        },
        ideTrabalhador: {
          cpfTrab: "123.456.789-01",
          matricula: "MAT-2026",
        },
        aso: {
          dtAso: "2026-09-12",
          tpAso: 1, // Periódico
          resAso: 1, // Apto
          medico: {
            nmMed: "Dr. Roberto Medeiros",
            nrCrm: "12345/PR",
            ufCrm: "PR",
          },
          exames: [
            { dtExm: "2026-09-10", procRealizado: "0295", ordExame: 1 },
            { dtExm: "2026-09-11", procRealizado: "0998", obsProc: "Audiometria tonal liminar" },
          ],
        },
      };

      const xml = EsocialXmlBuilder.buildS2220(payload);

      // Verificações estruturais oficiais
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_02_00"');
      expect(xml).toContain("<evtMonit");
      expect(xml).toContain("<nrInsc>12345678000190</nrInsc>");
      expect(xml).toContain("<cpfTrab>12345678901</cpfTrab>");
      expect(xml).toContain("<tpExame>1</tpExame>");
      expect(xml).toContain("<resAso>1</resAso>");
      expect(xml).toContain("<dtAso>2026-09-12</dtAso>");
      expect(xml).toContain("<nmMed>Dr. Roberto Medeiros</nmMed>");
      expect(xml).toContain("<nrCRM>12345</nrCRM>");
      expect(xml).toContain("<ufCRM>PR</ufCRM>");
      expect(xml).toContain("<procRealizado>0295</procRealizado>");
      expect(xml).toContain("<procRealizado>0998</procRealizado>");
      expect(xml).toContain("<obsProc>Audiometria tonal liminar</obsProc>");
    });
  });

  describe("S-2240 - Condições Ambientais do Trabalho - Fatores de Risco", () => {
    it("deve gerar XML oficial estruturado com agentes nocivos, CA de EPI e responsável técnico", () => {
      const payload: S2240Payload = {
        ideEmpregador: {
          tpInsc: 1,
          nrInsc: "98.765.432/0001-10",
        },
        ideTrabalhador: {
          cpfTrab: "987.654.321-09",
        },
        dtIniCondic: "2026-01-01",
        localAmb: 1,
        dscSetor: "Linha de Montagem Industrial",
        dscAtivDes: "Operação de torno CNC e solda MIG",
        fatRisco: [
          {
            codFatRisco: "01.01.001", // Ruído contínuo
            dscFatRisco: "Ruído gerado pelo maquinário industrial",
            tpAval: 1, // Quantitativo
            intConc: "87.5",
            unMed: "dB(A)",
            utilizEPC: 1,
            utilizEPI: 2,
            caEpi: "14567",
          },
        ],
        respReg: {
          cpfResp: "111.222.333-44",
          ideOC: 4, // CREA
          nrOC: "54321/D-PR",
          ufOC: "PR",
        },
      };

      const xml = EsocialXmlBuilder.buildS2240(payload);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain(
        'xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_02_00"'
      );
      expect(xml).toContain("<evtExpRisco");
      expect(xml).toContain("<nrInsc>98765432000110</nrInsc>");
      expect(xml).toContain("<cpfTrab>98765432109</cpfTrab>");
      expect(xml).toContain("<codFatRisco>01.01.001</codFatRisco>");
      expect(xml).toContain("<intConc>87.5</intConc>");
      expect(xml).toContain("<unMed>dB(A)</unMed>");
      expect(xml).toContain("<caEpi>14567</caEpi>");
      expect(xml).toContain("<cpfResp>11122233344</cpfResp>");
      expect(xml).toContain("<ideOC>4</ideOC>");
    });
  });
});
