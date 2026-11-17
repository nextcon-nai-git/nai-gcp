import { normalizeAvpText, periodicCityKey } from "./avp-periodic-control";
import { parseCpf } from "./cpf";
import { avpQueueExamType, type AvpCampaignCount } from "./avp-queue-exam-counts";
import type { GrupoAvpAso } from "./grupo-avp-asos-data";

// A fila não possui CPF. Uma correspondência entre fontes exige nome completo,
// município/UF e pedido no ano da campanha. Dúvidas ficam fora da soma.
export function countAdditionalCampaignExams(
  queue: GrupoAvpAso[],
  campaign: string[][]
): AvpCampaignCount {
  const queueByName = new Map<string, GrupoAvpAso[]>();
  for (const item of queue) {
    if (avpQueueExamType(item.tipoExame) !== "periodico") continue;
    if (item.dataPedidoIso && !item.dataPedidoIso.startsWith("2026-")) continue;
    const name = normalizeAvpText(item.colaborador);
    const rows = queueByName.get(name) ?? [];
    rows.push(item);
    queueByName.set(name, rows);
  }
  const people = new Map<string, { matching: Set<string>; uncertain: boolean }>();
  const candidates = new Map<string, number>();
  let pending = 0;
  for (const row of campaign) {
    const cpf = parseCpf(row[4]);
    if (!cpf) {
      pending++;
      continue;
    }
    const person = people.get(cpf) ?? { matching: new Set<string>(), uncertain: false };
    const name = normalizeAvpText(row[3]);
    for (const item of queueByName.get(name) ?? []) {
      if (
        !item.uf ||
        item.uf === "BR" ||
        !item.cidade ||
        normalizeAvpText(item.cidade) === "NAO INFORMADA"
      ) {
        person.uncertain = true;
        continue;
      }
      if (periodicCityKey(item.cidade, item.uf) !== periodicCityKey(row[1], row[2])) continue;
      if (!item.dataPedidoIso) person.uncertain = true;
      else if (!person.matching.has(item.id)) {
        person.matching.add(item.id);
        candidates.set(item.id, (candidates.get(item.id) ?? 0) + 1);
      }
    }
    people.set(cpf, person);
  }
  let additional = 0;
  for (const { matching, uncertain } of people.values()) {
    if (uncertain || matching.size > 1 || [...matching].some((id) => candidates.get(id) !== 1))
      pending++;
    else if (matching.size === 0) additional++;
  }
  return { additional, pending };
}
