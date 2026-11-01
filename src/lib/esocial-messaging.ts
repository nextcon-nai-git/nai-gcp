/** Client-safe contracts. Private XML, keys and certificate passwords never belong here. */
export type EsocialEnvironment = "restricted" | "production";
export type EsocialEventType = "S2210" | "S2220" | "S2240" | "S2221" | "S2230" | "S3000";
export type EsocialGrantProfile = "sst" | "toxicology";
export const ESOCIAL_MESSAGE_STATUSES = {
  draft: "Em preparação",
  approved: "Aprovado para envio",
  submitting: "Transmitindo",
  processing: "Em processamento",
  accepted: "Aceito com recibo",
  rejected: "Rejeitado",
  uncertain: "Resultado a conferir",
  external: "Histórico importado",
  superseded: "Retificado",
  excluded: "Excluído no eSocial",
  cancelled: "Rascunho cancelado",
} as const;
export type EsocialMessageStatus = keyof typeof ESOCIAL_MESSAGE_STATUSES;
export interface EsocialIssue {
  code: string;
  description: string;
  location?: string;
  type?: string;
}
export interface EsocialMessageEvent {
  id: string;
  version: number;
  companyId: string;
  companyName: string;
  employeeId: string;
  employeeName: string;
  asoCardId?: string;
  eventType: EsocialEventType;
  eventId: string;
  environment: EsocialEnvironment;
  status: EsocialMessageStatus;
  sourceReference: string;
  sourceDocumentHash?: string;
  payloadHash: string;
  payload?: Record<string, unknown>;
  layout: string;
  xsdValidated: boolean;
  businessValidation: "NOT_EVALUATED" | "ACCEPTED_BY_ESOCIAL";
  certificateId?: string;
  protocol?: string;
  receipt?: string;
  officialCode?: string;
  issues: EsocialIssue[];
  previousId?: string;
  replacesType?: EsocialEventType;
  correctionId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  approvedAt?: string;
  approvedBy?: string;
  submittedAt?: string;
  processedAt?: string;
  nextPollAt?: string;
  attempts: number;
  history?: { action: string; at: string; actor: string; version: number }[];
}
export interface EsocialCertificateStatus {
  configured: boolean;
  vaultConfigured: boolean;
  localValid: boolean;
  id?: string;
  holder?: string;
  issuer?: string;
  registration?: string;
  registrationType?: "1" | "2";
  serialNumber?: string;
  fingerprint?: string;
  validFrom?: string;
  validUntil?: string;
  uploadedAt?: string;
  verifiedInRestricted?: boolean;
  reason?: string;
}
export interface EsocialGrant {
  companyId: string;
  granteeRegistration: string;
  profiles: EsocialGrantProfile[];
  validFrom: string;
  validUntil: string;
  reference: string;
  active: boolean;
  confirmedAt: string;
  confirmedBy: string;
  /** Operator declaration, not a remote Receita authorization lookup. */
  verification: "operator_confirmed";
}
export interface EsocialMessagingCapabilities {
  certificate: EsocialCertificateStatus;
  grant: EsocialGrant | null;
  canManageCertificates: boolean;
  canManageGrants: boolean;
  productionEnabled: boolean;
  productionEligibleTypes: EsocialEventType[];
  emailToClientsEnabled: false;
  monitorConfigured: boolean;
}
export interface EsocialMessagingWorkspace {
  events: EsocialMessageEvent[];
  nextCursor: string | null;
  capabilities: EsocialMessagingCapabilities;
}
