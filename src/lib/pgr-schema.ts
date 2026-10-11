import { z } from "zod";

export const PGR_VERSION = "pgr-evidence-v1";
export const PGR_MAX_FILE_BYTES = 12 * 1024 * 1024;
export const PGR_AGENT_ROLES = [
  "engenheiro_seguranca",
  "tecnico_seguranca",
  "medico_trabalho",
  "enfermeiro_trabalho",
  "ergonomista",
] as const;
export const PGR_AGENT_NAMES: Record<(typeof PGR_AGENT_ROLES)[number], string> = {
  engenheiro_seguranca: "Engenheiro de Segurança",
  tecnico_seguranca: "Técnico de Segurança do Trabalho",
  medico_trabalho: "Médico do Trabalho",
  enfermeiro_trabalho: "Enfermeiro do Trabalho",
  ergonomista: "Ergonomista",
};
export const PgrEvidenceSchema = z.object({
  pagina: z.number().int().min(1).max(300),
  trecho: z.string().min(3).max(1200),
});
export const NAI_DOCUMENT_TYPES = [
  "PGR",
  "LTCAT",
  "PCMSO",
  "ASO",
  "PERICIA_MEDICA",
  "AEP",
  "AET",
  "DADOS_ERGONOMICOS",
  "OUTRO",
] as const;
export type NaiDocumentType = (typeof NAI_DOCUMENT_TYPES)[number];
export const NAI_DOCUMENT_NAMES: Record<NaiDocumentType, string> = {
  PGR: "PGR",
  LTCAT: "LTCAT",
  PCMSO: "PCMSO",
  ASO: "ASO",
  PERICIA_MEDICA: "Perícia médica",
  AEP: "AEP",
  AET: "AET",
  DADOS_ERGONOMICOS: "Dados ergonômicos",
  OUTRO: "Documento a identificar",
};
export const NaiDocumentSchema = z.object({
  tipo: z.enum(NAI_DOCUMENT_TYPES),
  agenteResponsavel: z.enum(PGR_AGENT_ROLES).nullable(),
  statusClassificacao: z.enum(["identificado", "ambiguo", "nao_identificado"]),
  evidencias: z.array(PgrEvidenceSchema).max(10),
  justificativa: z.string().max(800),
  acesso: z.enum(["sst", "clinico_restrito"]),
});
export type NaiDocument = z.infer<typeof NaiDocumentSchema>;
export const NaiProviderSchema = z.object({
  id: z.string().max(100),
  nome: z.string().min(3).max(300),
  cnpj: z.string().max(30),
  registroProfissional: z.string().max(160),
  especialidade: z.string().max(180),
  papelNoDocumento: z.string().max(180),
  evidencias: z.array(PgrEvidenceSchema).min(1).max(5),
  cidadeUf: z.string().max(120),
  endereco: z.string().max(500),
  email: z.string().max(200),
  telefone: z.string().max(100),
});
export type NaiProvider = z.infer<typeof NaiProviderSchema>;
export const NaiAgentAnalysisSchema = z.object({
  agente: z.enum(PGR_AGENT_ROLES).nullable(),
  status: z.enum(["concluida", "pendente", "indisponivel"]),
  resumo: z.string().max(4000),
});
export const PgrRiskSchema = z.object({
  id: z.string().max(100),
  agente: z.string().min(2).max(180),
  categoria: z.enum(["fisico", "quimico", "biologico", "ergonomico", "acidente", "psicossocial"]),
  setorGhe: z.string().max(350),
  evidencia: PgrEvidenceSchema,
  controlesDocumentados: z.array(z.string().max(500)).max(12).default([]),
  classificacaoOriginal: z.string().max(150).default(""),
});
export const PgrActionSchema = z.object({
  id: z.string().max(100),
  tipoAcao: z.enum([
    "Preventiva",
    "Corretiva",
    "Verificação",
    "Melhoria Contínua",
    "Treinamento NR",
  ]),
  titulo: z.string().min(3).max(180),
  descricaoDetalhada: z.string().max(1600),
  prioridade: z.enum(["high", "critical", "medium", "low"]),
  colunaKanban: z.literal("todo"),
  referenciaLegal: z.string().max(200),
  responsavelSugerido: z.string().max(180),
  agenteSugerido: z.enum(PGR_AGENT_ROLES),
  riscosRelacionados: z.array(z.string().max(100)).max(100),
  evidencia: PgrEvidenceSchema.nullable(),
  checklist: z.array(z.string().min(3).max(350)).min(1).max(15),
  fundamento: z.enum(["documento", "sugestao"]),
  prazoDocumentado: z.string().max(180).default(""),
});
export const PgrAnalysisOutputSchema = z.object({
  // Optional so saved PGR analyses keep their identity and remain readable.
  documento: NaiDocumentSchema.optional(),
  prestadoresIdentificados: z.array(NaiProviderSchema).max(25).optional(),
  analiseAgente: NaiAgentAnalysisSchema.optional(),
  pgrCardDetalhado: z.object({
    razaoSocial: z.string().max(300),
    cnpj: z.string().max(30),
    cnae: z.string().max(180),
    grauDeRisco: z.number().int().min(1).max(4).nullable(),
    enderecoCompleto: z.string().max(500),
    cidadeUf: z.string().max(120),
    dataEmissao: z.string().max(100),
    dataValidade: z.string().max(100),
    coordenadasGps: z.string().max(100),
    totalRiscosMapeados: z.number().int().min(0),
    ghesIdentificados: z.array(z.string().max(350)).max(200),
    esocialS2240Status: z.string().max(600),
  }),
  identidade: z.object({
    status: z.enum(["identificada", "ambigua", "nao_identificada"]),
    evidencias: z.array(PgrEvidenceSchema).max(15),
    aviso: z.string().max(800),
  }),
  riscosIdentificados: z.array(PgrRiskSchema).max(100),
  acoesCategorizadas: z.array(PgrActionSchema).max(120),
  parecerTecnicoIA: z.string().max(4000),
  leitura: z.object({
    modo: z.enum(["ia_com_evidencias", "extracao_documental", "leitura_visual_ia", "inconclusiva"]),
    paginas: z.number().int().min(1).max(300),
    paginasComTexto: z.number().int().min(0).max(300),
    avisos: z.array(z.string().max(600)).max(25),
    versao: z.literal(PGR_VERSION),
  }),
});
export type PgrAnalysisOutput = z.infer<typeof PgrAnalysisOutputSchema>;
export type PgrRisk = z.infer<typeof PgrRiskSchema>;
export type PgrAction = z.infer<typeof PgrActionSchema>;
export type PgrPage = { numero: number; texto: string };
export type PgrCompany = { id: string; name: string; cnpj: string };
export type PgrDraftView = {
  draftId: string;
  sourceHash: string;
  fileName: string;
  analysis: PgrAnalysisOutput;
  companies: PgrCompany[];
  suggestedCompanyId: string | null;
  canCreateCompany: boolean;
  canRegisterProviders?: boolean;
};

export function getNaiDocument(analysis: Pick<PgrAnalysisOutput, "documento">): NaiDocument {
  return (
    analysis.documento || {
      tipo: "PGR",
      agenteResponsavel: "engenheiro_seguranca",
      statusClassificacao: "identificado",
      evidencias: [],
      justificativa: "Registro do fluxo anterior de PGR; classificação original preservada.",
      acesso: "sst",
    }
  );
}

export function normalizePgrText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function cleanPgrCnpj(value: string) {
  return value.replace(/\D/g, "");
}
export function isValidPgrCnpj(value: string) {
  const digits = cleanPgrCnpj(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    let weight = length - 7;
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * weight;
      if (--weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}
export function suggestedPgrCompany(analysis: PgrAnalysisOutput, companies: PgrCompany[]) {
  if (
    analysis.identidade.status !== "identificada" ||
    !isValidPgrCnpj(analysis.pgrCardDetalhado.cnpj)
  )
    return null;
  const matches = companies.filter(
    (c) => cleanPgrCnpj(c.cnpj) === cleanPgrCnpj(analysis.pgrCardDetalhado.cnpj)
  );
  return matches.length === 1 ? matches[0].id : null;
}
