/**
 * NEXTCON PLATFORM - REFERENCIAIS DE EXAMES 2026
 * Padrões de saúde baseados na OMS e normativas de SST.
 */

export interface ExamReference {
  code: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  category: "LAB" | "BIOMETRIC" | "SPECIAL";
}

export const EXAM_REFERENCES: Record<string, ExamReference> = {
  HEM: { code: "HEM", name: "Hemoglobina", unit: "g/dL", min: 13.5, max: 17.5, category: "LAB" },
  GLI: { code: "GLI", name: "Glicemia de Jejum", unit: "mg/dL", min: 70, max: 99, category: "LAB" },
  COL_T: {
    code: "COL_T",
    name: "Colesterol Total",
    unit: "mg/dL",
    min: 0,
    max: 190,
    category: "LAB",
  },
  TRI: { code: "TRI", name: "Triglicerídeos", unit: "mg/dL", min: 0, max: 150, category: "LAB" },
  CRE: { code: "CRE", name: "Creatinina", unit: "mg/dL", min: 0.7, max: 1.3, category: "LAB" },
  PAS: {
    code: "PAS",
    name: "P.A. Sistólica",
    unit: "mmHg",
    min: 90,
    max: 130,
    category: "BIOMETRIC",
  },
  PAD: {
    code: "PAD",
    name: "P.A. Diastólica",
    unit: "mmHg",
    min: 60,
    max: 85,
    category: "BIOMETRIC",
  },
  FRC: {
    code: "FRC",
    name: "Freq. Cardíaca",
    unit: "bpm",
    min: 60,
    max: 100,
    category: "BIOMETRIC",
  },
};

export function getExamStatus(code: string, value: number) {
  const ref = EXAM_REFERENCES[code];
  if (!ref) return "neutral";
  if (value < ref.min || value > ref.max) return "abnormal";
  return "normal";
}
