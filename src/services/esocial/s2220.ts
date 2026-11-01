import { z } from "zod";
import { EsocialEventInputSchema } from "@/lib/esocial-events";
import { buildEsocialEventXml } from "./events";

/** Keep the former draft API while sharing the current, checksum-aware event schema. */
export const S2220Input = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input;
    const data = input as Record<string, unknown>;
    if (data.eventType && data.eventType !== "S2220") return input;
    const { ideTrabalhador, ...rest } = data;
    return { ...rest, eventType: "S2220", ideVinculo: data.ideVinculo || ideTrabalhador };
  },
  EsocialEventInputSchema.refine((data) => data.eventType === "S2220", "Esperado S-2220.")
);

/** Synchronous unsigned draft only. New persistence must use generateEsocialEvent for XSD validation. */
export function buildS2220Xml(input: unknown): string {
  const parsed = S2220Input.safeParse(input);
  if (!parsed.success || !parsed.data.id) {
    const location = parsed.success ? "id" : parsed.error.issues[0]?.path.join(".");
    throw new Error(`Dados do S-2220 incompletos ou inválidos: confira ${location || "o ASO"}.`);
  }
  return buildEsocialEventXml(parsed.data);
}
