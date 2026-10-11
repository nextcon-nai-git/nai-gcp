import { normalizePgrText, type PgrPage, type PgrRisk } from "./pgr-schema";
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

/** Read vertical inventory cards while retaining the last explicit exposure group. */
export function withPgrRiskCards(pages: PgrPage[]): PgrPage[] {
  let sector = "";
  return pages.map((page) => {
    const heading = page.texto.match(/(?:^|\n)[ \t]*(?:GHE|GES)\s*:?\s*\d+\s*[-–][^\n]+/i)?.[0];
    if (heading && !/\.{4}/.test(heading)) sector = compact(heading);
    if (page.riscosTabela?.length) return page;
    const start = page.texto.search(/Perigo\s*\/\s*Fator\s+de\s+Risco/i);
    if (start < 0 || !/Avalia[çc][aã]o\s+de\s+risco/i.test(page.texto)) return page;
    const body = page.texto.slice(start);
    const header = compact(body.split(/Descri[çc][aã]o/i)[0]);
    const category = header.match(
      /Grupo\s+(F[ií]sico|Qu[ií]mico|Biol[oó]gico|Ergon[oô]mico|Acidente|Psicossocial)/i
    );
    if (!category) return page;
    const agente = compact(
      header.replace(/Perigo\s*\/\s*Fator\s+de\s+Risco/i, "").replace(category[0], "")
    );
    if (agente.length < 2 || agente.length > 180) return page;
    const classification =
      body.match(
        /N[ií]vel\s+de\s+Risco\s*([\s\S]*?)(?=A[çc][oõ]es\s+necess[aá]rias|Outras\s+informa[çc][oõ]es|$)/i
      )?.[1] || "";
    const controls =
      body.match(
        /Preven[çc][aã]o\s+e\s+controle\s*([\s\S]*?)(?=Exposi[çc][aã]o|Avalia[çc][aã]o\s+de\s+risco|$)/i
      )?.[1] || "";
    const trecho = compact(
      body.split(/Preven[çc][aã]o\s+e\s+controle|Exposi[çc][aã]o|Avalia[çc][aã]o\s+de\s+risco/i)[0]
    ).slice(0, 1200);
    return {
      ...page,
      riscosTabela: [
        {
          agente,
          categoria: normalizePgrText(category[1]) as PgrRisk["categoria"],
          setorGhe: sector,
          trecho,
          classificacaoOriginal: compact(classification).slice(0, 150),
          controlesDocumentados: controls ? [compact(controls).slice(0, 500)] : [],
        },
      ],
    };
  });
}
