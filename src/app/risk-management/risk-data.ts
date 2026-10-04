/**
 * NEXTCON PLATFORM - RISK DATA REPOSITORY 2026
 * Centraliza tipagens, constantes e lógica de negócios do PGR.
 */

export const RISK_CATEGORIES = [
  "físico",
  "químico",
  "biológico",
  "ergonômico",
  "acidente",
] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export interface Risk {
  id: string;
  category: RiskCategory;
  hazard: string;
  intensity: string;
  control: string;
  ghe: string;
  probability: number; // 1-5
  severity: number; // 1-5
  status: "controlado" | "atenção" | "crítico";
  esocialSync: boolean;
  lastUpdate: string;
}

export const HEATMAP_LABELS = {
  probability: ["Rara", "Improvável", "Possível", "Provável", "Quase Certa"],
  severity: ["Insignificante", "Menor", "Moderada", "Maior", "Catastrófica"],
} as const;

export const KPI_DATA = Object.freeze({
  totalRisks: 8,
  controlled: 5,
  attention: 2,
  critical: 1,
  complianceRate: 94,
  ghesMonitored: 4,
});

export const TREND_DATA = [
  { month: "Jan", risks: 12, controlled: 8 },
  { month: "Fev", risks: 10, controlled: 9 },
  { month: "Mar", risks: 15, controlled: 10 },
  { month: "Abr", risks: 8, controlled: 7 },
  { month: "Mai", risks: 8, controlled: 8 },
];

export const RISKS: Risk[] = [
  {
    id: "R001",
    category: "físico",
    hazard: "Ruído Contínuo",
    intensity: "87 dB(A)",
    control: "Protetor Auricular Plug",
    ghe: "Operacional A",
    probability: 3,
    severity: 4,
    status: "atenção",
    esocialSync: true,
    lastUpdate: "2026-02-10",
  },
  {
    id: "R002",
    category: "ergonômico",
    hazard: "Postura Inadequada",
    intensity: "N/A",
    control: "Pausa Ativa / Ginástica",
    ghe: "Administrativo",
    probability: 2,
    severity: 3,
    status: "controlado",
    esocialSync: true,
    lastUpdate: "2026-01-15",
  },
  {
    id: "R003",
    category: "acidente",
    hazard: "Queda de Nível",
    intensity: "Alta",
    control: "Cinto 5 Pontos / NR-35",
    ghe: "Engenharia",
    probability: 4,
    severity: 5,
    status: "crítico",
    esocialSync: false,
    lastUpdate: "2026-02-20",
  },
  {
    id: "R004",
    category: "químico",
    hazard: "Poeira Mineral (Sílica)",
    intensity: "0.025 mg/m³",
    control: "Máscara PFF2",
    ghe: "Obras Laguna",
    probability: 2,
    severity: 5,
    status: "atenção",
    esocialSync: false,
    lastUpdate: "2026-02-18",
  },
];

export function getRiskScore(p: number, s: number) {
  return p * s;
}

export function getRiskLevel(score: number) {
  if (score >= 15)
    return { label: "Crítico", text: "text-rose-600", color: "bg-rose-50 border-rose-200" };
  if (score >= 10)
    return {
      label: "Substancial",
      text: "text-orange-600",
      color: "bg-orange-50 border-orange-200",
    };
  if (score >= 6)
    return { label: "Moderado", text: "text-amber-600", color: "bg-amber-50 border-amber-200" };
  return {
    label: "Tolerável",
    text: "text-emerald-600",
    color: "bg-emerald-50 border-emerald-200",
  };
}

export function getCategoryColor(category: string) {
  switch (category) {
    case "físico":
      return {
        icon: "🌡️",
        text: "text-blue-600",
        bg: "bg-blue-50",
        color: "text-blue-600 bg-blue-50",
      };
    case "químico":
      return {
        icon: "🧪",
        text: "text-purple-600",
        bg: "bg-purple-50",
        color: "text-purple-600 bg-purple-50",
      };
    case "biológico":
      return {
        icon: "🦠",
        text: "text-emerald-600",
        bg: "bg-emerald-50",
        color: "text-emerald-600 bg-emerald-50",
      };
    case "ergonômico":
      return {
        icon: "🧠",
        text: "text-orange-600",
        bg: "bg-orange-50",
        color: "text-orange-600 bg-orange-50",
      };
    case "acidente":
      return {
        icon: "⚠️",
        text: "text-rose-600",
        bg: "bg-rose-50",
        color: "text-rose-600 bg-rose-50",
      };
    default:
      return {
        icon: "📋",
        text: "text-slate-600",
        bg: "bg-slate-50",
        color: "text-slate-600 bg-slate-50",
      };
  }
}

export const getCategoryConfig = getCategoryColor;
