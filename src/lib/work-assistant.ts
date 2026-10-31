import { z } from "zod";
import { KitSelection } from "@/lib/operational-kits";

export const WorkAction = z.object({
  title: z.string().trim().min(3).max(180),
  instructions: z.string().trim().min(3).max(3000),
  responsibleName: z.string().trim().max(180),
  dueDate: z
    .string()
    .refine(
      (s) =>
        !s ||
        (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
          Number.isFinite(new Date(s + "T12:00:00Z").getTime()) &&
          new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s)
    ),
  deadlineBasis: z.enum(["plan", "legal_event", "unconfirmed"]),
  source: z.string().trim().max(500),
});
export const WorkAnswer = z.object({
  answer: z.string().min(1).max(16000),
  actions: z.array(WorkAction).max(10),
});
export const WorkRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("probe"), companyId: z.string().min(1).max(128) }).strict(),
  z.object({
    action: z.literal("chat"),
    companyId: z.string().min(1).max(128),
    kitSelection: KitSelection.optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(12000),
        })
      )
      .min(1)
      .max(12),
  }),
  z.object({
    action: z.literal("apply"),
    companyId: z.string().min(1).max(128),
    proposalId: z.string().uuid(),
  }),
]);
export type WorkActionData = z.infer<typeof WorkAction>;
export const workOutputFormat = {
  type: "json_schema",
  name: "work_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "actions"],
    properties: {
      answer: { type: "string" },
      actions: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "instructions",
            "responsibleName",
            "dueDate",
            "deadlineBasis",
            "source",
          ],
          properties: {
            title: { type: "string" },
            instructions: { type: "string" },
            responsibleName: { type: "string" },
            dueDate: { type: "string" },
            deadlineBasis: { type: "string", enum: ["plan", "legal_event", "unconfirmed"] },
            source: { type: "string" },
          },
        },
      },
    },
  },
};
