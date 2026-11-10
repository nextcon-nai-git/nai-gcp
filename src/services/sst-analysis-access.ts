import "server-only";
import { requireAiAction, CLINICAL_AI_ROLES } from "@/lib/auth/ai-action";
import type { AuthContext, UserRole } from "@/lib/auth/auth-context";
import { forbidden, badRequest } from "@/lib/auth/errors";
export const technicalRoles: UserRole[] = [
  "ADMIN",
  "SUPER_ADMIN",
  "ENGINEER",
  "SAFETY_TECH",
  "COMPLIANCE",
];
export const healthRoles = CLINICAL_AI_ROLES;
export function requireAnalysisCompany(user: AuthContext, company: string) {
  if (
    typeof company !== "string" ||
    !company.trim() ||
    company !== company.trim() ||
    company.length > 128 ||
    company.includes("/") ||
    company.includes(String.fromCharCode(0)) ||
    ["all", "unauthorized", ".", ".."].includes(company)
  )
    throw badRequest("Selecione uma empresa.");
  if (
    user.tenantId ||
    (!["ADMIN", "SUPER_ADMIN"].includes(user.role) && !user.servedCompanies.includes(company))
  )
    throw forbidden("Empresa fora do escopo.");
}
export async function authorizeSst(token: string, company: string, roles: readonly UserRole[]) {
  const user = await requireAiAction(token, roles, { company });
  requireAnalysisCompany(user, company);
  return user;
}
