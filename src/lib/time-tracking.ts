export interface TimeClockEmployee {
  id: string;
  name: string;
  contractType?: string;
  regime?: string;
  type?: string;
  status?: string;
  active?: boolean;
  cpf?: string;
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
