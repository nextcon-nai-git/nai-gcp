/**
 * DADOS E REGRAS CONTRATUAIS OFICIAIS - CASSI & NXC SAÚDE
 * Contrato de Prestação de Serviços Médico-Ambulatorial (PCMSO Banco do Brasil)
 * Vigência: 01/05/2026 a 30/04/2027
 */

export interface CassiContractData {
  contractNumber: string;
  scope: string;
  ansRegister: string;
  validity: {
    start: string;
    end: string;
    durationMonths: number;
    noticeDaysForTermination: number;
  };
  client: {
    legalName: string;
    tradeName: string;
    cnpj: string;
    headquarters: string;
    city: string;
    state: string;
    cep: string;
    representative: {
      name: string;
      role: string;
      cpf: string;
    };
  };
  contractor: {
    legalName: string;
    cnpj: string;
    address: string;
    city: string;
    state: string;
    cep: string;
    representative: {
      name: string;
      role: string;
      cpf: string;
    };
    bankAccount: {
      bank: string;
      agency: string;
      account: string;
      holder: string;
    };
  };
  pricingTable: {
    code: string;
    description: string;
    value: number;
    valueFormatted: string;
    appliedTo: string[];
  }[];
  criticalSlas: {
    title: string;
    deadline: string;
    clause: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM";
    description: string;
  }[];
  bbKitAmbulatorial: {
    mandatoryItems: string[];
    noticeDaysForVisits: number;
    noticeHoursForReschedule: number;
    forceMajeureNoticeHours: number;
    strictRule: string;
  };
  financialRules: {
    paymentTermDays: number; // 45 dias
    billingPreclusionDays: number; // 90 dias
    tissStandardRequired: boolean;
    cassiGlossResponseDays: number; // 30 dias
    nxcGlossAppealDays: number; // 30 dias
  };
}

export const CASSI_OFFICIAL_CONTRACT: CassiContractData = {
  contractNumber: "",
  scope: "",
  ansRegister: "",
  validity: { start: "", end: "", durationMonths: 0, noticeDaysForTermination: 0 },
  client: {
    legalName: "",
    tradeName: "",
    cnpj: "",
    headquarters: "",
    city: "",
    state: "",
    cep: "",
    representative: { name: "", role: "", cpf: "" },
  },
  contractor: {
    legalName: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    cep: "",
    representative: { name: "", role: "", cpf: "" },
    bankAccount: { bank: "", agency: "", account: "", holder: "" },
  },
  pricingTable: [],
  criticalSlas: [],
  bbKitAmbulatorial: {
    mandatoryItems: [],
    noticeDaysForVisits: 0,
    noticeHoursForReschedule: 0,
    forceMajeureNoticeHours: 0,
    strictRule: "",
  },
  financialRules: {
    paymentTermDays: 0,
    billingPreclusionDays: 0,
    tissStandardRequired: false,
    cassiGlossResponseDays: 0,
    nxcGlossAppealDays: 0,
  },
};

export interface HealthOperationCard {
  id: string;
  serviceType: string;
  category: "EPS" | "RETORNO" | "PAVAS" | "ADMISSAO_DEMISSAO" | "PERICIA" | "PCD";
  tissCode: string;
  contractPrice: number;
  slaLimit: string;
  priority: "URGENTE" | "ALTA" | "NORMAL";
  description: string;
  requirements: string[];
}

export const HEALTH_OPERATION_CARDS: HealthOperationCard[] = [] as (
  | {
      id: string;
      serviceType: string;
      category: "RETORNO";
      tissCode: string;
      contractPrice: number;
      slaLimit: string;
      priority: "URGENTE";
      description: string;
      requirements: string[];
    }
  | {
      id: string;
      serviceType: string;
      category: "PAVAS";
      tissCode: string;
      contractPrice: number;
      slaLimit: string;
      priority: "URGENTE";
      description: string;
      requirements: string[];
    }
  | {
      id: string;
      serviceType: string;
      category: "EPS";
      tissCode: string;
      contractPrice: number;
      slaLimit: string;
      priority: "ALTA";
      description: string;
      requirements: string[];
    }
  | {
      id: string;
      serviceType: string;
      category: "ADMISSAO_DEMISSAO";
      tissCode: string;
      contractPrice: number;
      slaLimit: string;
      priority: "ALTA";
      description: string;
      requirements: string[];
    }
  | {
      id: string;
      serviceType: string;
      category: "PCD";
      tissCode: string;
      contractPrice: number;
      slaLimit: string;
      priority: "NORMAL";
      description: string;
      requirements: string[];
    }
  | {
      id: string;
      serviceType: string;
      category: "PERICIA";
      tissCode: string;
      contractPrice: number;
      slaLimit: string;
      priority: "NORMAL";
      description: string;
      requirements: string[];
    }
)[];

export interface CassiActivityItem {
  id: string;
  orderNumber: string;
  serviceType: string;
  employeeName: string;
  employeeMatricula: string;
  unitOrAgency: string;
  city: string;
  uf: string;
  date: string;
  tissCode: string;
  price: number;
  status:
    | "AGENDADO"
    | "EM_ATENDIMENTO"
    | "AGUARDANDO_PORTAL"
    | "CONCLUIDO_D0"
    | "FATURADO_TISS"
    | "GLOSA";
  guideSadtNumber: string;
  authPassword: string;
  hasGuideSignature: boolean;
  slaDeadline: string;
  isSlaOnTrack: boolean;
  medicalDoctorName: string;
  medicalDoctorCrm: string;
  notes?: string;
}

export const INITIAL_CASSI_ACTIVITIES: CassiActivityItem[] = [] as (
  | {
      id: string;
      orderNumber: string;
      serviceType: string;
      employeeName: string;
      employeeMatricula: string;
      unitOrAgency: string;
      city: string;
      uf: string;
      date: string;
      tissCode: string;
      price: number;
      status: "CONCLUIDO_D0";
      guideSadtNumber: string;
      authPassword: string;
      hasGuideSignature: true;
      slaDeadline: string;
      isSlaOnTrack: true;
      medicalDoctorName: string;
      medicalDoctorCrm: string;
      notes: string;
    }
  | {
      id: string;
      orderNumber: string;
      serviceType: string;
      employeeName: string;
      employeeMatricula: string;
      unitOrAgency: string;
      city: string;
      uf: string;
      date: string;
      tissCode: string;
      price: number;
      status: "AGUARDANDO_PORTAL";
      guideSadtNumber: string;
      authPassword: string;
      hasGuideSignature: true;
      slaDeadline: string;
      isSlaOnTrack: true;
      medicalDoctorName: string;
      medicalDoctorCrm: string;
      notes: string;
    }
  | {
      id: string;
      orderNumber: string;
      serviceType: string;
      employeeName: string;
      employeeMatricula: string;
      unitOrAgency: string;
      city: string;
      uf: string;
      date: string;
      tissCode: string;
      price: number;
      status: "FATURADO_TISS";
      guideSadtNumber: string;
      authPassword: string;
      hasGuideSignature: true;
      slaDeadline: string;
      isSlaOnTrack: true;
      medicalDoctorName: string;
      medicalDoctorCrm: string;
      notes: string;
    }
)[];
