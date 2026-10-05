export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CLIENT_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "ENGINEER"
  | "PROVIDER"
  | "COMPLIANCE"
  | "HEALTH_PROFESSIONAL"
  | "HR"
  | "RH"
  | "OPERATIONS"
  | "SAFETY_TECH"
  | "GUEST";

export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  permissions: string[];
  servedCompanies: string[];
}
