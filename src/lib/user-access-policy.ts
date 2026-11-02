export const STAFF_ACCESS_ROLES = [
  "OPERATIONS",
  "DOCTOR",
  "NURSE",
  "ENGINEER",
  "HR",
  "SAFETY_TECH",
] as const;
export type StaffAccessRole = (typeof STAFF_ACCESS_ROLES)[number];
export type AccessSubjectKind = "provider" | "employee";
export const STAFF_ROLE_LABELS: Record<StaffAccessRole, string> = {
  OPERATIONS: "Operações internas — acesso operacional geral da NEXTCON",
  DOCTOR: "Médico — acesso clínico nas empresas autorizadas",
  NURSE: "Enfermagem — acesso clínico nas empresas autorizadas",
  ENGINEER: "Engenharia — perfil técnico na empresa autorizada",
  HR: "RH — perfil da empresa autorizada",
  SAFETY_TECH: "Técnico de segurança — perfil da empresa autorizada",
};
