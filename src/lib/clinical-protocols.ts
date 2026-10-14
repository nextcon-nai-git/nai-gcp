import {
  clinicalEngine,
  type ClinicalLineCode,
  type ResultadoLinha,
} from "@/services/clinical-rules/engine";

export interface ClinicalData {
  relato?: string;
  phq9?: number[];
  gad7?: number[];
  glicemia_jejum?: number;
  hba1c?: number;
  pas?: number;
  pad?: number;
  mrs_escore?: number;
  asa_score?: number;
  exposicao_72h?: boolean;
  risco_continuo?: boolean;
  peso?: number; // kg
  altura?: number; // metros
  idade?: number;
  sexo?: "M" | "F";
  katz_score?: number;
  fatores_risco_gestacional?: string[];
  idade_gestacional_semanas?: number;
  epds_score?: number;
  percentil_peso?: number;
  das28_score?: number;
}

/** Legacy presentation adapter. Clinical interpretation remains pending. */
export interface CareLineResult extends ResultadoLinha {
  id: string;
  title: string;
  iconType: string;
}

const presentation: Record<ClinicalLineCode, { id: string; iconType: string }> = {
  saude_mental: { id: "saude-mental", iconType: "Brain" },
  diabetes: { id: "diabetes", iconType: "Activity" },
  hipertensao: { id: "hipertensao", iconType: "HeartPulse" },
  climaterio: { id: "climaterio", iconType: "Thermometer" },
  cirurgia: { id: "risco-cirurgico", iconType: "ClipboardList" },
  prep_pep: { id: "prep-pep", iconType: "ShieldCheck" },
  obesidade: { id: "obesidade", iconType: "Scale" },
  neoplasias: { id: "neoplasias", iconType: "Search" },
  idoso: { id: "saude-idoso", iconType: "UserPlus" },
  gestacao_risco: { id: "gestacao-alto-risco", iconType: "Baby" },
  gestacao: { id: "pre-natal", iconType: "Baby" },
  puerperio: { id: "puerperio", iconType: "User" },
  puericultura: { id: "puericultura", iconType: "Baby" },
  reumatologia: { id: "reumatologia", iconType: "Bone" },
};

function summarizeCareLine(code: ClinicalLineCode, dados: ClinicalData): CareLineResult {
  const linha = clinicalEngine.linhas_disponiveis[code];
  return {
    ...presentation[code],
    title: linha.nome,
    ...linha.avaliar({ ...dados }),
  };
}

export function evaluateSaudeMental(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("saude_mental", dados);
}
export function evaluateDiabetes(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("diabetes", dados);
}
export function evaluateHipertensao(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("hipertensao", dados);
}
export function evaluateClimaterio(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("climaterio", dados);
}
export function evaluatePrePosOperatorio(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("cirurgia", dados);
}
export function evaluatePrEP_PEP(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("prep_pep", dados);
}
export function evaluateObesidade(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("obesidade", dados);
}
export function evaluateNeoplasias(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("neoplasias", dados);
}
export function evaluateEnvelhecimentoAtivo(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("idoso", dados);
}
export function evaluateGestacaoAltoRisco(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("gestacao_risco", dados);
}
export function evaluateGestacao(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("gestacao", dados);
}
export function evaluatePuerperio(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("puerperio", dados);
}
export function evaluatePuericultura(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("puericultura", dados);
}
export function evaluateReumatologia(dados: ClinicalData): CareLineResult {
  return summarizeCareLine("reumatologia", dados);
}

export function evaluateAllCareLines(dados: ClinicalData): CareLineResult[] {
  // An absent field is an explicit incomplete summary, never a negative screen.
  return [
    evaluateSaudeMental(dados),
    evaluateDiabetes(dados),
    evaluateHipertensao(dados),
    evaluateClimaterio(dados),
    evaluatePrePosOperatorio(dados),
    evaluatePrEP_PEP(dados),
    evaluateObesidade(dados),
    evaluateNeoplasias(dados),
    evaluateEnvelhecimentoAtivo(dados),
    evaluateGestacaoAltoRisco(dados),
    evaluateGestacao(dados),
    evaluatePuerperio(dados),
    evaluatePuericultura(dados),
    evaluateReumatologia(dados),
  ];
}
