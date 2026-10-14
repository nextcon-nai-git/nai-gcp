import { normalizePgrText, type PgrPage, type PgrRisk } from "./pgr-schema";
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

/** Read vertical inventory cards while retaining the last explicit exposure group. */
export function withPgrRiskCards(pages: PgrPage[]): PgrPage[] {
  let sector = "";
  return pages.map((page) => {
    const inheritedSector = sector;
    const headings = [
      ...page.texto.matchAll(/(?:^|\n)[ \t]*(?:GHE|GES)\s*:?\s*\d+\s*[-–][^\n]+/gi),
    ].filter((heading) => !/\.{4}/.test(heading[0]));
    if (headings.length) sector = compact(headings.at(-1)![0]);
    if (page.riscosTabela?.length) return page;
    const starts = [...page.texto.matchAll(/Perigo\s*\/\s*Fator\s+de\s+Risco/gi)];
    if (!starts.length) return page;
    const rows: NonNullable<PgrPage["riscosTabela"]> = [];
    for (const [index, start] of starts.entries()) {
      const nextHeading = headings.find((heading) => heading.index! > start.index!);
      const end = Math.min(
        starts[index + 1]?.index ?? page.texto.length,
        nextHeading?.index ?? page.texto.length
      );
      const body = page.texto.slice(start.index, end);
      if (!/Avalia[çc][aã]o\s+de\s+risco/i.test(body)) return page;
      const header = compact(body.split(/Descri[çc][aã]o/i)[0]);
      const category = header.match(
        /Grupo\s+(F[ií]sico|Qu[ií]mico|Biol[oó]gico|Ergon[oô]mico|Acidentes?|Psicossocial)/i
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
        body.split(
          /Preven[çc][aã]o\s+e\s+controle|Exposi[çc][aã]o|Avalia[çc][aã]o\s+de\s+risco/i
        )[0]
      ).slice(0, 1200);
      const rowHeading = headings.filter((heading) => heading.index! < start.index!).at(-1);
      rows.push({
        agente,
        categoria: (normalizePgrText(category[1]) === "acidentes"
          ? "acidente"
          : normalizePgrText(category[1])) as PgrRisk["categoria"],
        setorGhe: rowHeading ? compact(rowHeading[0]) : inheritedSector,
        trecho,
        classificacaoOriginal: compact(classification).slice(0, 150),
        controlesDocumentados: controls ? [compact(controls).slice(0, 500)] : [],
      });
    }
    return { ...page, riscosTabela: rows };
  });
}
