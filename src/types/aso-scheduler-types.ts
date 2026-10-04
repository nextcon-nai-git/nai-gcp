/**
 * @fileOverview Tipos e Interfaces do Agendador de ASO + Montador de Kits para Clínicas Parceiras (NAI)
 */

export type AsoPipelineStep =
  | "solicitado"
  | "validando"
  | "exames_definidos"
  | "clinica_selecionada"
  | "agendado"
  | "kit_montado"
  | "kit_enviado"
  | "clinica_confirmou"
  | "exame_realizado"
  | "aso_concluido";

export type ExamType =
  "admissional" | "periodico" | "demissional" | "retorno_trabalho" | "mudanca_funcao";

export interface ComplementaryExam {
  code: string;
  name: string;
  mandatory: "OBRIGATORIO" | "RECOMENDADO" | "CONDICIONAL";
  pcmsoJustification: string;
  patientPreparo: string;
}

export interface PartnerClinic {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  distanceKm: number;
  rating: number; // 0-5
  priceCategory: "ECONOMIC" | "STANDARD" | "PREMIUM";
  turnaroundTimeDays: number;
  supportedExams: string[];
  availableTimeSlots: string[];
  contactPhone: string;
  contactEmail: string;
  performanceScore: number; // 0-100
}

export interface DigitalKit {
  kitId: string;
  requestId: string;
  guiaNumber: string;
  generatedAt: string;
  companyDetails: {
    name: string;
    cnpj: string;
    contact: string;
  };
  employeeDetails: {
    name: string;
    cpf: string;
    roleTitle: string;
    department: string;
  };
  examType: ExamType;
  clinicDetails: {
    name: string;
    address: string;
    phone: string;
  };
  appointmentDateTime: string;
  examList: ComplementaryExam[];
  patientInstructions: string[];
  clinicInstructions: string[];
  returnDeadlineDays: number;
  asoTemplate: {
    declaredRisks: string[];
    fitnessChecklist: string;
    doctorNotes: string;
  };
  qrCodeUrl: string;
  kitSentAt?: string;
  clinicConfirmedAt?: string;
}

export interface AsoAgentAlert {
  id: string;
  requestId: string;
  agentType:
    | "TRIAGEM"
    | "PROTOCOLOS"
    | "AGENDAMENTO"
    | "MONTAGEM_KIT"
    | "COMUNICACAO"
    | "FOLLOWUP"
    | "SUPERVISOR";
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  suggestedAction: string;
  requiresHumanIntervention: boolean;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
}

export interface AsoRequest {
  id: string;
  companyName: string;
  cnpj: string;
  employeeName: string;
  cpf: string;
  roleTitle: string;
  department: string;
  examType: ExamType;
  declaredRisks: string[];
  status: AsoPipelineStep;
  clinicId?: string;
  clinicName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  exams: ComplementaryExam[];
  digitalKit?: DigitalKit;
  alerts: AsoAgentAlert[];
  validationPassed: boolean;
  validationNotes?: string[];
  createdAt: string;
  updatedAt: string;
}
