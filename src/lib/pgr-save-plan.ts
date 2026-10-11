import { createHash } from "node:crypto";
import { AuthError } from "./auth/errors";
import {
  cleanPgrCnpj,
  isValidPgrCnpj,
  normalizePgrText,
  getNaiDocument,
  NAI_DOCUMENT_NAMES,
  PGR_AGENT_NAMES,
  PGR_VERSION,
  type NaiDocumentType,
  type NaiProvider,
  type PgrAction,
  type PgrAnalysisOutput,
  type PgrCompany,
} from "./pgr-schema";

export function assertPgrClientBinding(analysis: PgrAnalysisOutput, company: PgrCompany) {
  const docCnpj = cleanPgrCnpj(analysis.pgrCardDetalhado.cnpj);
  const targetCnpj =
    cleanPgrCnpj(company.cnpj) || (isValidPgrCnpj(company.id) ? cleanPgrCnpj(company.id) : "");
  if (analysis.identidade.status !== "identificada")
    throw new AuthError(
      "Identificação ausente ou ambígua: confira a empresa no documento antes de salvar.",
      422
    );
  if (docCnpj && !isValidPgrCnpj(docCnpj))
    throw new AuthError("O CNPJ extraído é inválido. Confira a identificação no documento.", 422);
  if (docCnpj && targetCnpj && docCnpj !== targetCnpj)
    throw new AuthError(
      "O CNPJ do documento pertence a outra empresa. Nenhum card foi gravado neste cliente.",
      409
    );
  if (
    docCnpj &&
    !targetCnpj &&
    normalizePgrText(company.name) !== normalizePgrText(analysis.pgrCardDetalhado.razaoSocial)
  )
    throw new AuthError(
      "O cadastro não tem CNPJ compatível. Atualize o cadastro ou selecione a empresa correta.",
      409
    );
  if (
    !docCnpj &&
    normalizePgrText(company.name) !== normalizePgrText(analysis.pgrCardDetalhado.razaoSocial)
  )
    throw new AuthError(
      "Sem CNPJ no documento, a razão social precisa coincidir com o cadastro selecionado.",
      409
    );
}

const DOCUMENT_AGENTS = {
  PGR: "engenheiro_seguranca",
  LTCAT: "engenheiro_seguranca",
  PCMSO: "medico_trabalho",
  ASO: "medico_trabalho",
  PERICIA_MEDICA: "medico_trabalho",
  AEP: "ergonomista",
  AET: "ergonomista",
  DADOS_ERGONOMICOS: "ergonomista",
  OUTRO: null,
} as const;

const DOCUMENT_TASK_TYPES = {
  PGR: "pgr",
  LTCAT: "ltcat",
  PCMSO: "pcmso",
  ASO: "aso",
  PERICIA_MEDICA: "pericia_medica",
  AEP: "aep",
  AET: "aet",
  DADOS_ERGONOMICOS: "ergonomia",
  OUTRO: "pgr",
} as const;

export function isRestrictedPgrDocumentType(type: unknown) {
  return type === "PCMSO" || type === "ASO" || type === "PERICIA_MEDICA";
}

export function getPgrImportMetadata(analysis: PgrAnalysisOutput) {
  const document = getNaiDocument(analysis);
  return {
    documentType: document.tipo,
    responsibleAgent: DOCUMENT_AGENTS[document.tipo],
    restricted:
      document.acesso === "clinico_restrito" || isRestrictedPgrDocumentType(document.tipo),
    sourceLabel: "NAI importa" as const,
  };
}

export function assertPgrAnalysisReady(analysis: PgrAnalysisOutput) {
  const document = getNaiDocument(analysis);
  if (document.statusClassificacao !== "identificado" || document.tipo === "OUTRO")
    throw new AuthError(
      "O tipo do documento ainda não foi identificado com segurança. Analise novamente antes de integrar.",
      422
    );
  if (analysis.analiseAgente && analysis.analiseAgente.status !== "concluida")
    throw new AuthError(
      "A análise do agente ainda não foi concluída. Tente analisar novamente.",
      422
    );
}

function reviewAction(type: NaiDocumentType, restricted: boolean): PgrAction {
  const role = restricted ? "medico_trabalho" : DOCUMENT_AGENTS[type] || "engenheiro_seguranca";
  return {
    id: restricted ? "restricted-document-review" : "document-review",
    tipoAcao: "Verificação",
    titulo: restricted
      ? `Revisão de ${NAI_DOCUMENT_NAMES[type]} em ambiente clínico`
      : `Revisão técnica de ${NAI_DOCUMENT_NAMES[type]}`,
    descricaoDetalhada: restricted
      ? "Conferir o documento no ambiente clínico autorizado e registrar a revisão profissional. Os dados de saúde permanecem no registro restrito."
      : "Conferir a identificação, as evidências e as pendências do documento antes de aprovar sua integração.",
    prioridade: "medium",
    colunaKanban: "todo",
    referenciaLegal: "",
    responsavelSugerido: PGR_AGENT_NAMES[role],
    agenteSugerido: role,
    riscosRelacionados: [],
    evidencia: null,
    checklist: restricted
      ? [
          "Acessar o documento no ambiente clínico autorizado",
          "Conferir a identificação e a assinatura no registro restrito",
          "Revisar o documento com o profissional responsável",
          "Registrar a revisão sem reproduzir dados clínicos neste card",
        ]
      : [
          "Conferir a identificação da empresa e o documento original",
          "Revisar as evidências e as pendências apontadas",
          "Registrar a revisão pelo profissional responsável",
        ],
    fundamento: "sugestao",
    prazoDocumentado: "",
  };
}

export function buildPgrSavePlan(
  analysis: PgrAnalysisOutput,
  company: PgrCompany,
  sourceHash: string,
  uid: string,
  dueDate: string
) {
  assertPgrAnalysisReady(analysis);
  const metadata = getPgrImportMetadata(analysis);
  // General cards must never copy model-generated text from clinical documents.
  const actions = metadata.restricted
    ? [reviewAction(metadata.documentType, true)]
    : analysis.acoesCategorizadas.length
      ? analysis.acoesCategorizadas
      : [reviewAction(metadata.documentType, false)];
  const risks = metadata.restricted ? [] : analysis.riscosIdentificados;
  const key = (prefix: string, value: string) =>
    `${prefix}_${sourceHash.slice(0, 24)}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
  const riskKeys = new Map(risks.map((r, i) => [r.id, key("risk", r.id + "|" + i)]));
  return {
    tasks: actions.map((a, i) => ({
      id: key("pgr", a.id + "|" + a.titulo + "|" + i),
      title: a.titulo,
      type: DOCUMENT_TASK_TYPES[metadata.documentType],
      status: "todo",
      priority: a.prioridade,
      companyId: company.id,
      companyName: company.name,
      responsibleName: a.responsavelSugerido,
      responsibleId: "",
      assigneeId: "",
      description: a.descricaoDetalhada,
      lastComment: a.referenciaLegal
        ? `${a.descricaoDetalhada}\nReferência a conferir: ${a.referenciaLegal}`
        : a.descricaoDetalhada,
      dueDate,
      progress: 0,
      agentEnabled: false,
      agentRole: a.agenteSugerido,
      ...metadata,
      sourceType: "pgr",
      sourceHash,
      pgrCardId: sourceHash,
      sourceEvidence: a.evidencia,
      documentedDeadline: a.prazoDocumentado,
      reviewStatus: "pending",
      riskIds: a.riscosRelacionados
        .map((id) => riskKeys.get(id))
        .filter((id): id is string => !!id),
      actionBasis: a.fundamento,
      checklist: a.checklist.map((text, n) => ({
        id: `item_${n}`,
        text,
        checked: false,
        mandatory: true,
      })),
      cnae: metadata.restricted ? "" : analysis.pgrCardDetalhado.cnae,
      riskDegree: metadata.restricted ? null : analysis.pgrCardDetalhado.grauDeRisco,
      location: metadata.restricted ? "" : analysis.pgrCardDetalhado.enderecoCompleto,
      tags: [
        NAI_DOCUMENT_NAMES[metadata.documentType],
        ...(metadata.restricted ? ["Acesso clínico restrito"] : []),
        "Revisão humana",
        a.fundamento === "documento" ? "Fonte documental" : "Sugestão",
      ],
      createdBy: uid,
      version: PGR_VERSION,
      isDeleted: false,
    })),
    risks: risks.map((r, i) => ({
      id: key("risk", r.id + "|" + i),
      companyId: company.id,
      hazard: r.agente,
      category: r.categoria,
      source: r.evidencia.trecho,
      ghe: r.setorGhe,
      exposedPeople: null,
      probability: null,
      severity: null,
      controls: r.controlesDocumentados.join("; "),
      owner: "A definir",
      dueDate,
      status: "identified",
      assessmentStatus: "pending",
      classificationOriginal: r.classificacaoOriginal,
      sourceEvidence: r.evidencia,
      sourceType: "pgr",
      ...metadata,
      sourceHash,
      pgrCardId: sourceHash,
      createdBy: uid,
    })),
  };
}

const PROVIDER_ROLE =
  /\b(prestador|prestadora|responsavel tecnico|responsavel tecnica|emitente|emissor|emissora|elaborador|elaboradora|elaborado por|elaborada por|contratada|clinica|laboratorio|medico coordenador|medico examinador)\b/;

function supportedProvider(provider: NaiProvider, company: PgrCompany) {
  const cnpj = cleanPgrCnpj(provider.cnpj);
  const name = normalizePgrText(provider.nome);
  if (
    !isValidPgrCnpj(cnpj) ||
    cnpj === cleanPgrCnpj(company.cnpj) ||
    name.length < 3 ||
    !PROVIDER_ROLE.test(normalizePgrText(provider.papelNoDocumento))
  )
    return false;
  return providerIdentityBlocks(provider).length > 0;
}

function providerIdentityBlocks(provider: NaiProvider) {
  const name = normalizePgrText(provider.nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cnpj = cleanPgrCnpj(provider.cnpj).split("").join("[.\\s/\\-]*");
  // The provider label must introduce this exact name. Co-occurrence with a
  // clinic's CNPJ is insufficient when the name actually labels an employee.
  const identityStart = new RegExp(
    "\\b(?:(?:empresa\\s+)?(?:prestador[ao]?|elaborador[ao]?|emitente|emissor[ao]?|contratada|clinica|laboratorio)|responsavel\\s+(?:tecnic[oa]|pela\\s+elaboracao)|medic[oa]\\s+(?:coordenador[ao]?|examinador[ao]?))\\s*[:–-]\\s*" +
      "(?:(?:razao\\s+social|nome\\s+empresarial|nome|empresa)\\s*[:–-]\\s*)?" +
      name +
      "(?![a-z0-9_])" +
      "|\\b(?:elaborad[oa]|emitid[oa])\\s+por\\s*[:–-]?\\s*" +
      name +
      "(?![a-z0-9_])",
    "g"
  );
  const cnpjPattern = new RegExp(
    "\\bc\\.?\\s*n\\.?\\s*p\\.?\\s*j\\.?\\s*[:–-]?\\s*" + cnpj + "(?![0-9])"
  );
  const nextSubject =
    /\b(?:(?:nome\s+(?:do|da)\s+)?(?:empregad[oa]|trabalhador[ao]?|paciente|colaborador[ao]?|empregador|contratante|cliente)\b|(?:empresa|prestador[ao]?|elaborador[ao]?|emitente|emissor[ao]?|responsavel\s+tecnic[oa]|medic[oa]\s+examinador[ao]?)\s*[:–-])/;
  const blocks: string[] = [];
  for (const evidence of provider.evidencias) {
    const text = normalizePgrText(evidence.trecho);
    for (const match of text.matchAll(identityStart)) {
      const suffix = text.slice((match.index || 0) + match[0].length);
      const boundary = suffix.search(nextSubject);
      const block = match[0] + (boundary < 0 ? suffix : suffix.slice(0, boundary));
      if (cnpjPattern.test(block)) blocks.push(block);
    }
  }
  return blocks;
}

export function buildPgrProviderPlan(analysis: PgrAnalysisOutput, company: PgrCompany) {
  const candidates = new Map<string, NaiProvider>();
  const ambiguous = new Set<string>();
  for (const provider of analysis.prestadoresIdentificados || []) {
    if (!supportedProvider(provider, company)) continue;
    const cnpj = cleanPgrCnpj(provider.cnpj);
    const previous = candidates.get(cnpj);
    if (previous && normalizePgrText(previous.nome) !== normalizePgrText(provider.nome))
      ambiguous.add(cnpj);
    else candidates.set(cnpj, provider);
  }
  return [...candidates.entries()]
    .filter(([cnpj]) => !ambiguous.has(cnpj))
    .map(([cnpj, provider]) => {
      const restricted = getPgrImportMetadata(analysis).restricted;
      const evidenceText = providerIdentityBlocks(provider).join("\n");
      const supported = (value: string) =>
        !restricted && value.trim() && evidenceText.includes(normalizePgrText(value))
          ? value.trim()
          : "";
      // Deliberately exclude free-form source excerpts: providers is a general registry.
      return {
        id: cnpj,
        name: provider.nome.trim(),
        cnpj,
        cnpjNormalized: cnpj,
        councilNumber: supported(provider.registroProfissional),
        specialty: supported(provider.especialidade),
        address: supported(provider.endereco),
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.email) ? supported(provider.email) : "",
        phone: supported(provider.telefone),
        active: true,
        registrationStatus: "pending_review",
        sourceLabel: "NAI importa",
        servedCompanies: [company.id],
      };
    });
}
