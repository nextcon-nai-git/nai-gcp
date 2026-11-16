export interface TimeClockEmployee {
  id: string;
  name: string;
  contractType?: string;
  regime?: string;
  type?: string;
  status?: string;
  active?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  cpf?: string;
  admissionDate?: string;
  workSchedule?: string;
  schedule?: string;
  weeklyHours?: string | number;
  employer?: {
    companyName?: string;
    cnpj?: string;
    address?: string;
    cei?: string;
    caepf?: string;
    cno?: string;
  };
  role?: string;
  jobTitle?: string;
  jobRole?: string;
  job_role?: { title?: string };
}

export function employeeCollectionPath(clientId: string, isGlobalStaff: boolean): string | null {
  if (!clientId || clientId === "unauthorized" || clientId.includes("/")) return null;
  if (clientId === "all") return isGlobalStaff ? "nxc_employees" : null;
  return `companies/${clientId}/employees`;
}

export function eligibleCltEmployee(employee: TimeClockEmployee): boolean {
  const regime = employee.contractType || employee.regime || employee.type;
  const status = typeof employee.status === "string" ? employee.status.trim().toUpperCase() : "";
  return (
    typeof employee.id === "string" &&
    !!employee.id &&
    !employee.id.includes("/") &&
    typeof employee.name === "string" &&
    !!employee.name.trim() &&
    typeof regime === "string" &&
    regime.trim().toUpperCase() === "CLT" &&
    employee.active !== false &&
    employee.isArchived !== true &&
    employee.isDeleted !== true &&
    (!status || ["ATIVO", "ATIVA", "ACTIVE"].includes(status))
  );
}

export function brasiliaDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function canRecordClockPunch(
  profile: {
    role?: unknown;
    tenantId?: unknown;
    companyId?: unknown;
    accessEnabled?: unknown;
    isDeleted?: unknown;
  },
  companyId: string
) {
  if (profile.accessEnabled === false || profile.isDeleted === true) return false;
  if (profile.role === "SUPER_ADMIN") return true;
  if (
    (profile.role === "ADMIN" || profile.role === "OPERATIONS") &&
    !profile.tenantId &&
    (!profile.companyId || profile.companyId === "nextcon")
  )
    return true;
  const tenant =
    typeof profile.tenantId === "string" && profile.tenantId.trim()
      ? profile.tenantId
      : profile.companyId;
  return (
    companyId !== "all" &&
    tenant === companyId &&
    (profile.role === "ADMIN" || profile.role === "CLIENT_ADMIN")
  );
}
