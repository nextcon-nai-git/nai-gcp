import type { AsoIngestionOutput } from "./aso-full-ingestion-flow";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
import { normalizePgrText } from "@/lib/pgr-schema";

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

function isoDocumentDate(value: string) {
  const match = value.match(/\b(?:(\d{2})[/-](\d{2})[/-](\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/);
  if (!match) return "";
  const year = Number(match[3] || match[4]);
  const month = Number(match[2] || match[5]);
  const day = Number(match[1] || match[6]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Text transcription only. Binary bytes and filenames cannot establish clinical facts. */
export function parseAsoTextWithHeuristics(
  rawContent: string,
  _fileName?: string
): AsoIngestionOutput {
  const text = rawContent.trim();
  if (
    !text ||
    text.startsWith("data:") ||
    !/\b(?:aso|atestado de saude ocupacional)\b/.test(normalizePgrText(text))
  )
    throw new Error(
      "Não foi possível ler o conteúdo do ASO. Reenvie um documento legível para análise; nenhum dado clínico foi presumido."
    );

  const lines = text.split(/\r?\n/).map(compact).filter(Boolean);
  const field = (labels: string) => {
    const pattern = new RegExp(`^(?:${labels})[ \\t]*[:–-][ \\t]*(.+)$`, "i");
    const values = lines.flatMap((line) => {
      const match = line.match(pattern);
      return match && match[1].trim() ? [match[1].trim()] : [];
    });
    return new Set(values.map(normalizePgrText)).size === 1 ? values[0] : "";
  };
  const employer = parsePgrDocumentPages([{ numero: 1, texto: text }]);
  const identifiedEmployer = employer.identidade.status === "identificada";

  // Unmarked form options are not medical conclusions. A checked option takes precedence.
  const choices = (pattern: RegExp) => {
    const selected = lines
      .flatMap((line) =>
        [...line.matchAll(/\[[xX]\]|\([xX]\)|[☒☑]/g)].map((match) =>
          normalizePgrText(
            line
              .slice((match.index || 0) + match[0].length)
              .split(/\[[\sxX]*\]|\([\sxX]*\)|[☐□☒☑]/)[0]
          )
        )
      )
      .filter((line) => pattern.test(line));
    return selected.length
      ? selected
      : lines
          .filter((line) => !/\[[\sxX]*\]|\([\sxX]*\)|[☐□☒☑]/.test(line))
          .map(normalizePgrText)
          .filter((line) => pattern.test(line));
  };
  const outcomePattern =
    /^(?:(?:resultado(?: do aso)?|conclusao|parecer(?: medico)?)\s*[:–-]\s*)?(apto com restricoes|inapto|apto)\b/;
  const outcomes = choices(outcomePattern)
    .filter((line) => (line.match(/\b(?:apto com restricoes|inapto|apto)\b/g) || []).length === 1)
    .map((line) => line.match(outcomePattern)![1]);
  const outcome = new Set(outcomes).size === 1 ? outcomes[0] : "";
  const resultadoAso: AsoIngestionOutput["asoInfo"]["resultadoAso"] =
    outcome === "inapto"
      ? "Inapto"
      : outcome === "apto com restricoes"
        ? "Apto com Restrições"
        : outcome === "apto"
          ? "Apto"
          : "Não Informado";

  const typePattern =
    /^(?:tipo\s*(?:de|do)?\s*(?:aso|exame)\s*[:–-]\s*)?(admissional|periodico|demissional|retorno ao trabalho|mudanca de funcao|mudanca de risco ocupacional)\b/;
  const types = choices(typePattern)
    .filter(
      (line) =>
        (
          line.match(
            /\b(?:admissional|periodico|demissional|retorno ao trabalho|mudanca de funcao|mudanca de risco ocupacional)\b/g
          ) || []
        ).length === 1
    )
    .map((line) => line.match(typePattern)![1]);
  const typeNames: Record<string, AsoIngestionOutput["asoInfo"]["tipoAso"]> = {
    admissional: "Admissional",
    periodico: "Periódico",
    demissional: "Demissional",
    "retorno ao trabalho": "Retorno ao Trabalho",
    "mudanca de funcao": "Mudança de Função",
    "mudanca de risco ocupacional": "Mudança de Risco Ocupacional",
  };
  const tipoAso = new Set(types).size === 1 ? typeNames[types[0]] : "Não Informado";
  const examPattern =
    /\b(?:audiometria|espirometria|raio[ -]?x|rx\s+(?:t[oó]rax|oit)|hemograma|glicemia|acuidade\s+visual|eletrocardiograma|ecg|eletroencefalograma|eeg|toxicol[oó]gico|avalia[çc][aã]o\s+psicossocial|exame\s+cl[ií]nico)\b/i;
  const examesRealizados: AsoIngestionOutput["examesRealizados"] = [];
  for (const line of lines) {
    const row = line.replace(/^[-•]\s*/, "");
    const match = examPattern.exec(row);
    if (
      !match ||
      match.index > 15 ||
      /\b(?:solicitar|pendente|recomendad[oa]|nao realizad[oa])\b/.test(normalizePgrText(row))
    )
      continue;
    const nomeExame = compact(
      row.slice(match.index).split(/\s*[:|;]\s*|\s+\d{2}[/-]\d{2}[/-]\d{4}|\s+\d{4}-\d{2}-\d{2}/)[0]
    );
    const normalized = normalizePgrText(row);
    const normal = /\bnormal\b|\bsem alteracoes\b/.test(normalized);
    const altered = /\balterad[oa]\b/.test(normalized);
    examesRealizados.push({
      nomeExame,
      dataExame: isoDocumentDate(row),
      resultado: normal === altered ? "Não Informado" : normal ? "Normal" : "Alterado",
      detalheAlteracao: altered && !normal ? row : "",
    });
  }

  return {
    empresaIdentificada: identifiedEmployer ? employer.pgrCardDetalhado.razaoSocial : "",
    cnpjEmpresa: identifiedEmployer ? employer.pgrCardDetalhado.cnpj : "",
    colaborador: {
      nome: field(
        "colaborador(?:a)?|funcion[aá]rio(?:a)?|nome (?:do|da) (?:trabalhador|trabalhadora|colaborador|colaboradora|empregado|empregada)|empregado|paciente|nome"
      ).toUpperCase(),
      cpf:
        field("CPF(?: (?:do|da) (?:trabalhador|colaborador|empregado|paciente))?").match(
          /^(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})\b/
        )?.[0] || "",
      rgOuMatricula: field("RG|matr[ií]cula"),
      cargoFuncao: field("cargo|fun[çc][aã]o|ocupa[çc][aã]o"),
      setorGhe: field("setor|GHE|departamento"),
      dataNascimento: isoDocumentDate(field("data de nascimento|nascimento")),
    },
    asoInfo: {
      tipoAso,
      dataEmissao: isoDocumentDate(
        field("data (?:de emiss[aã]o|do exame|de realiza[çc][aã]o)|emiss[aã]o|data")
      ),
      dataValidade: isoDocumentDate(field("data de validade|validade|pr[oó]ximo ASO")),
      resultadoAso,
      restricoesDetalhadas: field("restri[çc][oõ]es(?: detalhadas)?"),
      medicoExaminador: field(
        "m[eé]dico examinador|m[eé]dico coordenador|m[eé]dico respons[aá]vel|m[eé]dico"
      ),
      crmMedico:
        lines.find((line) =>
          /^CRM\b[\s:/-]*(?:[A-Z]{2}[\s:/-]*)?\d{3,7}(?:[\s/-]*[A-Z]{2})?$/i.test(line)
        ) || "",
    },
    examesRealizados,
    acoesSaudeRecomendadas: [],
    resumoEpidemiologico:
      "Extração textual preliminar do ASO. Confira identificação, datas, resultado e exames no original com o profissional autorizado. Campos não documentados permanecem sem informação; nenhuma conclusão clínica foi criada.",
    scoreConfiabilidade: 0,
  };
}
