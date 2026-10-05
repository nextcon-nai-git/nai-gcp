export const RISK_CATEGORIES = [
  "fisico",
  "quimico",
  "biologico",
  "ergonomico",
  "acidente",
  "psicossocial",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export type RiskLevel = "baixo" | "moderado" | "alto" | "critico";

export interface OccupationalRisk {
  id: string;
  companyId: string;
  hazard: string;
  category: RiskCategory;
  source: string;
  ghe: string;
  exposedPeople: number | null;
  probability: number | null;
  severity: number | null;
  sourceEvidence?: { pagina: number; trecho: string };
  sourceType?: "pgr";
  controls: string;
  owner: string;
  dueDate: string;
  status: "identified" | "treating" | "controlled";
  createdAt?: unknown;
  createdBy?: string;
}

export function calculateRiskScore(probability: number, severity: number) {
  return Math.min(25, Math.max(1, probability) * Math.max(1, severity));
}
export function getDocumentedRiskScore(risk: Pick<OccupationalRisk, "probability" | "severity">) {
  return typeof risk.probability === "number" &&
    typeof risk.severity === "number" &&
    Number.isInteger(risk.probability) &&
    Number.isInteger(risk.severity) &&
    risk.probability >= 1 &&
    risk.probability <= 5 &&
    risk.severity >= 1 &&
    risk.severity <= 5
    ? calculateRiskScore(risk.probability, risk.severity)
    : null;
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 20) return "critico";
  if (score >= 12) return "alto";
  if (score >= 5) return "moderado";
  return "baixo";
}

export function getRiskLevelLabel(level: RiskLevel) {
  return {
    baixo: "Baixo",
    moderado: "Moderado",
    alto: "Alto",
    critico: "Crítico",
  }[level];
}

export function getRiskLevelColor(level: RiskLevel) {
  return {
    baixo: "bg-emerald-100 text-emerald-800",
    moderado: "bg-amber-100 text-amber-800",
    alto: "bg-orange-100 text-orange-800",
    critico: "bg-red-100 text-red-800",
  }[level];
}
