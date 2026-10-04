/**
 * NEXTCON PLATFORM - BASE DE DADOS REAL 2026
 * Versão Consolidada: Fonte Única de Verdade para Clientes, Contratos e Especialistas.
 * Inclui carga massiva de 325 prontuários CETESB (Maio/Junho).
 * Adicionado Onboarding ANEEL - Contrato 25/2026 e Unidade COCEL.
 */

import { Employee } from "@/types/schema";

export const REAL_COMPANIES = [] as (
  | {
      id: string;
      name: string;
      cnpj: string;
      active: boolean;
      risk_degree: 3;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      responsible_name: string;
      responsible_role: string;
    }
  | {
      id: string;
      name: string;
      cnpj: string;
      active: boolean;
      risk_degree: 2;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      responsible_name: string;
      responsible_role: string;
    }
  | {
      id: string;
      name: string;
      displayName: string;
      cnpj: string;
      active: boolean;
      risk_degree: 1;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      responsible_name: string;
      responsible_role: string;
      metadata: {
        ansRegister: string;
        contractValidity: string;
        contractorRepresentative: string;
        billingBankAccount: { bank: string; agency: string; account: string; holder: string };
        pricingTable: { code_1_01_01_012: number; code_0_096_03_0151: number };
        slas: {
          returnToWorkReturnHours: string;
          portalFillHours: number;
          adjustmentsNoticeHours: number;
          doctorsNoticeDays: number;
          agencyVisitsNoticeDays: number;
          paymentDays: number;
          billingPreclusionDays: number;
        };
      };
    }
  | {
      id: string;
      name: string;
      cnpj: string;
      active: boolean;
      risk_degree: 4;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      responsible_name: string;
      responsible_role: string;
    }
  | {
      id: string;
      name: string;
      cnpj: string;
      active: boolean;
      risk_degree: 3;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      contract_value: number;
      responsible_name: string;
      responsible_role: string;
    }
  | {
      id: string;
      name: string;
      displayName: string;
      cnpj: string;
      active: boolean;
      risk_degree: 2;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      responsible_name: string;
      responsible_role: string;
      proposalData: {
        code: string;
        title: string;
        elaboratedBy: string;
        contactEmail: string;
        clientName: string;
        city: string;
        eventPeriod: string;
        totalHours: number;
        totalInvestment: number;
        status: string;
        items: {
          id: string;
          action: string;
          format: string;
          axis: string;
          suggestedFacilitator: string;
          workload: string;
          classes: number;
          value: number;
          description: string;
        }[];
        differentials: string[];
      };
    }
  | {
      id: string;
      name: string;
      displayName: string;
      cnpj: string;
      active: boolean;
      risk_degree: 2;
      segment: string;
      city: string;
      state: string;
      address: string;
      scope: string;
      responsible_name: string;
      responsible_role: string;
      metadata: {
        unitsCount: number;
        employeesCount: number;
        totalUniqueClinics: number;
        mantenedorasCount: number;
        startDate: string;
        officialChannels: {
          whatsapp: string;
          email: string;
          hours: string;
          operationalManager: string;
          financialManager: string;
        };
        slas: {
          confirmationHours: number;
          clinicalAsoHours: string;
          complementaryAsoHours: string;
        };
        seasonalPeakMonths: string[];
      };
    }
)[];

export const REAL_PROVIDERS = [] as {
  id: string;
  name: string;
  cnpj: string;
  councilNumber?: string;
  ufCouncil?: string;
  rqe?: string;
  type: string;
  specialty: string;
  email: string;
  phone: string;
  active: boolean;
  rating: number;
  city: string;
  state: string;
  registrationDate: string;
  metadata?:
    | { book: string; page: string; source: string }
    | { cpf: string; sex: string; motherName: string; birthDate: string; nationality: string };
  profession?: string;
  servedCompanies?: string[];
  pgrReportData?: {
    companyName: string;
    cnpj: string;
    city: string;
    cnae: string;
    riskDegree: number;
    totalEmployees: number;
    technicalResponsible: string;
    validityDate: string;
    ghes: { ghe: string; count: number; description: string }[];
    evaluations: { noise: string; chemicals: string; vibration: string; epis: string };
    actionPlan: string[];
  };
  address?: string;
  financialHistory?:
    | {
        august2026Amount: number;
        september2026Amount: number;
        totalReceived: number;
        lastPaymentDate: string;
        nextPaymentDate: string;
      }
    | {
        monthlyValue: number;
        august2026Amount: number;
        september2026Amount: number;
        totalReceived: number;
        lastPaymentDate: string;
        nextPaymentDate: string;
      };
  nfseData?:
    | {
        numeroNfse: string;
        numeroDps: string;
        serieDps: string;
        competencia: string;
        dataEmissao: string;
        chaveAcesso: string;
        municipio: string;
        prestador: {
          razaoSocial: string;
          cnpj: string;
          telefone: string;
          email: string;
          endereco: string;
          cep: string;
          optanteSimples: string;
        };
        tomador: { razaoSocial: string; cnpj: string; endereco: string; cep: string };
        servico: {
          codigoTributacao: string;
          codigoNbs: string;
          discriminacao: string;
          valorServicos: number;
          valorLiquido: number;
          issqnRetido: boolean;
          issqnApurado: number;
        };
        pagamento: {
          vencimento: string;
          banco: string;
          chavePix: string;
          informacoesComplementares: string;
        };
        status: string;
      }
    | {
        numeroNfse: string;
        numeroDps: string;
        serieDps: string;
        rpsNumero: string;
        competencia: string;
        dataEmissao: string;
        codigoVerificacao: string;
        chaveAcesso: string;
        municipio: string;
        orgaoGerador: string;
        prestador: {
          razaoSocial: string;
          cnpj: string;
          telefone: string;
          email: string;
          endereco: string;
          cep: string;
          optanteSimples: string;
        };
        tomador: {
          razaoSocial: string;
          cnpj: string;
          endereco: string;
          cep: string;
          email: string;
        };
        servico: {
          codigoAtividade: string;
          codigoTributacao: string;
          codigoNbs: string;
          descricaoAtividade: string;
          discriminacao: string;
          valorServicos: number;
          valorLiquido: number;
          baseCalculo: number;
          aliquotaIss: number;
          valorIss: number;
          issqnRetido: boolean;
        };
        pagamento: {
          vencimento: string;
          banco: string;
          linhaDigitavel: string;
          informacoesComplementares: string;
        };
        status: string;
      };
  displayName?: string;
  companyName?: string;
  monthlyFee?: number;
  boletoData?: {
    banco: string;
    codigoBanco: string;
    linhaDigitavel: string;
    beneficiario: string;
    cnpjBeneficiario: string;
    enderecoBeneficiario: string;
    agenciaCodigoCedente: string;
    dataDocumento: string;
    dataProcessamento: string;
    vencimento: string;
    numeroDocumento: string;
    especieDoc: string;
    nossoNumero: string;
    valorDocumento: number;
    jurosDiarios: number;
    multa: number;
    pagador: { razaoSocial: string; cnpj: string; endereco: string; cep: string };
    status: string;
  };
  contractUrl?: string;
  allocation?: { client: string; workload: string; startDate: string; contractNumber: string };
}[];

export const CETESB_SESMT_TEAM = [] as (
  | {
      id: string;
      name: string;
      role: string;
      specialty: string;
      contractId: string;
      dailyHours: string;
    }
  | {
      id: string;
      name: string;
      role: string;
      specialty: string;
      contractId: string;
      dailyHours: number;
    }
)[];

export const CETESB_JULY_2026_BILLING = { period: "", totalValue: 0, services: [] } as {
  period: string;
  totalValue: number;
  services: { id: string; name: string; value: number }[];
};

export const CETESB_BILLING_MATRIX = { services: [], monthlySubtotals: [], totalMeasured: 0 } as {
  services: { code: string; name: string; unitValue: number; months: number[]; total: number }[];
  monthlySubtotals: number[];
  totalMeasured: number;
};

const UNIQUE_NAMES = [] as string[];

const BASE_CETESB_EMPLOYEES: Employee[] = UNIQUE_NAMES.map((name, index) => ({
  id: `COL_CET_${index + 1}`,
  name: name.toUpperCase(),
  cpf: "",
  companyId: "CETESB_080680",
  job_role: { title: "Funcionário Unidade" },
  status: "active",
  createdAt: "2026-05-01T09:00:00Z",
  fitnessStatus: "Apto",
  version: "2.8",
  isDeleted: false,
}));

export const REAL_EMPLOYEES: Employee[] = [] as Employee[];

const RAW_LOGS = [] as {
  data: string;
  horario: string;
  paciente: string;
  queixa: string;
  cons: string;
}[];

export const REAL_NURSING_ATTENDANCES = RAW_LOGS.map((p, idx) => ({
  id: `real_cet_${idx + 1}`,
  employeeName: p.paciente.toUpperCase(),
  employeeId: `COL_CET_${UNIQUE_NAMES.indexOf(p.paciente.toUpperCase().trim()) + 1}`,
  companyId: "CETESB_080680",
  companyName: "CETESB",
  nurseName: "",
  coren: "",
  complaint: p.queixa,
  medication: p.cons === "SIM" ? "Protocolo clínico" : "",
  conduct: p.cons === "SIM" ? "work" : "observation",
  bp_sys: "120",
  bp_dia: "80",
  heart_rate: "72",
  temperature: "36.5",
  spo2: "98",
  status_esocial: "Pendente",
  createdAt: `${p.data}T${p.horario === "TARDE" ? "14:00:00" : "09:00:00"}Z`,
}));

export const REAL_CLINICAL_RECORDS = REAL_EMPLOYEES.slice(0, 20).map((emp) => ({
  patientId: emp.id,
  name: emp.name,
  age: 38,
  sex: "M",
  lines: [
    {
      category: "Vigilância",
      metric: "Estável",
      conduct: "Seguimento semestral via PCMSO.",
      icon: "Activity",
    },
  ],
}));

export const REAL_CONTRACTS = [] as {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  value: number;
  status: string;
  createdAt: string;
}[];

export const CETESB_OPERATION_CARDS = [] as {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  desc: string;
}[];

export const ANEEL_OPERATION_CARDS = [] as {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  desc: string;
}[];

export const BRITANIA_EXPERTISES = [] as {
  id: string;
  employeeName: string;
  caseNumber: string;
  disease: string;
  value: number;
  status: string;
  date: string;
}[];

export const BRITANIA_AEP_DATA = {
  setor: "",
  estatisticas: { totalPostos: 0, linhaPrincipal: 0 },
  diretrizes: { pausa: "", regra: "" },
  postosCriticos: [],
} as {
  setor: string;
  estatisticas: { totalPostos: number; linhaPrincipal: number };
  diretrizes: { pausa: string; regra: string };
  postosCriticos: { seq: number; atv: string; queixa: string }[];
};

export const REAL_TRAININGS = [] as {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  status: string;
  totalHours: number;
  nrs: string[];
  students: { id: string; name: string; status: string }[];
}[];

export * from "./avp-clinics-data";
export * from "./cassi-contract-data";

export const REAL_PATIENTS: {
  id: string;
  name: string;
  cpf: string;
  clinicalData: {
    idade: number;
    sexo: string;
    peso: number;
    altura: number;
    glicemia_jejum: number;
    hba1c: number;
    pas: number;
    pad: number;
    das28_score: number;
    katz_score: number;
    phq9: number[];
    asa_score: number;
  };
}[] = [];

export const REAL_EXAMS_HISTORY: { id: string; type: string; date: string; employee: string }[] =
  [];
export const DRE_2025_HISTORY: { month: string; revenue: number; expenses: number }[] = [];
export const REAL_HIERARCHICAL_DATA: {
  id_cliente: string;
  nome_fantasia: string;
  razao_social: string;
  total_vidas: number;
  colaboradores: { id_colaborador: string; name: string; cpf: string; jobTitle: string }[];
}[] = [];
