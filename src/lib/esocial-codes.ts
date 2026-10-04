/**
 * NEXTCON PLATFORM - DICIONÁRIO ESOCIAL S-1.3
 * Mapeamento de chaves para interface humana vs códigos do Governo.
 */

export const ESOCIAL_TP_ASO = [
  { value: 1, label: "Admissional" },
  { value: 2, label: "Periódico" },
  { value: 3, label: "Retorno ao Trabalho" },
  { value: 4, label: "Mudança de Riscos Ocupacionais" },
  { value: 5, label: "Demissional" },
] as const;

export const ESOCIAL_RES_ASO = [
  { value: 1, label: "Apto" },
  { value: 2, label: "Inapto" },
] as const;

export const ESOCIAL_IND_RESULT = [
  { value: 1, label: "Normal" },
  { value: 2, label: "Alterado" },
  { value: 3, label: "Estável" },
  { value: 4, label: "Agravamento" },
] as const;

export const NR35_MANDATORY_EXAMS = [
  { code: "0449", name: "Glicemia de Jejum" },
  { code: "0462", name: "Eletrocardiograma (ECG)" },
  { code: "0724", name: "Eletroencefalograma (EEG)" },
  { code: "0349", name: "Acuidade Visual" },
];

export function getLabelByCode(list: readonly any[], code: number) {
  return list.find((item) => item.value === code)?.label || "N/I";
}
