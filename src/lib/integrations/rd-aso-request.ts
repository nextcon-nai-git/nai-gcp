import type { AsoRequest, ExamType } from "../../types/aso-scheduler-types";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function canManageRdAso(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "OPERATIONS"].includes(role);
}

/** Explicit adapter contract for the RD collector's completion HTTP action. */
export function completedRdAsoText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  const labels: Record<string, string> = {
    companyName: "Empresa",
    cnpj: "CNPJ",
    employeeName: "Colaborador",
    cpf: "CPF",
    roleTitle: "Cargo",
    department: "Setor",
    examType: "Tipo de ASO",
    requestedCity: "Cidade/UF",
  };
  const lines = ["SOLICITAÇÃO DE ASO"];
  for (const [field, label] of Object.entries(labels)) {
    const item = fields[field];
    if (typeof item !== "string" || /[\r\n]/.test(item) || item.length > 200) return null;
    lines.push(label + ": " + item);
  }
  const text = lines.join("\n");
  return rdAsoRequestFromText(text, "validation", "validation", new Date().toISOString())
    ? text
    : null;
}

function validDocument(value: string, kind: "cpf" | "cnpj"): boolean {
  if (
    !new RegExp(kind === "cpf" ? "^\\d{11}$" : "^\\d{14}$").test(value) ||
    /^(\d)\1+$/.test(value)
  )
    return false;
  const base = kind === "cpf" ? 9 : 12;
  for (let size = base; size < base + 2; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const weight = kind === "cpf" ? size + 1 - i : ((size - 1 - i) % 8) + 2;
      sum += Number(value[i]) * weight;
    }
    const digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (Number(value[size]) !== digit) return false;
  }
  return true;
}

/** Only a completed, explicitly labelled request creates a card. No inference or AI. */
export function rdAsoRequestFromText(
  text: string,
  key: string,
  messageId: string,
  receivedAt: string
):
  | (AsoRequest & {
      source: "rd-conversas";
      sourceMessageId: string;
      requestedCity: string;
    })
  | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (normalize(lines[0] || "") !== "solicitacao de aso") return null;
  const fields = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const label = normalize(line.slice(0, separator));
    if (fields.has(label)) return null;
    fields.set(label, line.slice(separator + 1).trim());
  }
  const companyName = fields.get("empresa") || "";
  const employeeName = fields.get("colaborador") || "";
  const cnpj = (fields.get("cnpj") || "").replace(/[.\/\s-]/g, "");
  const cpf = (fields.get("cpf") || "").replace(/[.\s-]/g, "");
  const roleTitle = fields.get("cargo") || "";
  const department = fields.get("setor") || "";
  const requestedCity = fields.get("cidade/uf") || "";
  const types: Record<string, ExamType> = {
    admissional: "admissional",
    periodico: "periodico",
    demissional: "demissional",
    "retorno ao trabalho": "retorno_trabalho",
    retorno_trabalho: "retorno_trabalho",
    "mudanca de funcao": "mudanca_funcao",
    mudanca_funcao: "mudanca_funcao",
  };
  const examLabel = normalize(fields.get("tipo de aso") || "");
  const examType = Object.hasOwn(types, examLabel) ? types[examLabel] : undefined;
  if (
    !examType ||
    !validDocument(cnpj, "cnpj") ||
    !validDocument(cpf, "cpf") ||
    [companyName, employeeName, roleTitle, department, requestedCity].some(
      (value) => value.length < 2 || value.length > 200
    )
  )
    return null;
  return {
    id: "rd-" + key,
    companyName,
    cnpj,
    employeeName,
    cpf,
    roleTitle,
    department,
    examType,
    declaredRisks: [],
    status: "solicitado",
    exams: [],
    alerts: [],
    validationPassed: false,
    validationNotes: [
      "Solicitação recebida pelo RD Conversas. Conferir cadastro, PGR e PCMSO antes de definir exames.",
    ],
    createdAt: receivedAt,
    updatedAt: receivedAt,
    source: "rd-conversas",
    sourceMessageId: messageId,
    requestedCity,
  };
}
