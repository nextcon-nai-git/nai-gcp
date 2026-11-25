import { normalizePgrText, type PgrPage } from "./pgr-schema";

const employee =
  /^(?:dados (?:do|da) )?(?:funcionari[oa]|empregad[oa]|trabalhador[a]?|colaborador[a]?)\s*:?$/;
const otherSection =
  /^(?:dados (?:do|da) )?(?:medic[oa]|profissional|responsavel|examinador|clinica|prestador|empregador|empresa|resultado|conclusao|aptidao|assinatura|exames complementares)\b/;
const label =
  /^(nome(?: d[oa] (?:trabalhador[a]?|colaborador[a]?|funcionári[oa]|empregad[oa]))?|cargo|fun[çc][aã]o|setor|tipo de exame)\s*:\s*(.*)$/iu;
const boundary =
  /\s+(?=(?:resultado|conclus[aã]o|aptid[aã]o|inapto|apto|assinatura|CPF|CNPJ|CRM|CID)\b)|(?<!tipo de)\s+(?=(?:nome|cargo|fun[çc][aã]o|setor|tipo de exame|resultado|conclus[aã]o|aptid[aã]o|apto|inapto|data|m[eé]dic[oa]|assinatura|CRM|CPF|CNPJ|RG|CID|matr[ií]cula|exames?|riscos?)\b\s*(?:[:(]|d[oa]s?\b|cl[ií]nic[oa]\b))|\s*[|;\t]\s*/iu;
const option =
  /(\[\s*[xX]?\s*\]|\(\s*[xX]?\s*\)|[☐☑☒])?\s*(peri[oó]dico|admissional|demissional|retorno ao trabalho|mudan[çc]a de risco ocupacional)/giu;

type Evidence = { pagina: number; trecho: string };
type Exam = { page: number; text: string; marked: boolean; blank: boolean; labelled: boolean };

function examOptions(value: string, page: number, labelled: boolean): Exam[] {
  // Reject prose and unfamiliar marks. All printed alternatives must be accounted for.
  if (value.replace(option, "").replace(/[\s/|;,.–—-]/g, "")) return [];
  return Array.from(value.matchAll(option), ([, mark, text]) => ({
    page,
    text,
    marked: /x|☑|☒/i.test(mark || ""),
    blank: !!mark && !/x|☑|☒/i.test(mark),
    labelled,
  }));
}

export function readAsoFields(pages: PgrPage[]) {
  const fields = new Map<string, Evidence>();
  const kinds = new Set<string>();
  const exams: Exam[] = [];
  let examHeading = false;
  let unclearExam = false;
  function add(page: number, kind: string, text: string) {
    kinds.add(kind);
    if (fields.size < 12)
      fields.set(page + "|" + normalizePgrText(text), { pagina: page, trecho: text });
  }
  for (const { numero, texto } of pages) {
    const lines = texto
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    let section: "worker" | "other" | "unknown" = "unknown";
    for (const [i, line] of lines.entries()) {
      const parts = line
        .split(boundary)
        .map((part) => part.trim())
        .filter(Boolean);
      for (const part of parts) {
        const normalized = normalizePgrText(part);
        if (employee.test(normalized)) {
          section = "worker";
          continue;
        }
        if (/^tipo de exame(?:\s*:|$)/.test(normalized)) {
          section = "unknown";
          examHeading = true;
        } else if (
          /^nome d[oa] (?:trabalhador|colaborador|funcionario|empregado)/.test(normalized)
        ) {
          section = "worker";
        } else if (otherSection.test(normalized)) {
          // A trailing result column ends this row, not the whole employee section.
          if (part === parts[0] || !/^(resultado|conclusao|aptidao)\s*:/.test(normalized))
            section = "other";
          break;
        }
        if (section === "other") continue;
        const match = label.exec(part);
        if (!match) {
          const options = examOptions(part, numero, false);
          if (
            !options.length &&
            /^[[(☐☑☒?].*(?:admissional|peri[oó]dico|demissional|retorno ao trabalho|mudan[çc]a de risco)/iu.test(
              part
            )
          )
            unclearExam = true;
          exams.push(...options);
          continue;
        }
        const [, title, inline] = match;
        const kind = normalizePgrText(title);
        if (kind === "nome" && section !== "worker") continue;
        const next = lines[i + 1] || "";
        const value = inline.trim() || (parts.length === 1 ? next.split(boundary)[0].trim() : "");
        if (
          !value ||
          value.length > 200 ||
          /[:|;\t]/.test(value) ||
          (!inline && otherSection.test(normalizePgrText(value))) ||
          employee.test(normalizePgrText(value))
        )
          continue;
        if (kind === "tipo de exame") {
          const options = examOptions(value, numero, true);
          if (!options.length) unclearExam = true;
          exams.push(...options);
        } else {
          // Names and job descriptions cannot take a checkbox or an exam choice as their value.
          if (examOptions(value, numero, false).length || /[☐☑☒\[\]]/.test(value)) continue;
          add(numero, kind.startsWith("nome") ? "nome" : kind, title + ": " + value);
        }
      }
    }
  }
  const marked = exams.filter((e) => e.marked);
  const selected = marked.length ? marked : exams.filter((e) => !e.blank);
  const unique = new Set(selected.map((e) => normalizePgrText(e.text)));
  const chosen = selected[0];
  const conflictingLabel =
    marked.length &&
    exams.some(
      (e) =>
        e.labelled &&
        !e.blank &&
        !e.marked &&
        normalizePgrText(e.text) !== normalizePgrText(chosen?.text || "")
    );
  const pending =
    unclearExam ||
    (examHeading && !exams.length) ||
    (!!exams.length &&
      (unique.size !== 1 || !!conflictingLabel || (!marked.length && exams.some((e) => e.blank))));
  if (chosen && !pending)
    add(chosen.page, "tipo", (chosen.labelled ? "Tipo de exame: " : "") + chosen.text);
  return {
    fields: [...fields.values()],
    pending,
    complete:
      kinds.has("nome") &&
      (kinds.has("cargo") || kinds.has("funcao")) &&
      kinds.has("setor") &&
      kinds.has("tipo"),
  };
}
