import "server-only";
import { createHash } from "node:crypto";
import { getPgrAi } from "./pgr-ai-provider";
import {
  PgrAnalysisOutputSchema,
  normalizePgrText,
  type PgrAnalysisOutput,
  type PgrPage,
  PGR_VERSION,
} from "@/lib/pgr-schema";
import {
  isPgrExposureEvidence,
  parsePgrDocumentPages,
  withPgrSuggestedActions,
} from "@/lib/pgr-document-parser";
import { PGR_EXTRACTION_PROMPT } from "@/lib/pgr-agent-prompts";
import { readPgrPdfPages } from "./pgr-pdf-text";

export type PgrAnalysisInput = { pdfDataUri: string; fileName?: string };
const PgrModelOutputSchema = PgrAnalysisOutputSchema.omit({
  acoesCategorizadas: true,
  leitura: true,
});
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
    isVisual = !pages.some((p) => p.texto.length >= 40);
  } else {
    if (!input.pdfDataUri.trim() || input.pdfDataUri.length > 1000000)
      throw new Error("Texto ausente ou acima do limite.");
    pages = input.pdfDataUri.split("\f").map((texto, i) => ({ numero: i + 1, texto }));
    if (pages.length > 300) throw new Error("Limite de 300 páginas por análise.");
  }
  const base = parsePgrDocumentPages(pages);
  const ai = getPgrAi();
  if (!ai) {
    return {
      ...base,
      leitura: {
        ...base.leitura,
        avisos: [
          ...base.leitura.avisos,
          "IA não configurada: exibida somente a extração documental. Se o arquivo é digitalizado, a identificação permanece inconclusiva.",
        ],
      },
    };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    const documentText = pages.map((p) => `[PÁGINA PDF ${p.numero}]\n${p.texto}`).join("\n\n");
    const content = [
      {
        text:
          PGR_EXTRACTION_PROMPT +
          "\nExtraia a identidade, os riscos com evidências e a síntese. Os cards e os checklists serão criados a partir dos riscos validados, fora desta resposta. Não inclua prescrições ou decisões clínicas.",
      },
      { text: `<documento>\n${documentText}\n</documento>` },
    ];
    const generation = ai.generate({
      prompt: isVisual ? [...content, { media: { url: input.pdfDataUri } }] : content,
      output: { schema: PgrModelOutputSchema },
      abortSignal: controller.signal,
    });
    const response = await Promise.race([
      generation,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, 60000);
      }),
    ]);
    const parsed = PgrModelOutputSchema.safeParse(response?.output);
    if (!parsed.success) throw new Error("IA sem resultado estruturado.");
    const extracted = parsed.data;
    const validated = extracted.riscosIdentificados
      .filter((r) => isVisual || isPgrExposureEvidence(r.evidencia, pages))
      .map((r) => {
        if (isVisual) return r;
        const page = normalizePgrText(
          pages.find((p) => p.numero === r.evidencia.pagina)?.texto || ""
        );
        return {
          ...r,
          controlesDocumentados: r.controlesDocumentados.filter((c) =>
            page.includes(normalizePgrText(c))
          ),
          classificacaoOriginal: page.includes(normalizePgrText(r.classificacaoOriginal))
            ? r.classificacaoOriginal
            : "",
          setorGhe: page.includes(normalizePgrText(r.setorGhe)) ? r.setorGhe : "",
        };
      });
    const combined = [
      ...validated,
      ...base.riscosIdentificados.filter(
        (b) =>
          !validated.some(
            (v) =>
              v.categoria === b.categoria &&
              ((v.setorGhe && normalizePgrText(v.setorGhe) === normalizePgrText(b.setorGhe)) ||
                v.evidencia.pagina === b.evidencia.pagina)
          )
      ),
    ];
    const risks = combined.slice(0, 100).map((r) => ({
      ...r,
      id: createHash("sha256")
        .update(
          r.categoria +
            "|" +
            r.agente +
            "|" +
            r.setorGhe +
            "|" +
            r.evidencia.pagina +
            "|" +
            r.evidencia.trecho
        )
        .digest("hex")
        .slice(0, 24),
    }));
    const actions: PgrAnalysisOutput["acoesCategorizadas"] = [];
    const text = normalizePgrText(documentText);
    const literalDate = (value: string, label: string) =>
      value &&
      new RegExp(
        label + "\\s*[:–-]?\\s*" + normalizePgrText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      ).test(text)
        ? value
        : "";
    const detail = isVisual
      ? extracted.pgrCardDetalhado
      : {
          ...base.pgrCardDetalhado,
          dataEmissao: literalDate(
            extracted.pgrCardDetalhado.dataEmissao,
            "(?:data de emissao|emissao|data de elaboracao)"
          ),
          dataValidade: literalDate(
            extracted.pgrCardDetalhado.dataValidade,
            "(?:data de validade|validade|vigencia ate)"
          ),
        };
    const safe: PgrAnalysisOutput = {
      ...extracted,
      pgrCardDetalhado: {
        ...detail,
        coordenadasGps: "",
        esocialS2240Status: base.pgrCardDetalhado.esocialS2240Status,
      },
      identidade: isVisual ? extracted.identidade : base.identidade,
      riscosIdentificados: risks,
      acoesCategorizadas: actions,
      leitura: {
        modo: isVisual ? "leitura_visual_ia" : "ia_com_evidencias",
        paginas: pages.length,
        paginasComTexto: base.leitura.paginasComTexto,
        versao: PGR_VERSION,
        avisos: [
          ...base.leitura.avisos,
          ...(isVisual
            ? ["Leitura visual da IA: confira identidade e trechos no original antes de integrar."]
            : []),
          ...(combined.length >= 100
            ? [
                "Exibidos até 100 grupos de risco. Confira o inventário completo no original e divida por unidade se necessário.",
              ]
            : []),
        ],
      },
    };
    return withPgrSuggestedActions(safe, pages);
  } catch {
    return {
      ...base,
      leitura: {
        ...base.leitura,
        avisos: [
          ...base.leitura.avisos,
          "A IA não concluiu esta análise. Exibida a extração documental com tarefas propostas para revisão; não é auditoria completa.",
        ],
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
