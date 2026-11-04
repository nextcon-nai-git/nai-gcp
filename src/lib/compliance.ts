export const CATEGORIAS_COMPLIANCE = {
  assedio_moral: { nome: "Assédio Moral / Abuso de Poder", severidade: "Média-Alta" },
  assedio_sexual: { nome: "Assédio Sexual", severidade: "Crítica" },
  fraude_corrupcao: { nome: "Fraude, Roubo ou Corrupção", severidade: "Crítica" },
  conflito_interesses: { nome: "Conflito de Interesses", severidade: "Média" },
  discriminacao: { nome: "Discriminação", severidade: "Alta" },
  seguranca_meio_ambiente: { nome: "Riscos SST / NRs", severidade: "Alta" },
  vazamento_dados: { nome: "Violação da LGPD", severidade: "Média-Alta" },
} as const;

export type ComplianceCategory = keyof typeof CATEGORIAS_COMPLIANCE;

export type ComplianceReportInput = {
  isAnonimo: boolean;
  nome: string;
  email: string;
  categoria: ComplianceCategory | "";
  descricao: string;
  dataFato: string;
  local: string;
};
