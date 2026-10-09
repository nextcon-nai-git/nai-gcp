import { z } from "zod";
import { isValidPgrCnpj } from "@/lib/pgr-schema";

export const MONTHLY_CONTRACT_ID = "fixed-monthly-billing";
export const MonthlyBillingRowSchema = z
  .object({
    cnpj: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine(isValidPgrCnpj, "CNPJ inválido."),
    name: z.string().trim().min(3).max(300),
    valueCents: z.number().int().min(1).max(100_000_000_000),
  })
  .strict();
export const MonthlyBillingImportSchema = z
  .object({
    groupCompanyId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^/\u0000]+$/),
    sourceName: z.string().trim().min(1).max(200),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    confirmed: z.literal(true),
    rows: z.array(MonthlyBillingRowSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.rows.forEach((row, index) => {
      if (seen.has(row.cnpj))
        ctx.addIssue({
          code: "custom",
          path: ["rows", index, "cnpj"],
          message: "CNPJ repetido no lote.",
        });
      seen.add(row.cnpj);
    });
  });
export type MonthlyBillingRow = z.infer<typeof MonthlyBillingRowSchema>;
export type MonthlyBillingImport = z.infer<typeof MonthlyBillingImportSchema>;
export type MonthlyBillingView = {
  groups: { id: string; name: string }[];
  group: { id: string; name: string; portfolioClientId: string } | null;
  revision: string;
  records: (MonthlyBillingRow & { companyId: string; sourceName: string })[];
  totalCents: number;
};

/** Excel paste: CNPJ, legal name and BRL amount. Reject ambiguous or missing amounts. */
export function parseMonthlyBillingPaste(text: string): MonthlyBillingRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines[0]?.split("\t")[0].trim().toUpperCase() === "CNPJ") lines.shift();
  if (!lines.length || lines.length > 100)
    throw new Error("Cole de 1 a 100 empresas, sem a linha de total.");
  const rows = lines.map((line, index) => {
    const columns = line.split("\t");
    if (columns.length !== 3)
      throw new Error(`Linha ${index + 1}: use três colunas separadas por tabulação.`);
    const raw = columns[2].trim().replace(/^R\$\s*/, "");
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw)) {
      throw new Error(`Linha ${index + 1}: informe o valor em reais, como 1.234,56.`);
    }
    const [whole, fraction = ""] = raw.replace(/\./g, "").split(",");
    const parsed = MonthlyBillingRowSchema.safeParse({
      cnpj: columns[0],
      name: columns[1],
      valueCents: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
    });
    if (!parsed.success) throw new Error(`Linha ${index + 1}: ${parsed.error.issues[0].message}`);
    return parsed.data;
  });
  if (new Set(rows.map((r) => r.cnpj)).size !== rows.length)
    throw new Error("Há CNPJs repetidos no lote.");
  return rows;
}

export function billingGroupId(company: { id: string; portfolioClientId?: unknown }) {
  return typeof company.portfolioClientId === "string" && company.portfolioClientId
    ? company.portfolioClientId
    : company.id;
}

export function resolveBillingCompany(
  row: MonthlyBillingRow,
  companies: { id: string; cnpj?: unknown; portfolioClientId?: unknown; isDeleted?: unknown }[],
  groupId: string
) {
  const matches = companies.filter((c) => String(c.cnpj || "").replace(/\D/g, "") === row.cnpj);
  if (matches.length > 1)
    throw new Error(`O CNPJ ${row.cnpj} possui cadastros duplicados. Revise antes de importar.`);
  const existing = matches[0];
  if (!existing && companies.some((c) => c.id === row.cnpj))
    throw new Error(`O identificador ${row.cnpj} já pertence a outro cadastro.`);
  if (existing?.isDeleted === true)
    throw new Error(`O CNPJ ${row.cnpj} está excluído. Revise o cadastro antes de importar.`);
  if (existing?.portfolioClientId && existing.portfolioClientId !== groupId)
    throw new Error(`O CNPJ ${row.cnpj} já pertence a outro grupo.`);
  return existing?.id || row.cnpj;
}
