/**
 * NEXTCON PLATFORM - ENTERPRISE SCHEMA 2026
 * Core data structures for the Risk & Life Operating System.
 * Optimized for multi-tenant subcollections and ERP audit standards.
 */

export type RiskCategory = "fisico" | "quimico" | "biológico" | "ergonomico" | "acidente";
export type TaskStatus =
  | "to_review"
  | "sent"
  | "approved"
  | "implementation"
  | "started"
  | "todo"
  | "doing"
  | "review"
  | "done"
  | "archived"
  | "efficacy_check";
export type Priority = "low" | "medium" | "high" | "critical";
export type TaskType =
  | "pgr"
  | "pcmso"
  | "ltcat"
  | "treinamento"
  | "esocial"
  | "iot_check"
  | "vistoria"
  | "comercial"
  | "rnc"
  | "ambiental"
  | "emergencia"
  | "faturamento";

export type EsocialStatus = "Pendente" | "Processando" | "Enviado" | "Erro" | "Bloqueado Firewall";
export type FiscalObligationStatus = "pending" | "processing" | "delivered" | "error";
export type EsocialSyncStatus = "idle" | "syncing" | "synced" | "error";

/** Base interface for all Master Data entities with Audit capabilities */
export interface MasterEntity {
  id: string;
  createdAt: string | number | Date | { seconds: number; nanoseconds?: number };
  updatedAt?: string | number | Date | { seconds: number; nanoseconds?: number };
  createdBy?: string;
  modifiedBy?: string;
  version: string;
  isDeleted: boolean;
}

export interface ActionResult<T = unknown> {
  sucesso: boolean;
  mensagem?: string;
  erro?: string;
  dados?: T;
  relatorioId?: string;
  analise?: T;
  orcamento?: T;
  link_meet?: string;
  id_consulta?: string;
  simulado?: boolean;
}

export interface UserProfile extends MasterEntity {
  name: string;
  role: "SUPER_ADMIN" | "CLIENT_ADMIN" | "ENGINEER" | "DOCTOR" | "PROVIDER" | "COMPLIANCE";
  email: string;
  companyId?: string;
  companyName?: string;
  certificate_info?: DigitalCertificateDetails;
  servedCompanies?: string[];
  crm?: string;
  ufCrm?: string;
}

export interface DigitalCertificateDetails {
  subjectName?: string;
  issuer?: string;
  validFrom?: string;
  validUntil?: string;
  thumbprint?: string;
  serialNumber?: string;
  type?: "A1" | "A3";
}

export interface FiscalTaxBreakdown {
  inss?: number;
  irrf?: number;
  csll?: number;
  pis?: number;
  cofins?: number;
  iss?: number;
  aliquota_total?: number;
}

export interface EvtMonitPayload {
  id?: string;
  ideEmpregador?: { tpInsc: number; nrInsc: string };
  ideTrabalhador?: { cpfTrab: string; matricula?: string };
  aso?: {
    dtAso: string;
    tpAso: number;
    resAso: number;
    exame?: Array<{
      dtExm: string;
      procExm?: string;
      procRealizado?: string;
      ordExame?: number;
      ordExme?: number;
    }>;
    medico?: { nmMed: string; nrCrm: string; ufCrm: string };
  };
}

export interface Company extends MasterEntity {
  name: string;
  cnpj: string;
  risk_degree: 1 | 2 | 3 | 4;
  segment: string;
  city: string;
  state: string;
  address?: string;
  active: boolean;
  // Integração Omie
  use_omie?: boolean;
  omie_app_key?: string;
  omie_app_secret?: string;
  // Integração Senior ERP
  use_senior?: boolean;
  senior_tenant?: string;
  senior_app_key?: string;
  senior_app_secret?: string;

  esocial_enabled?: boolean;
  esocial_sync_status?: EsocialSyncStatus;
  fiscal_closing_status?: "open" | "closed";
  reinf_status?: FiscalObligationStatus;
  dctf_web_status?: FiscalObligationStatus;
  compliance_score: number;
}

export interface OpsTask extends MasterEntity {
  assigneeId?: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  companyId: string;
  companyName: string;
  responsibleId?: string;
  responsibleName?: string;
  progress?: number;
  lastComment?: string;
  cnae?: string;
  riskDegree?: number;
  isInvoiced?: boolean;
  location?: string;
  tags?: string[];
  checklist?: Array<{ id?: string; text: string; checked: boolean; mandatory?: boolean }>;
  dueDate: string;
  agentEnabled?: boolean;
  lastAgentCheck?: string | Date | { seconds: number; nanoseconds?: number };
  oldPgrUrl?: string;
  newPgrUrl?: string;
  ai_risk_score?: number;
  metrics?: {
    measuredHours?: number;
    billingValue?: number;
  };
}

export interface NursingAttendance extends MasterEntity {
  employeeId: string;
  employeeName: string;
  companyId: string;
  nurseName: string;
  coren: string;
  complaint: string;
  conduct: "observation" | "work" | "emergency";
  care_lines?: string[];
  status_esocial: EsocialStatus;
}

export type ContractType = "CLT" | "PJ" | "ESTAGIO" | "TEMPORARIO" | "JOVEM_APRENDIZ" | "AUTONOMO";
export type TerminationReason =
  "SEM_JUSTA_CAUSA" | "COM_JUSTA_CAUSA" | "PEDIDO_DEMISSAO" | "ACORDO_MUTUO" | "TERMINO_CONTRATO";

export interface SalaryChangeRecord {
  date: string;
  amount: number;
  reason: string;
  approvedBy?: string;
}

export interface VacationPeriod {
  periodStart: string;
  periodEnd: string;
  acquisitionStart?: string;
  acquisitionEnd?: string;
  status: "PLANNED" | "APPROVED" | "TAKEN" | "CANCELLED";
  days: number;
}

export interface Employee extends MasterEntity {
  name: string;
  cpf: string;
  companyId: string;
  job_role: {
    title: string;
    cbo?: string;
  };
  status: "active" | "leave" | "fired";
  // Core RH
  admissionDate?: string;
  contractType?: ContractType;
  department?: string;
  managerId?: string;
  managerName?: string;
  currentSalary?: number;
  salaryHistory?: SalaryChangeRecord[];
  vacationSchedule?: VacationPeriod[];
  terminationDate?: string;
  terminationReason?: TerminationReason;
  birthDate?: string;
  gender?: "M" | "F" | "OTHER";
  riskDegree?: 1 | 2 | 3 | 4;
  // SST e Saúde Ocupacional
  lastAsoDate?: string;
  nextAsoDate?: string;
  fitnessStatus?: "Apto" | "Inapto" | "Pendente";
  healthRisks?: string[];
  isHeightWork?: boolean;
  ai_risk_score?: number;
  // Hub de Acesso e NRs
  badgeCode?: string;
  requiredNrs?: string[]; // IDs das NRs obrigatorias (ex: ['NR-35', 'NR-10'])
  completedNrs?: Record<string, string>; // NR -> Data de Validade (ISO)
}

// NR-06: Catálogo Estruturado de EPI com Validação de C.A. (MTE)
export type PpeCategory =
  | "CABECA"
  | "OLHOS_FACE"
  | "AUDITIVO"
  | "RESPIRATORIO"
  | "TRONCO"
  | "MEMBROS_SUPERIORES"
  | "MEMBROS_INFERIORES"
  | "QUEDA"
  | "CORPO_INTEIRO";

export type CaStatus = "VALIDO" | "VENCENDO_30D" | "VENCIDO" | "CANCELADO";

export interface PpeCatalogItem {
  id: string;
  name: string;
  category: PpeCategory;
  caNumber: string;
  caExpirationDate: string; // YYYY-MM-DD
  caStatus: CaStatus;
  manufacturer: string;
  description?: string;
  compatibleRoles: string[]; // Cargos/funções vinculados
  durabilityDays?: number; // Periodicidade de troca estimada
  active: boolean;
  notes?: string;
}

export interface PpeDeliveryReceipt {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  cpfMatricula: string;
  roleName: string;
  ppeItemId: string;
  ppeName: string;
  caNumber: string;
  caExpirationDate: string;
  caStatus: CaStatus;
  manufacturer: string;
  quantity: number;
  deliveryDate: string;
  reason: "NOVA_ADMISSAO" | "SUBSTITUICAO_DESGASTE" | "EXTRAVIO" | "PERIODICA" | "MUDANCA_FUNCAO";
  signatureType: "DIGITAL" | "BIOMETRIC" | "MANUAL_SCAN";
  signatureHash?: string;
  signedAt?: string;
  signerIp?: string;
  termAccepted: boolean; // Declaração de recebimento e compromisso NR-06 item 6.6.1
  status: "ENTREGUE" | "DEVOLVIDO" | "DANIFICADO";
}

export interface TechnicalReportData {
  companyId?: string;
  companyName?: string;
  title?: string;
  reportType?: string;
  summary?: string;
  content?: string;
  authorId?: string;
  authorName?: string;
  cabecalho?: {
    empresa_consultoria?: string;
    empresa_atendida?: string;
    cnpj?: string;
    enderecos?: string[];
    responsavel_empresa?: { nome: string; cargo: string; telefone: string };
    consultor_responsavel?: string;
    datas_visita?: string[];
    horario?: string;
    tipo_visita?: string;
  };
  createdAt?: string | number | Date | { seconds: number; nanoseconds?: number };
  [key: string]: unknown;
}

export interface MedicalAppointment {
  id: string;
  employeeId?: string;
  employeeName?: string;
  colaborador_id?: string;
  colaborador_nome?: string;
  companyId?: string;
  doctorName?: string;
  crm?: string;
  asoType?:
    "Admissional" | "Periódico" | "Demissional" | "Retorno ao Trabalho" | "Mudança de Função";
  result?: "Apto" | "Inapto";
  date?: string;
  data_hora?: string;
  tipo?: string;
  status?: string;
  nextExamDate?: string;
}

export interface S2220Event {
  id?: string;
  employeeId?: string;
  companyId?: string;
  receiptNumber?: string;
  status?: EsocialStatus;
  sentAt?: string;
  evtMonit?: EvtMonitPayload;
  [key: string]: unknown;
}

export interface FiscalDocument {
  id: string;
  number: string;
  value: number;
  issueDate: string;
  companyId: string;
  companyName?: string;
  status: FiscalObligationStatus;
  type: string;
  origin?: string;
  taxes?: FiscalTaxBreakdown;
  regime?: string;
  accountingNote?: string;
  serviceDescription?: string;
  location?: string;
  isOmieSync?: boolean;
}
