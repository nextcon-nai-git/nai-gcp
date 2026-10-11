import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { aiFailureCode, aiFailureMessage } from "@/lib/ai-failure";
import { getPgrAi } from "./pgr-ai-provider";
import {
  NAI_DOCUMENT_TYPES,
  PGR_AGENT_NAMES,
  PgrAnalysisOutputSchema,
  PgrEvidenceSchema,
  normalizePgrText,
  type NaiProvider,
  type PgrAnalysisOutput,
  type PgrPage,
  PGR_VERSION,
} from "@/lib/pgr-schema";
import {
  evidenceIsInPages,
  isPgrExposureEvidence,
  parsePgrDocumentPages,
  withPgrSuggestedActions,
} from "@/lib/pgr-document-parser";
import {
  classifyNaiDocument,
  extractNaiProviders,
  naiDocumentAgent,
  withNaiDocumentWorkflow,
} from "@/lib/nai-document-routing";
import {
  naiDocumentAnalysisPrompt,
  NAI_VISUAL_CLASSIFICATION_PROMPT,
} from "@/lib/pgr-agent-prompts";
import { forbidden } from "@/lib/auth/errors";
import { readPgrPdfPages } from "./pgr-pdf-text";
import { mergeNaiIdentity } from "@/lib/nai-import-evidence";

export type PgrAnalysisInput = {
  pdfDataUri: string;
  fileName?: string;
  /** Supplied by the authenticated server entrypoint, never trusted from an upload payload. */
  allowClinical?: boolean;
};
const PgrModelOutputSchema = PgrAnalysisOutputSchema.omit({
  leitura: true,
  documento: true,
  analiseAgente: true,
}).extend({ parecerTecnicoIA: z.string().trim().min(60).max(4000) });
const VisualClassificationSchema = z.object({
  tipo: z.enum(NAI_DOCUMENT_TYPES),
  statusClassificacao: z.enum(["identificado", "ambiguo", "nao_identificado"]),
  contemDadosClinicosIndividuais: z.boolean(),
  evidencias: z.array(PgrEvidenceSchema).max(10).optional(),
});

function validatedProviders(
  providers: NaiProvider[],
  pages: PgrPage[],
  isVisual: boolean,
  companyCnpj: string
) {
  return providers.filter((provider) => {
    if (
      companyCnpj.replace(/\D/g, "") &&
      provider.cnpj.replace(/\D/g, "") === companyCnpj.replace(/\D/g, "")
    )
      return false;
    if (isVisual) return true;
    if (!provider.evidencias.every((evidence) => evidenceIsInPages(evidence, pages))) return false;
    const evidence = normalizePgrText(provider.evidencias.map((item) => item.trecho).join(" "));
    if (
      !/\b(?:prestador|prestadora|contratada|elaboradora|elaborado por|elaborada por|responsavel tecnico|medico responsavel|medico examinador|medico coordenador|clinica)\b/.test(
        evidence
      )
    )
      return false;
    return [
      provider.nome,
      provider.cnpj,
      provider.registroProfissional,
      provider.especialidade,
      provider.cidadeUf,
      provider.endereco,
      provider.email,
      provider.telefone,
    ]
      .filter(Boolean)
      .every((value) => evidence.includes(normalizePgrText(value)));
  });
}

export async function analyzePgrDocument(input: PgrAnalysisInput): Promise<PgrAnalysisOutput> {
  let pages: PgrPage[];
  let isVisual = false;
  if (input.pdfDataUri.startsWith("data:")) {
    const match =
      /^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
        input.pdfDataUri
      );
    if (!match) throw new Error("Use um PDF ou imagem PNG, JPEG ou WebP válido.");
    const bytes = Buffer.from(match[2], "base64");
    if (match[1] === "application/pdf") pages = await readPgrPdfPages(bytes);
    else {
      if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("Imagem acima do limite de 12 MB.");
      pages = [{ numero: 1, texto: "" }];
    }
    // A readable cover must not hide scanned attachments, including a medical annex.
    isVisual = pages.some((p) => p.texto.trim().length < 40);
  } else {
    if (!input.pdfDataUri.trim() || input.pdfDataUri.length > 1000000)
      throw new Error("Texto ausente ou acima do limite.");
    pages = input.pdfDataUri.split("\f").map((texto, i) => ({ numero: i + 1, texto }));
    if (pages.length > 300) throw new Error("Limite de 300 páginas por análise.");
  }

  let documento = classifyNaiDocument(pages);
  const needsClassification =
    input.pdfDataUri.startsWith("data:") ||
    (documento.statusClassificacao !== "identificado" &&
      pages.some((page) => page.texto.trim().length >= 40));
  let visualTriaged = !needsClassification;
  let triageFailure = "FORMAT";
  const ai = getPgrAi();
  if (needsClassification && ai) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        ai.generate({
          prompt: [
            { text: NAI_VISUAL_CLASSIFICATION_PROMPT },
            ...(input.pdfDataUri.startsWith("data:")
              ? [{ media: { url: input.pdfDataUri } }]
              : [
                  {
                    text: pages
                      .map((page) => `[PÁGINA PDF ${page.numero}]\n${page.texto}`)
                      .join("\n\n"),
                  },
                ]),
          ],
          output: { schema: VisualClassificationSchema },
          abortSignal: controller.signal,
        }),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            controller.abort();
            triageFailure = "TIMEOUT";
            resolve(null);
          }, 45000);
        }),
      ]);
      const classification = VisualClassificationSchema.safeParse(result?.output);
      if (classification.success) {
        visualTriaged = true;
        const value = classification.data;
        const conflicting =
          documento.statusClassificacao === "identificado" &&
          value.statusClassificacao === "identificado" &&
          documento.tipo !== value.tipo;
        const evidence = (value.evidencias || []).filter((item) => evidenceIsInPages(item, pages));
        const identified =
          !conflicting &&
          value.statusClassificacao === "identificado" &&
          value.tipo !== "OUTRO" &&
          (isVisual ||
            evidence.length > 0 ||
            (documento.statusClassificacao === "identificado" && documento.tipo === value.tipo));
        const tipo = identified ? value.tipo : "OUTRO";
        documento = {
          tipo,
          agenteResponsavel: naiDocumentAgent(tipo),
          statusClassificacao: identified
            ? "identificado"
            : conflicting || value.statusClassificacao === "ambiguo"
              ? "ambiguo"
              : "nao_identificado",
          evidencias: evidence,
          justificativa: identified
            ? "Tipo identificado pela triagem de conteúdo da IA. Confira as evidências e o original antes de integrar."
            : "A triagem visual não distinguiu um único tipo documental. Reenvie o documento legível e separado.",
          acesso:
            documento.acesso === "clinico_restrito" ||
            value.contemDadosClinicosIndividuais ||
            ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(value.tipo)
              ? "clinico_restrito"
              : "sst",
        };
      }
    } catch (error) {
      triageFailure = aiFailureCode(error);
      // Only a fixed code is recorded: never a document, credential or raw provider error.
      console.warn("NAI document triage unavailable", { code: triageFailure });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // This gate intentionally sits outside the model fallback catch. A rejected medical upload
  // must never return the extracted body, clinical evidence or a draft to an unauthorized user.
  if (documento.acesso === "clinico_restrito" && input.allowClinical !== true)
    throw forbidden(
      "Este documento requer um perfil autorizado para informações clínicas. Encaminhe ao Médico do Trabalho responsável."
    );

  const base = withNaiDocumentWorkflow(parsePgrDocumentPages(pages), pages, documento);
  const pending = (message: string, status: "pendente" | "indisponivel"): PgrAnalysisOutput => ({
    ...base,
    analiseAgente: { agente: documento.agenteResponsavel, status, resumo: message },
    leitura: { ...base.leitura, avisos: [...base.leitura.avisos, message].slice(0, 25) },
  });
  if (!ai)
    return pending(
      "IA não configurada: exibida somente a extração documental. A análise do agente está indisponível; o rascunho precisa ser reanalisado antes da integração.",
      "indisponivel"
    );
  if (!visualTriaged)
    return pending(
      `${aiFailureMessage(triageFailure)} Código: ${triageFailure}. A triagem documental não foi concluída; a extração foi preservada e nenhum especialista confirmou a análise.`,
      "indisponivel"
    );
  if (documento.statusClassificacao !== "identificado" || !documento.agenteResponsavel)
    return pending(
      "O tipo de documento precisa ser identificado antes da análise especializada. Confira o original e reenvie um documento completo por vez.",
      "pendente"
    );
  if (documento.acesso === "clinico_restrito" && documento.agenteResponsavel !== "medico_trabalho")
    return pending(
      "O arquivo técnico contém informações clínicas. Separe uma versão sem dados individuais para o especialista técnico; a íntegra deve ser revisada pelo Médico do Trabalho em acesso restrito.",
      "pendente"
    );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  let timedOut = false;
  try {
    const documentText = pages.map((p) => `[PÁGINA PDF ${p.numero}]\n${p.texto}`).join("\n\n");
    const content = [
      { text: naiDocumentAnalysisPrompt(documento) },
      { text: `<documento>\n${documentText}\n</documento>` },
      {
        text: `Conferência das tabelas extraídas: ${JSON.stringify(pages.filter((p) => p.riscosTabela?.length).map((p) => ({ pagina: p.numero, ghe: p.riscosTabela![0].setorGhe, linhas: p.riscosTabela!.length })))}. Analise todas essas linhas e mantenha as pendências do documento. Revisão prevista não significa validade.`,
      },
    ];
    const generation = ai.generate({
      // Even text PDFs contain tables, columns and diagrams lost by plain text extraction.
      prompt: input.pdfDataUri.startsWith("data:")
        ? [...content, { media: { url: input.pdfDataUri } }]
        : content,
      output: { schema: PgrModelOutputSchema },
      config: { temperature: 0.1, maxOutputTokens: 24000 },
      abortSignal: controller.signal,
    });
    const response = await Promise.race([
      generation,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          resolve(null);
        }, 180000);
      }),
    ]);
    const parsed = PgrModelOutputSchema.safeParse(response?.output);
    if (!parsed.success) throw new Error("IA sem resultado estruturado.");
    const extracted = parsed.data;
    const clinical = documento.acesso === "clinico_restrito";
    const isErgonomic = ["AEP", "AET", "DADOS_ERGONOMICOS"].includes(documento.tipo);
    const validated = (clinical ? [] : extracted.riscosIdentificados)
      .filter(
        (risk) => !pages.find((page) => page.numero === risk.evidencia.pagina)?.riscosTabela?.length
      )
      .filter(
        (risk) =>
          isVisual ||
          isPgrExposureEvidence(risk.evidencia, pages) ||
          (isErgonomic &&
            ["ergonomico", "psicossocial"].includes(risk.categoria) &&
            evidenceIsInPages(risk.evidencia, pages) &&
            !/\b(?:conceitos|bibliografia|introducao)\b/.test(
              normalizePgrText(pages.find((p) => p.numero === risk.evidencia.pagina)?.texto || "")
            ) &&
            /\b(?:tarefa|atividade|trabalho|posto|organizacao)\b/.test(
              normalizePgrText(risk.evidencia.trecho)
            ))
      )
      .map((risk) => {
        if (isVisual) return risk;
        const page = normalizePgrText(
          pages.find((p) => p.numero === risk.evidencia.pagina)?.texto || ""
        );
        return {
          ...risk,
          controlesDocumentados: risk.controlesDocumentados.filter((control) =>
            page.includes(normalizePgrText(control))
          ),
          classificacaoOriginal: page.includes(normalizePgrText(risk.classificacaoOriginal))
            ? risk.classificacaoOriginal
            : "",
          setorGhe: page.includes(normalizePgrText(risk.setorGhe)) ? risk.setorGhe : "",
        };
      });
    const combined = clinical
      ? []
      : [
          ...validated,
          ...base.riscosIdentificados.filter(
            (baseRisk) =>
              !validated.some(
                (risk) =>
                  risk.categoria === baseRisk.categoria &&
                  ((risk.setorGhe &&
                    normalizePgrText(risk.setorGhe) === normalizePgrText(baseRisk.setorGhe)) ||
                    (!risk.setorGhe &&
                      !baseRisk.setorGhe &&
                      risk.evidencia.pagina === baseRisk.evidencia.pagina))
              )
          ),
        ];
    const riskIds = new Map<string, string>();
    const risks = combined.slice(0, 100).map((risk) => {
      const id = createHash("sha256")
        .update(
          risk.categoria +
            "|" +
            risk.agente +
            "|" +
            risk.setorGhe +
            "|" +
            risk.evidencia.pagina +
            "|" +
            risk.evidencia.trecho
        )
        .digest("hex")
        .slice(0, 24);
      riskIds.set(risk.id, id);
      return { ...risk, id };
    });
    const actions = extracted.acoesCategorizadas
      .filter(
        (action) =>
          !action.id.startsWith("agent_") &&
          (action.fundamento !== "documento" ||
            (!!action.evidencia && (isVisual || evidenceIsInPages(action.evidencia, pages))))
      )
      .map((action) => ({
        ...action,
        id: createHash("sha256")
          .update(action.titulo + "|" + action.agenteSugerido + "|" + action.descricaoDetalhada)
          .digest("hex")
          .slice(0, 24),
        responsavelSugerido: PGR_AGENT_NAMES[action.agenteSugerido],
        riscosRelacionados: action.riscosRelacionados
          .map((id) => riskIds.get(id))
          .filter((id): id is string => !!id),
        evidencia:
          action.evidencia && (isVisual || evidenceIsInPages(action.evidencia, pages))
            ? action.evidencia
            : null,
        prazoDocumentado:
          action.prazoDocumentado &&
          (isVisual ||
            (!!action.evidencia &&
              normalizePgrText(action.evidencia.trecho).includes(
                normalizePgrText(action.prazoDocumentado)
              )))
            ? action.prazoDocumentado
            : "",
      }));
    const text = normalizePgrText(documentText);
    const literalDate = (value: string, label: string) =>
      value &&
      new RegExp(
        label + "\\s*[:–-]?\\s*" + normalizePgrText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      ).test(text)
        ? value
        : "";
    const mergedIdentity = mergeNaiIdentity(base, extracted, pages, isVisual);
    const detail = {
      ...mergedIdentity.detail,
      dataEmissao:
        base.pgrCardDetalhado.dataEmissao ||
        (isVisual
          ? extracted.pgrCardDetalhado.dataEmissao
          : literalDate(
              extracted.pgrCardDetalhado.dataEmissao,
              "(?:data de emissao|emissao|data de elaboracao)"
            )),
      dataValidade:
        base.pgrCardDetalhado.dataValidade ||
        (isVisual
          ? extracted.pgrCardDetalhado.dataValidade
          : literalDate(
              extracted.pgrCardDetalhado.dataValidade,
              "(?:data de validade|validade|vigencia ate)"
            )),
    };
    const providerCandidates = [
      ...extractNaiProviders(pages),
      ...validatedProviders(extracted.prestadoresIdentificados || [], pages, isVisual, detail.cnpj),
    ];
    const providers = [
      ...new Map(
        providerCandidates.map((provider) => [
          normalizePgrText(provider.nome) +
            "|" +
            provider.cnpj.replace(/\D/g, "") +
            "|" +
            normalizePgrText(provider.registroProfissional),
          provider,
        ])
      ).values(),
    ].slice(0, 25);
    const safe: PgrAnalysisOutput = {
      ...extracted,
      documento,
      prestadoresIdentificados: providers,
      analiseAgente: {
        agente: documento.agenteResponsavel,
        status: "concluida",
        resumo: extracted.parecerTecnicoIA,
      },
      pgrCardDetalhado: {
        ...detail,
        coordenadasGps: "",
        esocialS2240Status: base.pgrCardDetalhado.esocialS2240Status,
      },
      identidade: mergedIdentity.identity,
      riscosIdentificados: risks,
      acoesCategorizadas: actions,
      leitura: {
        modo: isVisual ? "leitura_visual_ia" : "ia_com_evidencias",
        paginas: pages.length,
        paginasComTexto: base.leitura.paginasComTexto,
        versao: PGR_VERSION,
        avisos: [
          ...base.leitura.avisos,
          "Análise documental do agente concluída; aprovação profissional e execução das ações permanecem pendentes.",
          ...(isVisual
            ? [
                "Leitura visual da IA: confira identidade, prestadores e trechos no original antes de integrar.",
              ]
            : []),
          ...(combined.length >= 100
            ? [
                "Exibidos até 100 grupos de risco. Confira o inventário completo no original e divida por unidade se necessário.",
              ]
            : []),
        ].slice(0, 25),
      },
    };
    return withNaiDocumentWorkflow(withPgrSuggestedActions(safe, pages), pages, documento);
  } catch (error) {
    const status =
      error && typeof error === "object"
        ? String(
            (error as { status?: unknown; code?: unknown }).status ||
              (error as { code?: unknown }).code ||
              ""
          )
        : "";
    const reason = timedOut
      ? "O tempo de leitura da IA foi excedido. Tente novamente ou divida o documento por unidade."
      : /429|RESOURCE_EXHAUSTED/.test(status)
        ? "O serviço de IA atingiu o limite temporário de uso. Tente novamente em alguns minutos."
        : /401|403|404|PERMISSION_DENIED|UNAUTHENTICATED|NOT_FOUND/.test(status)
          ? "O provedor de IA não está acessível. A administração precisa conferir o modelo e a autorização do serviço."
          : "A IA não concluiu esta análise ou retornou uma estrutura incompleta. Tente analisar novamente.";
    return pending(
      `${reason} A extração documental foi preservada; a integração aguarda uma análise concluída.`,
      "indisponivel"
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
