import { normalizePgrText, type PgrPage, type PgrRisk } from "./pgr-schema";

export type PgrTextItem = { str: string; transform: number[]; width: number };
const compact = (s: string) => s.replace(/\s+/g, " ").trim();
const categories: Record<string, PgrRisk["categoria"]> = {
  fisico: "fisico",
  quimico: "quimico",
  biologico: "biologico",
  ergonomico: "ergonomico",
  acidente: "acidente",
  acidentes: "acidente",
  psicossocial: "psicossocial",
};

/** Read recognized inventory columns from PDF coordinates, never guess an unknown layout. */
export function readPgrRiskTable(input: PgrTextItem[]): NonNullable<PgrPage["riscosTabela"]> {
  const items = input.filter((item) => item.str.trim());
  const text = items.map((item) => item.str).join("\n");
  const ghes = [...text.matchAll(/(?:^|\n)\s*GHE\s*:?\s*\d+\s*[-–]\s*[^\n]+/gi)];
  if (ghes.length !== 1) return [];
  const ghe = ghes[0][0].trim();
  const names = [
    /^Tipo do$/i,
    /^Descrição do Perigo$/i,
    /^Relacionada ao Risco$/i,
    /^Circunstância$/i,
    /^Frequência e$/i,
    /^Prevenção Existentes$/i,
    /^Propagação$/i,
    /^Possíveis Agravos$/i,
    /^S$/,
    /^P$/,
    /^Nível$/i,
    /^Avaliação\s*\/$/i,
    /^Medidas de Prevenção Sugeridas$/i,
  ];
  const headers = names.map((name) => items.find((item) => name.test(item.str.trim())));
  if (headers.some((item) => !item)) return [];
  const centers = headers.map((item) => item!.transform[4] + item!.width / 2);
  if (centers.some((x, i) => i > 0 && x <= centers[i - 1])) return [];
  const headerEnd = Math.max(...headers.map((item) => items.indexOf(item!)));
  const firstDescription = headers[1]!.transform[4];
  const starts = items.flatMap((item, i) =>
    i > headerEnd && item.transform[4] < firstDescription && categories[normalizePgrText(item.str)]
      ? [i]
      : []
  );
  if (!starts.length) return [];
  const body = items.slice(starts[0]);
  // Inline fragments (e.g. a dash inside a sentence) are not starts of columns.
  const lineStarts = body.filter(
    (item, i) => i === 0 || Math.abs(item.transform[5] - body[i - 1].transform[5]) > 2
  );
  const left = centers.map((center, i) => {
    const candidates = lineStarts.filter(
      (item) => item.transform[4] <= center && (i === 0 || item.transform[4] > centers[i - 1])
    );
    return candidates.length ? Math.min(...candidates.map((item) => item.transform[4])) : center;
  });
  left[8] = (centers[7] + centers[8]) / 2;
  left[9] = (centers[8] + centers[9]) / 2;
  left[10] = Math.min(left[10], (centers[9] + centers[10]) / 2);
  const rows: NonNullable<PgrPage["riscosTabela"]> = [];
  for (const [index, start] of starts.entries()) {
    let row = items.slice(start, starts[index + 1] ?? items.length);
    const end = row.findIndex((item) =>
      /^(?:Ausência de|ELABORAÇÃO:|REVISÃO:|GHE\s*:)/i.test(item.str.trim())
    );
    if (end >= 0) row = row.slice(0, end);
    const cells = centers.map(() => [] as string[]);
    for (const item of row) {
      let column = left.findLastIndex((x) => item.transform[4] >= x - 1);
      if (column < 0) column = 0;
      cells[column].push(item.str);
    }
    const values = cells.map((cell) => compact(cell.join(" ")));
    if (
      !values[1] ||
      values[1].length > 180 ||
      !values[2] ||
      !values[7] ||
      values[5].length > 500 ||
      values[10].length > 150 ||
      ghe.length > 350
    )
      continue;
    const category = categories[normalizePgrText(items[start].str)];
    const quote = compact(row.map((item) => item.str).join(" "));
    const numeric =
      /^[1-5]$/.test(values[8]) && /^[1-5]$/.test(values[9]) && /^\d{1,2}$/.test(values[10]);
    rows.push({
      agente: values[1],
      categoria: /psicossocial/i.test(values[1]) ? "psicossocial" : category,
      setorGhe: ghe,
      trecho: quote.slice(0, 1200),
      controlesDocumentados:
        values[5] &&
        !/informa[çc][aã]o n[aã]o dispon[ií]vel|a confirmar|necessita confirma[çc][aã]o/i.test(
          values[5]
        )
          ? [values[5]]
          : [],
      classificacaoOriginal: numeric
        ? `S=${values[8]}; P=${values[9]}; Nível=${values[10]}`
        : values[10],
    });
  }
  // Partial column recognition must not silently hide rows from the fallback reader/AI.
  return rows.length === starts.length ? rows : [];
}
