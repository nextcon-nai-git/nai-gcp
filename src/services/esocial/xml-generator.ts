/** eSocial drafts only. Signature and transmission require a verified integration. */
import { EsocialXmlBuilder } from "./xml-builder";
export type EsocialEventType = "S2210" | "S2220" | "S2240";
export class EsocialXmlService {
  static generateS2210(data: any): string {
    return EsocialXmlBuilder.buildS2210(data);
  }

  static generateS2220(data: any): string {
    if (data?.aso && data?.ideEmpregador) return EsocialXmlBuilder.buildS2220(data);
    return EsocialXmlBuilder.buildS2220({
      id: data?.id,
      ideEmpregador: { tpInsc: 1, nrInsc: data?.cnpjEmpregador },
      ideTrabalhador: {
        cpfTrab: data?.cpfTrabalhador,
        matricula: data?.matricula,
        codCateg: data?.codCateg,
      },
      aso: {
        dtAso: data?.dataAso,
        tpAso: (typeof data?.tipoAso === "string" && /^[0-9]$/.test(data.tipoAso)
          ? Number(data.tipoAso)
          : data?.tipoAso) as 0 | 1 | 2 | 3 | 4 | 9,
        resAso: (typeof data?.resultadoAso === "string" && /^[12]$/.test(data.resultadoAso)
          ? Number(data.resultadoAso)
          : data?.resultadoAso) as 1 | 2 | undefined,
        exames: data?.exames,
        medico: { nmMed: data?.medicoNome, nrCrm: data?.medicoCrm, ufCrm: data?.medicoUf },
        medicoResp: data?.medicoResp,
      },
    });
  }

  static generateS2240(data: any): string {
    return EsocialXmlBuilder.buildS2240(data);
  }
}
