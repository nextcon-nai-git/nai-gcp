import "server-only";
import { NextRequest } from "next/server";
import { requireAuth } from "./require-auth";
import { forbidden, badRequest } from "./errors";
import type { UserRole } from "./auth-context";

export const DOCUMENT_AI_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS",
  "ENGINEER",
  "SAFETY_TECH",
  "DOCTOR",
  "NURSE",
  "HEALTH_PROFESSIONAL",
  "COMPLIANCE",
  "CLIENT_ADMIN",
  "HR",
  "RH",
];
export const CLINICAL_AI_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DOCTOR",
  "NURSE",
  "HEALTH_PROFESSIONAL",
];
export const FINANCIAL_AI_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "COMPLIANCE"];

/** Authenticate before parsing or sending caller-supplied data to an AI provider.
 * Database reads still require their own tenant/clinical authorization.
 * Tokens are separate arguments and must never enter prompts or telemetry payloads.
 */
export async function requireAiAction(
  idToken: string | undefined,
  roles: readonly UserRole[],
  input: unknown
) {
  const user = await requireAuth(
    new NextRequest("https://nai.local/action", {
      headers: { authorization: `Bearer ${typeof idToken === "string" ? idToken : ""}` },
    })
  );
  if (!roles.includes(user.role)) throw forbidden("Seu perfil não pode executar esta análise.");
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw badRequest("Dados inválidos para análise.");
  }
  if (!serialized || serialized.length > 14_000_000)
    throw badRequest("Dados ausentes ou acima do limite de análise.");
  return user;
}
