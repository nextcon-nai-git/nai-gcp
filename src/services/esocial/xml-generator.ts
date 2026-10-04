/**
 * @fileOverview eSocial XML Generator Service v4.0.
 * Responsável por gerar os schemas XML oficiais do Governo Brasileiro (Versão S-1.2).
 */

import { EsocialXmlBuilder } from "./xml-builder";

export type EsocialEventType = "S2210" | "S2220" | "S2240";

export class EsocialXmlService {
  /**
   * Sanitiza CPF e CNPJ mantendo apenas números.
   */
  private static sanitizeDigits(value: string | undefined | null): string {
    return (value || "").replace(/\D/g, "");
  }

  /**
   * Escapa caracteres especiais XML para segurança do parser.
   */
  private static escapeXml(unsafe: string | undefined | null): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Gera o XML oficial completo para o evento S-2210 (Comunicação de Acidente de Trabalho - CAT).
   * Schema: http://www.esocial.gov.br/schema/evt/evtCat/v_S_01_02_00
   */
  static generateS2210(data: any): string {
    if (data.cat && data.ideEmpregador) {
      return EsocialXmlBuilder.buildS2210(data);
    }

    const cnpj = this.sanitizeDigits(data.cnpjEmpregador || "");
    const cpf = this.sanitizeDigits(data.cpfTrabalhador || "");

    return EsocialXmlBuilder.buildS2210({
      id: data.id,
      ideEmpregador: {
        tpInsc: 1,
        nrInsc: cnpj,
      },
      ideTrabalhador: {
        cpfTrab: cpf,
        matricula: data.matricula,
      },
      cat: {
        dtAcid: data.dtAcid || new Date().toISOString().split("T")[0],
        tpCat: (Number(data.tpCat) || 1) as 1 | 2 | 3,
        iniciatCAT: (Number(data.iniciatCAT) || 1) as 1 | 2 | 3,
        hrAcid: data.hrAcid || "0800",
        hrsTrabAntesAcid: data.hrsTrabAntesAcid || "0200",
        tpAcid: (Number(data.tpAcid) || 1) as 1 | 2 | 3,
        codSitGeradora: data.codSitGeradora || "200000000",
        obsCAT: data.obsCAT,
        localAcidente: {
          tpLocal: (data.tpLocal || "1") as any,
          dscLocal: data.dscLocal || "Estabelecimento do Empregador",
          endereco: data.endereco || {
            dscLogr: data.logradouro || "Avenida Principal",
            nrLogr: data.numero || "100",
            bairro: data.bairro || "Centro",
            cep: (data.cep || "01001000").replace(/\D/g, ""),
            codMunic: data.codMunic || "3550308",
            uf: data.uf || "SP",
          },
        },
        parteAtingida: {
          codParteAting: data.codParteAting || "752000000",
          lateralidade: Number(data.lateralidade !== undefined ? data.lateralidade : 3) as any,
        },
        agenteCausador: {
          codAgntCausador: data.codAgntCausador || "300000000",
        },
        atestado: data.atestado || {
          dtAtendimento:
            data.dtAtendimento || data.dtAcid || new Date().toISOString().split("T")[0],
          hrAtendimento: data.hrAtendimento || "0900",
          indInternacao: (data.indInternacao || "N") as "S" | "N",
          durTrat: Number(data.durTrat || (data.afastamento ? 15 : 0)),
          indAfast: (data.indAfast || (data.afastamento ? "S" : "N")) as "S" | "N",
          dscLesao: data.dscLesao || "Contusão/Entorse",
          codCID: data.codCID || "S60.0",
          emitente: {
            nmEmit: data.medicoNome || "Dr. Médico do Trabalho NAI",
            ideOC: 1,
            nrOC: data.medicoCrm || "123456",
            ufOC: data.medicoUf || "SP",
          },
        },
      },
    });
  }

  /**
   * Gera o XML para o evento S-2220 (Monitoramento da Saúde do Trabalhador - ASO).
   */
  static generateS2220(data: any): string {
    const cnpj = this.sanitizeDigits(data.cnpjEmpregador);
    const cpf = this.sanitizeDigits(data.cpfTrabalhador);
    const timestamp = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_02_00">
  <evtMonit Id="ID1${cnpj}${timestamp.replace(/[-:T.Z]/g, "").substring(0, 14)}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>NAI_v4.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpf}</cpfTrab>
    </ideTrabalhador>
    <aso>
      <dtAso>${this.escapeXml(data.dataAso)}</dtAso>
      <tpAso>${this.escapeXml(data.tipoAso)}</tpAso>
      <resAso>${this.escapeXml(data.resultadoAso)}</resAso>
      <medico>
        <nmMed>${this.escapeXml(data.medicoNome)}</nmMed>
        <nrCrm>${this.escapeXml(data.medicoCrm)}</nrCrm>
        <ufCrm>${this.escapeXml(data.medicoUf)}</ufCrm>
      </medico>
    </aso>
  </evtMonit>
</eSocial>`;
  }

  /**
   * Gera o XML para o evento S-2240 (Condições Ambientais - Agentes Nocivos).
   */
  static generateS2240(data: any): string {
    const cnpj = this.sanitizeDigits(data.cnpjEmpregador);
    const cpf = this.sanitizeDigits(data.cpfTrabalhador);
    return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_02_00">
  <evtExpRisco Id="ID1${cnpj}${Date.now()}">
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpf}</cpfTrab>
    </ideTrabalhador>
    <infoExpRisco>
      <dtIniCondicao>${this.escapeXml(data.dataInicio)}</dtIniCondicao>
      <infoAmb>
        <nmAmb>${this.escapeXml(data.ambienteNome)}</nmAmb>
        <dscAmb>${this.escapeXml(data.ambienteDesc)}</dscAmb>
      </infoAmb>
      <agenteNocivo>
        <codAgNoc>${this.escapeXml(data.codigoAgente)}</codAgNoc>
      </agenteNocivo>
    </infoExpRisco>
  </evtExpRisco>
</eSocial>`;
  }
}
