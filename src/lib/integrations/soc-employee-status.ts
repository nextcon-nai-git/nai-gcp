// Classify only explicit SOC labels. Numeric codes and missing values require verification.
const other = new Set(["inativo", "demitido", "afastado", "ferias", "pendente"]);
export function socEmployeeStatus(value: string) {
  const label = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (label === "ativo") return "active";
  return other.has(label) ? "other" : "unknown";
}
