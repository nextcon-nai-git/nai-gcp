export type CompanyLike = Partial<{
  displayName: string;
  name: string;
  companyName: string;
  razaoSocial: string;
  id: string;
}>;

export function getCompanySortLabel(company: CompanyLike | null | undefined): string {
  return (
    company?.displayName ??
    company?.name ??
    company?.companyName ??
    company?.razaoSocial ??
    company?.id ??
    ""
  );
}

export function sortCompaniesByName<T extends CompanyLike>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    getCompanySortLabel(a).localeCompare(getCompanySortLabel(b), "pt-BR", {
      sensitivity: "base",
    })
  );
}
