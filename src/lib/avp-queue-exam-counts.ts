import { normalizeAvpText, type GrupoAvpAso } from "./grupo-avp-asos-data";

export const avpQueueExamTypes = [
  ["periodico", "Periódicos"],
  ["admissional", "Admissionais"],
  ["demissional", "Demissionais"],
  ["retorno", "Retorno ao trabalho"],
] as const;

type ExamType = (typeof avpQueueExamTypes)[number][0];

// Inclui grafias encontradas no campo EXAME da fila de agendamentos AVP.
const examAliases = new Map<string, ExamType>([
  ["PERIODICO", "periodico"],
  ["PERIODICOS", "periodico"],
  ["ADMISSIONAL", "admissional"],
  ["ADMISSIONAIS", "admissional"],
  ["ADMISSAO", "admissional"],
  ["ADIMISSIONAL", "admissional"],
  ["ADMISIONAL", "admissional"],
  ["ADMISSONAL", "admissional"],
  ["ADMSSIONAL", "admissional"],
  ["ADMISSIOANL", "admissional"],
  ["DEMISSIONAL", "demissional"],
  ["DEMISSIONAIS", "demissional"],
  ["DEMISSAO", "demissional"],
  ["DEMISSIO", "demissional"],
  ["DEMISSONAL", "demissional"],
  ["RETORNO", "retorno"],
  ["RETORNO AO TRABALHO", "retorno"],
  ["RETORNO DO TRABALHO", "retorno"],
  ["RETORNO TRABALHO", "retorno"],
]);

export function countAvpQueueExams(items: ReadonlyArray<Pick<GrupoAvpAso, "tipoExame">>) {
  const byType = { periodico: 0, admissional: 0, demissional: 0, retorno: 0 };
  for (const { tipoExame } of items) {
    const label = normalizeAvpText(tipoExame.replace(/[_-]+/g, " ")).replace(/^(?:ASO|EXAME) /, "");
    const type = examAliases.get(label);
    if (type) byType[type]++;
  }
  const total = Object.values(byType).reduce((sum, count) => sum + count, 0);
  return { byType, total, excluded: items.length - total };
}
