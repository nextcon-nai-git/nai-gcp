/**
 * eSocial drafts. S-2220 content follows S-1.3; a configured, verified signer and
 * business-rule validation are still required before any transmission.
 * Legacy S-2210/S-2240 generation stays unavailable pending current-layout validation.
 */

import { buildS2220Xml } from "./s2220";

export type EsocialEvent = "S2210" | "S2220" | "S2240";

export interface EsocialIdeEmpregador {
  tpInsc: 1 | 2; // 1: CNPJ, 2: CPF
  nrInsc: string;
}

export interface EsocialIdeTrabalhador {
  cpfTrab: string;
  matricula?: string;
  codCateg?: number;
}

export interface S2220ExamItem {
  dtExm: string;
  procRealizado: string; // Código Tabela 27 eSocial
  obsProc?: string;
  ordExame?: 1 | 2; // 1: Inicial, 2: Sequencial
}

export interface S2220AsoData {
  dtAso: string;
  tpAso: 0 | 1 | 2 | 3 | 4 | 9; // 0: Admissional, 1: Periódico, 2: Retorno, 3: Mudança Função, 4: Monitoração Pontual, 9: Demissional
  resAso?: 1 | 2; // 1: Apto, 2: Inapto
  exames: S2220ExamItem[];
  medico: {
    nmMed: string;
    nrCrm: string;
    ufCrm: string;
  };
  medicoResp?: {
    nmMed: string;
    nrCrm: string;
    ufCrm: string;
    cpfResp?: string;
  };
}

export interface S2220Payload {
  id: string;
  ideEmpregador: EsocialIdeEmpregador;
  ideTrabalhador: EsocialIdeTrabalhador;
  aso: S2220AsoData;
}

export interface S2240FatRiscoData {
  codFatRisco: string; // Tabela 24 eSocial
  dscFatRisco?: string;
  tpAval: 1 | 2; // 1: Critério quantitativo, 2: Critério qualitativo
  intConc?: string;
  unMed?: string;
  utilizEPC?: 0 | 1 | 2;
  utilizEPI?: 0 | 1 | 2;
  caEpi?: string;
}

export interface S2240Payload {
  id?: string;
  ideEmpregador: EsocialIdeEmpregador;
  ideTrabalhador: EsocialIdeTrabalhador;
  dtIniCondic: string;
  localAmb?: 1 | 2; // 1: Estabelecimento do empregador, 2: Estabelecimento de terceiros
  dscSetor?: string;
  dscAtivDes?: string;
  fatRisco: S2240FatRiscoData[];
  respReg: {
    cpfResp: string;
    ideOC: 1 | 4; // 1: CRM, 4: CREA
    nrOC: string;
    ufOC: string;
  };
}

export interface S2210CatLocalAcidente {
  tpLocal: "1" | "2" | "3" | "4" | "5" | "9";
  dscLocal?: string;
  endereco?: {
    tpLogr?: string;
    dscLogr: string;
    nrLogr: string;
    complemento?: string;
    bairro: string;
    cep: string;
    codMunic: string; // Código IBGE 7 dígitos
    uf: string;
  };
}

export interface S2210ParteAtingida {
  codParteAting: string; // Tabela 13 do eSocial
  lateralidade: 0 | 1 | 2 | 3; // 0: Não aplicável, 1: Esquerda, 2: Direita, 3: Ambas
}

export interface S2210AgenteCausador {
  codAgntCausador: string; // Tabela 14/15 do eSocial
}

export interface S2210AtestadoMedico {
  dtAtendimento: string; // YYYY-MM-DD
  hrAtendimento?: string; // HHMM
  indInternacao: "S" | "N";
  durTrat: number; // Duração em dias
  indAfast: "S" | "N";
  dscLesao?: string; // Tabela 17 do eSocial ou descrição
  codCID: string; // Código CID-10
  emitente: {
    nmEmit: string;
    ideOC: 1 | 2 | 3; // 1: CRM, 2: CRO, 3: RMS
    nrOC: string;
    ufOC: string;
  };
}

export interface S2210CatData {
  dtAcid: string; // YYYY-MM-DD
  tpCat: 1 | 2 | 3; // 1: Inicial, 2: Reabertura, 3: Óbito
  hrAcid?: string; // HHMM
  hrsTrabAntesAcid?: string; // HHMM
  tpAcid: 1 | 2 | 3; // 1: Típico, 2: Doença, 3: Trajeto
  codSitGeradora?: string; // Tabela 15 do eSocial
  iniciatCAT: 1 | 2 | 3; // 1: Empregador, 2: Ordem judicial, 3: Órgão fiscalizador
  obsCAT?: string;
  localAcidente: S2210CatLocalAcidente;
  parteAtingida: S2210ParteAtingida;
  agenteCausador: S2210AgenteCausador;
  atestado?: S2210AtestadoMedico;
  catOrigem?: {
    nrRecCatOrig: string;
  };
}

export interface S2210Payload {
  id?: string;
  ideEmpregador: EsocialIdeEmpregador;
  ideTrabalhador: EsocialIdeTrabalhador;
  cat: S2210CatData;
}

export function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class EsocialXmlBuilder {
  static buildS2210(data: S2210Payload): string {
    void data;
    throw new Error(
      "S-2210 indisponível: leiaute vigente e dados revisados da CAT ainda precisam ser validados. Nenhum XML foi emitido."
    );
  }

  /** Builds an unsigned S-2220 draft, never a signed or transmitted event. */
  static buildS2220(data: S2220Payload): string {
    return buildS2220Xml(data);
  }

  static buildS2240(data: S2240Payload): string {
    void data;
    throw new Error(
      "S-2240 indisponível: leiaute vigente e dados ambientais revisados ainda precisam ser validados. Nenhum XML foi emitido."
    );
  }

  static async signEvent(xml: string, certificateId: string): Promise<string> {
    void xml;
    void certificateId;
    throw new Error(
      "Assinatura eSocial indisponível: configure e valide um provedor e o certificado. Nenhum evento foi assinado ou transmitido."
    );
  }
}
