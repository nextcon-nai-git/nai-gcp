import { z } from "zod";

export const AVP_COST_BANDS = {
  green: { label: "Abaixo de R$ 40", color: "#15803d", className: "bg-green-100 text-green-900" },
  yellow: {
    label: "R$ 40 a menos de R$ 50",
    color: "#ca8a04",
    className: "bg-yellow-100 text-yellow-950",
  },
  red: { label: "R$ 50 a R$ 60", color: "#dc2626", className: "bg-red-100 text-red-900" },
  purple: { label: "Acima de R$ 60", color: "#9333ea", className: "bg-purple-100 text-purple-900" },
  unknown: {
    label: "Valor não apurado",
    color: "#64748b",
    className: "bg-slate-100 text-slate-700",
  },
} as const;
export function avpCostBand(cents: number | null | undefined): keyof typeof AVP_COST_BANDS {
  if (cents == null || !Number.isSafeInteger(cents) || cents < 0) return "unknown";
  if (cents < 4000) return "green";
  if (cents < 5000) return "yellow";
  if (cents <= 6000) return "red";
  return "purple";
}
const text = (max: number) => z.string().trim().max(max);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida");
const common = {
  id: hash,
  source: text(500).min(1),
  sourceHash: hash,
  notes: text(3000),
};
export const AvpPaymentSchema = z
  .object({
    ...common,
    kind: z.literal("payment"),
    clinic: text(240).min(1),
    date: day,
    amountCents: z.number().int().positive().max(100000000),
    unitCents: z.number().int().positive().max(10000000).nullable(),
    quantity: z.number().int().positive().max(10000).nullable(),
    city: text(160),
    uf: text(2),
    employees: text(3000),
    transactionId: text(100),
    confirmation: z.enum(["Comprovante", "Solicitado"]),
    scope: z.enum(["AVP", "Revisar vínculo"]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.unitCents !== null && v.quantity !== null && v.unitCents * v.quantity !== v.amountCents)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor unitário e quantidade divergem do total.",
      });
  });
export const AvpAsoEvidenceSchema = z
  .object({
    ...common,
    kind: z.literal("aso"),
    employee: text(240).min(2),
    company: text(240).min(1),
    examType: text(80),
    examDate: text(10),
    receivedDate: text(10),
    city: text(160),
    uf: text(2),
    fileName: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]+\.pdf$/)
      .max(180),
    fileHash: hash,
    review: z.enum(["Recebido", "Conferir vínculo", "Conferir retificação"]),
  })
  .strict();
export const AvpEvidenceSchema = z.union([AvpPaymentSchema, AvpAsoEvidenceSchema]);
export type AvpPayment = z.infer<typeof AvpPaymentSchema>;
export type AvpAsoEvidence = z.infer<typeof AvpAsoEvidenceSchema>;
export type AvpEvidence = z.infer<typeof AvpEvidenceSchema>;

export function avpEvidenceCsv(records: AvpPayment[]) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^(?=\s*[=+@-])/, "'")
      .replace(/"/g, '""') +
    '"';
  const rows = records.map((r) => [
    r.date,
    r.clinic,
    r.city,
    r.uf,
    r.employees,
    r.amountCents / 100,
    r.quantity,
    r.unitCents == null ? "" : r.unitCents / 100,
    AVP_COST_BANDS[avpCostBand(r.unitCents)].label,
    r.confirmation,
    r.scope,
    r.source,
    r.notes,
  ]);
  return (
    "\uFEFF" +
    [
      [
        "Data",
        "Clínica",
        "Cidade",
        "UF",
        "Colaboradores",
        "Total R$",
        "Quantidade",
        "Unitário R$",
        "Semáforo unitário",
        "Evidência",
        "Vínculo",
        "Fonte",
        "Observações",
      ],
      ...rows,
    ]
      .map((r) => r.map(cell).join(";"))
      .join("\r\n")
  );
}
