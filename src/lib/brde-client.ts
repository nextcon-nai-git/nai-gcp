type ClientRecord = {
  id?: string;
  name?: string;
  cnpj?: string;
  portfolioClientId?: string;
  active?: boolean;
  isDeleted?: boolean;
};

/** Consolidates only the two verified BRDE records already visible to the caller. */
export function unifyBrdeClients<T extends ClientRecord>(records: T[]) {
  const primary = records.find((record) => record.id === "92816560000137");
  const legacy = records.find((record) => record.id === "CLI_BRDE");
  const eligible = (record: T | undefined) =>
    record?.portfolioClientId === "brde" && record.active !== false && !record.isDeleted;
  const digits = (value?: string) => (value || "").replace(/\D/g, "");
  const confirmed =
    primary &&
    legacy &&
    eligible(primary) &&
    eligible(legacy) &&
    digits(primary.cnpj) === "92816560000137" &&
    ["00000000000101", "92816560000137"].includes(digits(legacy.cnpj));
  return records.flatMap((record) => {
    if (!confirmed) return [{ ...record, linkedClientRecords: [] as T[], clientSearchAliases: "" }];
    if (record.id === legacy.id) return [];
    return [
      {
        ...record,
        ...(record.id === primary.id
          ? {
              displayName: "BRDE — Banco Regional de Desenvolvimento do Extremo Sul",
              linkedClientRecords: [legacy],
              clientSearchAliases: `${legacy.name || ""} ${legacy.cnpj || ""} ${digits(legacy.cnpj)}`,
            }
          : { linkedClientRecords: [] as T[], clientSearchAliases: "" }),
      },
    ];
  });
}
