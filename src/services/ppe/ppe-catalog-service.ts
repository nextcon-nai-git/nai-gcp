/**
 * NextCon Intelligence (NAI) - PPE & CA Compliance Engine (NR-06)
 * Gerencia o catálogo oficial de EPIs, validação de C.A. (MTE), vinculação por função
 * e geração de termos de entrega com assinatura digital e hash imutável.
 */

import { PpeCatalogItem, PpeDeliveryReceipt, CaStatus, PpeCategory } from "@/types/schema";
import { createHash } from "crypto";

export const INITIAL_PPE_CATALOG: PpeCatalogItem[] = [
  {
    id: "ppe_cap_classe_b",
    name: "Capacete de Segurança Classe B com Jugular de 3 Pontos",
    category: "CABECA",
    caNumber: "45678",
    caExpirationDate: "2028-11-20",
    caStatus: "VALIDO",
    manufacturer: "MSA Safety",
    description: "Proteção contra impactos e choques elétricos de até 20.000V (NR-10 e NR-18).",
    compatibleRoles: [
      "Eletricista",
      "Engenheiro Civil",
      "Operador de Máquinas",
      "Servente de Obras",
      "Mecânico",
      "Técnico de Segurança",
    ],
    durabilityDays: 365,
    active: true,
  },
  {
    id: "ppe_oculos_ampla_visao",
    name: "Óculos de Segurança Ampla Visão Antirrisco e Antiembaçante",
    category: "OLHOS_FACE",
    caNumber: "12345",
    caExpirationDate: "2027-08-15",
    caStatus: "VALIDO",
    manufacturer: "3M do Brasil",
    description:
      "Proteção contra projeção de partículas sólidas, respingos químicos e radiação UV.",
    compatibleRoles: [
      "Soldador",
      "Tornista",
      "Operador de Torno",
      "Serralheiro",
      "Pintor Industrial",
      "Servente de Obras",
    ],
    durabilityDays: 180,
    active: true,
  },
  {
    id: "ppe_protetor_concha",
    name: "Protetor Auditivo Tipo Concha 24dB NRRsf",
    category: "AUDITIVO",
    caNumber: "18234",
    caExpirationDate: "2027-04-10",
    caStatus: "VALIDO",
    manufacturer: "3M Peltor",
    description:
      "Atenuação acústica para ambientes ruidosos acima do limite de tolerância (NR-15).",
    compatibleRoles: [
      "Operador de Máquinas",
      "Caldeireiro",
      "Mecânico",
      "Operador de Usinagem",
      "Prensista",
    ],
    durabilityDays: 365,
    active: true,
  },
  {
    id: "ppe_respirador_pff2",
    name: "Respirador Semi-Facial Descartável PFF2 com Válvula",
    category: "RESPIRATORIO",
    caNumber: "38501",
    caExpirationDate: "2026-10-05",
    caStatus: "VENCENDO_30D",
    manufacturer: "Delta Plus",
    description: "Filtração de poeiras, névoas e fumos metálicos de alta toxicidade (PPR / NR-09).",
    compatibleRoles: ["Soldador", "Pintor Industrial", "Jatista", "Operador de Britador"],
    durabilityDays: 15,
    active: true,
  },
  {
    id: "ppe_luva_vaqueta",
    name: "Luva de Vaqueta Mista Cano Curto",
    category: "MEMBROS_SUPERIORES",
    caNumber: "29480",
    caExpirationDate: "2028-03-30",
    caStatus: "VALIDO",
    manufacturer: "Danny Proteção",
    description: "Proteção mecânica contra abrasão, perfuração e agentes cortantes.",
    compatibleRoles: ["Armador", "Ajudante Geral", "Montador", "Eletricista", "Motorista de Carga"],
    durabilityDays: 90,
    active: true,
  },
  {
    id: "ppe_luva_nitrilica",
    name: "Luva Nitrílica Resistente a Solventes e Óleos",
    category: "MEMBROS_SUPERIORES",
    caNumber: "34102",
    caExpirationDate: "2027-12-10",
    caStatus: "VALIDO",
    manufacturer: "Ansell Healthcare",
    description: "Impermeável para manuseio de graxas, solventes orgânicos e hidrocarbonetos.",
    compatibleRoles: ["Mecânico", "Lubrificador", "Técnico de Laboratório", "Operador Químico"],
    durabilityDays: 45,
    active: true,
  },
  {
    id: "ppe_botina_composite",
    name: "Botina de Segurança em Couro com Bico de Composite e Palmilha Antiperfuro",
    category: "MEMBROS_INFERIORES",
    caNumber: "41829",
    caExpirationDate: "2028-09-18",
    caStatus: "VALIDO",
    manufacturer: "Marluvas Calçados",
    description:
      "Solado bidensidade antiderrapante SRC, sem componentes metálicos (aprovada NR-10).",
    compatibleRoles: [
      "Eletricista",
      "Engenheiro Civil",
      "Operador de Máquinas",
      "Soldador",
      "Mecânico",
      "Servente de Obras",
    ],
    durabilityDays: 365,
    active: true,
  },
  {
    id: "ppe_cinto_paraquedista",
    name: "Cinturão de Segurança Tipo Paraquedista 4 Pontos com Talabarte Duplo Y",
    category: "QUEDA",
    caNumber: "36780",
    caExpirationDate: "2028-06-25",
    caStatus: "VALIDO",
    manufacturer: "Carbografite",
    description: "Retenção de quedas com absorvedor de energia para trabalho em altura (NR-35).",
    compatibleRoles: [
      "Montador de Estruturas",
      "Pintor Predial",
      "Telhadista",
      "Eletricista de Linha Viva",
      "Técnico de Telecom",
    ],
    durabilityDays: 365,
    active: true,
  },
];

export class PpeCatalogService {
  /**
   * Avalia a validade de um C.A. emitido pelo MTE.
   */
  static checkCaStatus(
    expirationDateIso: string,
    isCanceled: boolean = false,
    referenceDate: Date = new Date()
  ): CaStatus {
    if (isCanceled) return "CANCELADO";
    if (!expirationDateIso) return "VENCIDO";

    const expDate = new Date(expirationDateIso);
    if (isNaN(expDate.getTime())) return "VENCIDO";

    const diffDays = Math.ceil(
      (expDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 0) return "VENCIDO";
    if (diffDays <= 30) return "VENCENDO_30D";
    return "VALIDO";
  }

  /**
   * Recomenda EPIs do catálogo adequados a uma determinada função/cargo.
   */
  static getRecommendedPpeByRole(
    roleTitle: string,
    catalog: PpeCatalogItem[] = INITIAL_PPE_CATALOG
  ): PpeCatalogItem[] {
    if (!roleTitle) return catalog.filter((item) => item.active);
    const normalizedRole = roleTitle.toLowerCase().trim();

    return catalog.filter((item) => {
      if (!item.active) return false;
      return item.compatibleRoles.some((compRole) => {
        const comp = compRole.toLowerCase();
        return normalizedRole.includes(comp) || comp.includes(normalizedRole);
      });
    });
  }

  /**
   * Valida se a entrega de EPI está conforme com as exigências da NR-06.
   * Não permite entrega de C.A. vencido ou cancelado pelo Ministério do Trabalho.
   */
  static validateDeliveryCompliance(delivery: Partial<PpeDeliveryReceipt>): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!delivery.employeeName || !delivery.cpfMatricula) {
      issues.push("Identificação do colaborador (Nome e CPF/Matrícula) é obrigatória.");
    }

    if (!delivery.caNumber) {
      issues.push(
        "Número do Certificado de Aprovação (C.A.) é obrigatório conforme item 6.5.1 da NR-06."
      );
    }

    if (!delivery.caExpirationDate) {
      issues.push("Data de validade do C.A. não informada.");
    } else {
      const status = this.checkCaStatus(delivery.caExpirationDate);
      if (status === "VENCIDO") {
        issues.push(
          `INFRAÇÃO NR-06: O C.A. nº ${delivery.caNumber} está VENCIDO no Ministério do Trabalho. É proibido fornecer EPI sem C.A. válido.`
        );
      } else if (status === "CANCELADO") {
        issues.push(`INFRAÇÃO GRAVE NR-06: O C.A. nº ${delivery.caNumber} foi CANCELADO pelo MTE.`);
      }
    }

    if (!delivery.termAccepted) {
      issues.push(
        "O colaborador precisa aceitar o Termo de Guarda e Responsabilidade de EPI (NR-06 item 6.6.1)."
      );
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Gera hash imutável de assinatura digital da Ficha de EPI (SHA-256)
   * Assegura integridade jurídica e rastreabilidade perante a fiscalização do MTE.
   */
  static generateDigitalSignatureHash(payload: {
    companyId: string;
    employeeCpf: string;
    ppeName: string;
    caNumber: string;
    deliveryDate: string;
    quantity: number;
    timestamp: string;
  }): string {
    const rawString = `${payload.companyId}|${payload.employeeCpf}|${payload.ppeName}|${payload.caNumber}|${payload.deliveryDate}|${payload.quantity}|${payload.timestamp}`;
    return createHash("sha256").update(rawString).digest("hex");
  }

  /**
   * Calcula sumário de alertas de C.A.s para o painel de SST.
   */
  static calculatePpeAlerts(items: PpeCatalogItem[] = INITIAL_PPE_CATALOG) {
    let valid = 0;
    let expiringSoon = 0;
    let expiredOrCanceled = 0;

    for (const item of items) {
      const status = this.checkCaStatus(item.caExpirationDate);
      if (status === "VALIDO") valid++;
      else if (status === "VENCENDO_30D") expiringSoon++;
      else expiredOrCanceled++;
    }

    return {
      total: items.length,
      valid,
      expiringSoon,
      expiredOrCanceled,
    };
  }
}
