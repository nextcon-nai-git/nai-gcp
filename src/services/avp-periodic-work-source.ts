import "server-only";
import { createHash } from "node:crypto";
import {
  CAMPAIGN_HEADERS,
  periodicCampaignIdentity,
  readPeriodicCampaignRows,
  type PeriodicPerson,
} from "@/lib/avp-periodic-control";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sourceRowColumn = CAMPAIGN_HEADERS.indexOf("Linha de origem");

/** Bind work to consolidated identity before the display projection discards private fields. */
export function attachPeriodicWorkSource(people: PeriodicPerson[], campaign: unknown[][]) {
  const groups = new Map<string, string[][]>();
  for (const row of readPeriodicCampaignRows(campaign)) {
    const identity = periodicCampaignIdentity(row);
    const rows = groups.get(identity) || [];
    rows.push(row);
    groups.set(identity, rows);
  }
  const metadata = new Map(
    [...groups].map(([identity, rows]) => [
      `periodico-2026-${rows[0][0]}`,
      {
        workId: `periodico-2026-${hash(["GRUPO_AVP", "2026", identity])}`,
        // The physical sheet row is a locator, not a change to the participant's data.
        workSourceVersion: hash(
          rows
            .map((row) => JSON.stringify(row.filter((_, column) => column !== sourceRowColumn)))
            .sort()
        ),
        workIdentityComplete: !identity.startsWith("source:"),
      },
    ])
  );
  if (metadata.size !== groups.size)
    throw new Error("IDs de origem repetidos para vínculos diferentes. Corrija a campanha.");
  return people.map((person) => {
    const source = metadata.get(person.id);
    if (!source) throw new Error("Participante sem vínculo de origem.");
    return { ...person, ...source };
  });
}
