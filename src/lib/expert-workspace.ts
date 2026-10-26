/** Explicit projections: company documents can also contain commercial data. */
export const EXPERT_ROLE = "MEDICAL_EXPERT" as const;
export function expertCompanyIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === "string" &&
          id.length > 0 &&
          id.length <= 128 &&
          !/[\/\u0000]/.test(id) &&
          !["all", "nextcon", "unauthorized"].includes(id)
      )
    ),
  ];
}
function text(value: unknown, max = 300): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
export function projectExpertCompany(id: string, data: Record<string, unknown>) {
  return {
    id,
    name: text(data.name),
    cnpj: text(data.cnpj, 30),
    city: text(data.city, 100),
    state: text(data.state, 2),
  };
}
export function projectExpertTask(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: text(data.title, 500),
    status: text(data.status, 30),
    priority: text(data.priority, 30),
    dueDate: text(data.dueDate, 30),
    checklist: (Array.isArray(data.checklist) ? data.checklist : [])
      .slice(0, 200)
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({ text: text(item.text, 10000), checked: item.checked === true })),
  };
}
export type ExpertCompany = ReturnType<typeof projectExpertCompany>;
export type ExpertTask = ReturnType<typeof projectExpertTask>;
export interface ExpertWorkspace {
  companies: ExpertCompany[];
  companyId: string | null;
  tasks: ExpertTask[];
  truncated: boolean;
}
