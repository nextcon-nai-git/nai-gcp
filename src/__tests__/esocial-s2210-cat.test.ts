import { describe, it, expect } from "vitest";
import { EsocialXmlBuilder, S2210Payload } from "@/services/esocial/xml-builder";
import { EsocialXmlService } from "@/services/esocial/xml-generator";

describe("eSocial S-2210 (CAT) XML Builder - Conformidade v_S_01_02_00", () => {
  const samplePayload: S2210Payload = {
    id: "ID11234567800019520260912120000",
    ideEmpregador: {
      tpInsc: 1,
      nrInsc: "12.345.678/0001-95",
    },
    ideTrabalhador: {
      cpfTrab: "123.456.789-00",
      matricula: "MAT-2024-998",
    },
    cat: {
      dtAcid: "2026-09-12",
      tpCat: 1,
      iniciatCAT: 1,
      hrAcid: "1430",
      hrsTrabAntesAcid: "0530",
      tpAcid: 1, // Típico
      codSitGeradora: "200024200", // Queda de nível
      obsCAT: "Queda de andaime com fratura de rádio distal.",
      localAcidente: {
        tpLocal: "1",
        dscLocal: "Canteiro de Obras Bloco B",
        endereco: {
          tpLogr: "Rua",
          dscLogr: "Engenheiro Carlos Rebouças",
          nrLogr: "1500",
          bairro: "Industrial",
          cep: "04571-000",
          codMunic: "3550308", // São Paulo - IBGE
          uf: "SP",
        },
      },
      parteAtingida: {
        codParteAting: "752000000", // Punho / Mão
        lateralidade: 1, // Esquerda
      },
      agenteCausador: {
        codAgntCausador: "400001200", // Andaime metálico
      },
      atestado: {
        dtAtendimento: "2026-09-12",
        hrAtendimento: "1515",
        indInternacao: "N",
        durTrat: 30, // 30 dias de afastamento
        indAfast: "S",
        dscLesao: "Fratura fechada de extremidade distal do rádio",
        codCID: "S52.5", // CID-10
        emitente: {
          nmEmit: "Dra. Mariana Orth & Associados",
          ideOC: 1, // CRM
          nrOC: "145892",
          ufOC: "SP",
        },
      },
    },
  };

  it("deve gerar XML oficial v_S_01_02_00 com namespace evtCat e identificadores sanitizados", () => {
    const xml = EsocialXmlBuilder.buildS2210(samplePayload);

    expect(xml).toContain('xmlns="http://www.esocial.gov.br/schema/evt/evtCat/v_S_01_02_00"');
    expect(xml).toContain('<evtCat Id="ID11234567800019520260912120000">');
    expect(xml).toContain("<nrInsc>12345678000195</nrInsc>");
    expect(xml).toContain("<cpfTrab>12345678900</cpfTrab>");
    expect(xml).toContain("<matricula>MAT-2024-998</matricula>");
  });

  it("deve conter todos os campos obrigatórios do evento de CAT (data, hora, tipo e situação geradora)", () => {
    const xml = EsocialXmlBuilder.buildS2210(samplePayload);

    expect(xml).toContain("<dtAcid>2026-09-12</dtAcid>");
    expect(xml).toContain("<tpCat>1</tpCat>");
    expect(xml).toContain("<iniciatCAT>1</iniciatCAT>");
    expect(xml).toContain("<hrAcid>1430</hrAcid>");
    expect(xml).toContain("<hrsTrabAntesAcid>0530</hrsTrabAntesAcid>");
    expect(xml).toContain("<tpAcid>1</tpAcid>");
    expect(xml).toContain("<codSitGeradora>200024200</codSitGeradora>");
    expect(xml).toContain("<obsCAT>Queda de andaime com fratura de rádio distal.</obsCAT>");
  });

  it("deve conter endereço estruturado do local do acidente com código IBGE", () => {
    const xml = EsocialXmlBuilder.buildS2210(samplePayload);

    expect(xml).toContain("<tpLocal>1</tpLocal>");
    expect(xml).toContain("<dscLocal>Canteiro de Obras Bloco B</dscLocal>");
    expect(xml).toContain("<dscLogr>Engenheiro Carlos Rebouças</dscLogr>");
    expect(xml).toContain("<nrLogr>1500</nrLogr>");
    expect(xml).toContain("<bairro>Industrial</bairro>");
    expect(xml).toContain("<cep>04571000</cep>");
    expect(xml).toContain("<codMunic>3550308</codMunic>");
    expect(xml).toContain("<uf>SP</uf>");
  });

  it("deve conter parte atingida (Tabela 13), agente causador (Tabela 14/15) e atestado médico com CID-10 e CRM", () => {
    const xml = EsocialXmlBuilder.buildS2210(samplePayload);

    expect(xml).toContain("<codParteAting>752000000</codParteAting>");
    expect(xml).toContain("<lateralidade>1</lateralidade>");
    expect(xml).toContain("<codAgntCausador>400001200</codAgntCausador>");

    // Atestado médico
    expect(xml).toContain("<atestado>");
    expect(xml).toContain("<dtAtendimento>2026-09-12</dtAtendimento>");
    expect(xml).toContain("<indInternacao>N</indInternacao>");
    expect(xml).toContain("<durTrat>30</durTrat>");
    expect(xml).toContain("<indAfast>S</indAfast>");
    expect(xml).toContain("<codCID>S52.5</codCID>");
    expect(xml).toContain("<nmEmit>Dra. Mariana Orth &amp; Associados</nmEmit>");
    expect(xml).toContain("<ideOC>1</ideOC>");
    expect(xml).toContain("<nrOC>145892</nrOC>");
    expect(xml).toContain("<ufOC>SP</ufOC>");
  });

  it("deve incluir bloco catOrigem quando for reabertura de CAT (tpCat = 2)", () => {
    const reaberturaPayload: S2210Payload = {
      ...samplePayload,
      cat: {
        ...samplePayload.cat,
        tpCat: 2,
        catOrigem: {
          nrRecCatOrig: "1.2.202609.12345678",
        },
      },
    };

    const xml = EsocialXmlBuilder.buildS2210(reaberturaPayload);
    expect(xml).toContain("<tpCat>2</tpCat>");
    expect(xml).toContain("<catOrigem>");
    expect(xml).toContain("<nrRecCatOrig>1.2.202609.12345678</nrRecCatOrig>");
  });

  it("deve ser compatível com EsocialXmlService.generateS2210 gerando schema completo", () => {
    const xml = EsocialXmlService.generateS2210({
      cnpjEmpregador: "12.345.678/0001-95",
      cpfTrabalhador: "123.456.789-00",
      dtAcid: "2026-09-12",
      afastamento: true,
      medicoNome: "Dr. Roberto Souza & Cia",
      codCID: "M54.5",
    });

    expect(xml).toContain("<evtCat");
    expect(xml).toContain("<nrInsc>12345678000195</nrInsc>");
    expect(xml).toContain("<cpfTrab>12345678900</cpfTrab>");
    expect(xml).toContain("<indAfast>S</indAfast>");
    expect(xml).toContain("<codCID>M54.5</codCID>");
    expect(xml).toContain("&amp; Cia");
  });
});
