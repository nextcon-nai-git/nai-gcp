/**
 * NEXTCON PLATFORM - DEVELOPER HUB TYPES
 * Definições para API M2M e Webhooks.
 */

export interface ApiKeyRecord {
  id: string;
  clientId: string;
  name: string;
  keyPrefix: string; // Primeiros 16 caracteres para exibição (ex: nai_live_...)
  keyHash: string; // Hash SHA-256 da chave original
  scopes: string[]; // Ex: ['access_control:read', 'webhooks:manage']
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

export interface WebhookRecord {
  id: string;
  clientId: string;
  url: string;
  secret: string; // Chave para validação HMAC-SHA256
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

export type WebhookEvent =
  "employee.clearance_changed" | "aso.expired" | "training.expired" | "certificate.fraud_detected";

export interface AccessCheckRequest {
  cpf?: string;
  badgeCode?: string;
}

export interface AccessCheckResponse {
  allowed: boolean;
  reason: string;
  employeeName?: string;
  asoStatus?: "VALID" | "EXPIRED" | "MISSING";
  asoDueDate?: string | null;
  missingNrs?: string[];
  timestamp: string;
}
