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

export function avpQueueExamType(tipoExame: string) {
  const label = normalizeAvpText(tipoExame.replace(/[_-]+/g, " ")).replace(/^(?:ASO|EXAME) /, "");
  return examAliases.get(label);
}

export type AvpCampaignCount = { additional: number; pending: number };

export function countAvpQueueExams(
  items: ReadonlyArray<Pick<GrupoAvpAso, "tipoExame">>,
  campaign?: AvpCampaignCount | null
) {
  const byType = {
    periodico: campaign?.additional ?? 0,
    admissional: 0,
    demissional: 0,
    retorno: 0,
  };
  let excluded = 0;
  for (const { tipoExame } of items) {
    const type = avpQueueExamType(tipoExame);
    if (type) byType[type]++;
    else excluded++;
  }
  const total = Object.values(byType).reduce((sum, count) => sum + count, 0);
  return { byType, total, excluded };
}
