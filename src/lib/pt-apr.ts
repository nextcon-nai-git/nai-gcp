import { z } from "zod/v3";
export const aprChecks = {
  isolation: "Desenergização e bloqueio da rede (LOTO)",
  equipment: "Inspeção e validade dos EPIs dielétricos",
  area: "Isolamento e sinalização da área",
} as const;
export const aprKeys = ["isolation", "equipment", "area"] as const;
const id = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((v) => !/[\/\\\u0000-\u001f]/.test(v) && ![".", "..", "all", "unauthorized"].includes(v));
const text = z.string().trim().min(3).max(320);
const answer = z
  .object({
    status: z.enum(["confirmed", "pending", "not_applicable"]),
    note: z.string().trim().max(500),
  })
  .strict();
const evidence = z
  .object({
    answers: z.object({ isolation: answer, equipment: answer, area: answer }).strict(),
    hazards: text,
    controls: text,
    teamEvidence: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type AprEvidence = z.infer<typeof evidence>;
export function readyForReview(e: AprEvidence) {
  return (
    evidence.safeParse(e).success &&
    aprKeys.every((k) => e.answers[k].status !== "pending" && e.answers[k].note.trim().length >= 3)
  );
}
const scope = { companyId: id, permitId: z.string().uuid() };
export const permitCommand = z.discriminatedUnion("action", [
  z
    .object({ ...scope, action: z.literal("create"), employeeId: id, task: text, location: text })
    .strict(),
  z
    .object({ ...scope, action: z.literal("review"), evidence, confirmed: z.literal(true) })
    .strict(),
]);

export interface WorkPermit {
  id: string;
  employeeId: string;
  employeeName: string;
  task: string;
  location: string;
  createdAt: string;
  createdBy: string;
  status: "awaiting_review" | "awaiting_signature";
  evidence?: AprEvidence;
  reviewedAt?: string;
  reviewerUid?: string;
  reviewerName?: string;
  evidenceName?: string;
}
