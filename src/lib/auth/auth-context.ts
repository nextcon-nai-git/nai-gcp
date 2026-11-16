export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "CLIENT_ADMIN",
  "DOCTOR",
  "NURSE",
  "ENGINEER",
  "PROVIDER",
  "SCOPED_PROVIDER",
  "COMPLIANCE",
  "HEALTH_PROFESSIONAL",
  "HR",
  "RH",
  "OPERATIONS",
  "SAFETY_TECH",
  "GUEST",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  permissions: string[];
  servedCompanies: string[];
}
