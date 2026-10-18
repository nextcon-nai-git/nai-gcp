import { z } from "zod";
import { ObligationSchema, MAX_OBLIGATIONS } from "./obligations";
/** Null denotes absent/unreadable information; no defaults become contract facts. */
export const ExtractionSchema = z.object({
  clientName: z.string().max(180).nullable(),
  cnpj: z.string().max(30).nullable(),
  scope: z.string().max(2000).nullable(),
  units: z.string().max(1000).nullable(),
  deliverables: z.string().max(2000).nullable(),
  valueCents: z.number().int().nonnegative().max(100_000_000_000).nullable(),
  startsOn: z.string().max(10).nullable(),
  endsOn: z.string().max(10).nullable(),
  paymentTerms: z.string().max(2000).nullable(),
  recurring: z.boolean().nullable(),
  obligations: z.array(ObligationSchema).max(MAX_OBLIGATIONS).default([]),
  references: z
    .array(
      z.object({
        field: z.string().max(100),
        pageOrClause: z.string().max(180),
        excerpt: z.string().max(300),
      })
    )
    .max(20),
  pending: z.array(z.string().max(500)).max(20),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
