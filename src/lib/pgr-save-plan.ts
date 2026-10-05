import { createHash } from "node:crypto";
import { AuthError } from "./auth/errors";
import {
  cleanPgrCnpj,
  isValidPgrCnpj,
  normalizePgrText,
  PGR_VERSION,
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
      "O CNPJ do PGR pertence a outra empresa. Nenhum card foi gravado neste cliente.",
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
export function buildPgrSavePlan(
  analysis: PgrAnalysisOutput,
  company: PgrCompany,
  sourceHash: string,
  uid: string,
  dueDate: string
) {
  const key = (prefix: string, value: string) =>
    `${prefix}_${sourceHash.slice(0, 24)}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
  const riskKeys = new Map(
    analysis.riscosIdentificados.map((r, i) => [r.id, key("risk", r.id + "|" + i)])
  );
  return {
    tasks: analysis.acoesCategorizadas.map((a, i) => ({
      id: key("pgr", a.id + "|" + a.titulo + "|" + i),
      title: a.titulo,
      type: "pgr",
      status: "todo",
      priority: a.prioridade,
      companyId: company.id,
      companyName: company.name,
      responsibleName: a.responsavelSugerido,
      responsibleId: "",
      assigneeId: "",
      description: a.descricaoDetalhada,
      lastComment: `${a.descricaoDetalhada}\nReferência a conferir: ${a.referenciaLegal}`,
      dueDate,
      progress: 0,
      agentEnabled: false,
      agentRole: a.agenteSugerido,
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
      cnae: analysis.pgrCardDetalhado.cnae,
      riskDegree: analysis.pgrCardDetalhado.grauDeRisco,
      location: analysis.pgrCardDetalhado.enderecoCompleto,
      tags: [
        "PGR",
        "Revisão humana",
        a.fundamento === "documento" ? "Fonte documental" : "Sugestão",
      ],
      createdBy: uid,
      version: PGR_VERSION,
      isDeleted: false,
    })),
    risks: analysis.riscosIdentificados.map((r, i) => ({
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
      sourceHash,
      pgrCardId: sourceHash,
      createdBy: uid,
    })),
  };
}
