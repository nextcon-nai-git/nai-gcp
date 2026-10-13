import { evidenceIsInPages } from "./pgr-document-parser";
import {
  cleanPgrCnpj,
  isValidPgrCnpj,
  normalizePgrText,
  type PgrAnalysisOutput,
  type PgrPage,
} from "./pgr-schema";

/** A scanned page can be reviewed visually; a blank page elsewhere cannot excuse a false quote. */
export function isNaiVisualEvidence(
  evidence: { pagina: number; trecho: string },
  pages: PgrPage[]
) {
  const page = pages.find((item) => item.numero === evidence.pagina);
  return !!page && page.texto.trim().length < 40 && normalizePgrText(evidence.trecho).length >= 3;
}

/** Accept model discoveries only when the uploaded pages support the employer identity. */
export function mergeNaiIdentity(
  base: PgrAnalysisOutput,
  model: Pick<PgrAnalysisOutput, "identidade" | "pgrCardDetalhado">,
  pages: PgrPage[],
  visual: boolean
) {
  const proposed = model.pgrCardDetalhado;
  const evidence = model.identidade.evidencias.filter(
    (item) => evidenceIsInPages(item, pages) || (visual && isNaiVisualEvidence(item, pages))
  );
  const supported = evidence.some((item) => {
    const quote = normalizePgrText(item.trecho);
    return (
      /\b(?:razao social|contratante|cliente|empregador|empresa avaliada)\b/.test(quote) &&
      !/\b(?:prestador|prestadora|contratada|elaboradora|elaborado por|elaborada por)\b/.test(
        quote
      ) &&
      !!proposed.razaoSocial &&
      quote.includes(normalizePgrText(proposed.razaoSocial)) &&
      isValidPgrCnpj(proposed.cnpj) &&
      cleanPgrCnpj(quote).includes(cleanPgrCnpj(proposed.cnpj))
    );
  });
  const useModel =
    base.identidade.status === "nao_identificada" &&
    model.identidade.status === "identificada" &&
    supported;
  const identity = useModel ? { ...model.identidade, evidencias: evidence } : base.identidade;
  const detail = useModel
    ? visual
      ? { ...proposed }
      : { ...base.pgrCardDetalhado, razaoSocial: proposed.razaoSocial, cnpj: proposed.cnpj }
    : { ...base.pgrCardDetalhado };
  const identityText = normalizePgrText(identity.evidencias.map((item) => item.trecho).join("\n"));
  // A different CNPJ from the model must not contribute metadata from the issuer/provider.
  const sameEmployer = !!detail.cnpj && cleanPgrCnpj(detail.cnpj) === cleanPgrCnpj(proposed.cnpj);
  if (sameEmployer) {
    for (const field of ["cnae", "enderecoCompleto", "cidadeUf"] as const) {
      if (
        proposed[field] &&
        identityText.includes(normalizePgrText(proposed[field])) &&
        (!detail[field] ||
          (field === "enderecoCompleto" &&
            normalizePgrText(proposed[field]).includes(normalizePgrText(detail[field]))))
      )
        detail[field] = proposed[field];
    }
    if (
      detail.grauDeRisco === null &&
      proposed.grauDeRisco !== null &&
      new RegExp(`grau de risco\\s*:?\\s*(?:grau\\s*)?0?${proposed.grauDeRisco}\\b`).test(
        identityText
      )
    )
      detail.grauDeRisco = proposed.grauDeRisco;
  }
  const allText = normalizePgrText(pages.map((page) => page.texto).join("\n"));
  detail.ghesIdentificados = [
    ...new Set([
      ...detail.ghesIdentificados,
      ...proposed.ghesIdentificados.filter(
        (value) => value && allText.includes(normalizePgrText(value))
      ),
    ]),
  ].slice(0, 200);
  return { detail, identity };
}
