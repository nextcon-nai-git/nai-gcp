import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
export const InvoiceQuerySchema = z
  .object({
    provider: z.enum(["omie", "national"]).default("omie"),
    start: date,
    end: date,
    environment: z.enum(["P", "H"]),
    page: z.number().int().min(1).max(10000).default(1),
  })
  .strict()
  .refine(
    (q) => q.start <= q.end && Date.parse(q.end) - Date.parse(q.start) <= 366 * 86400000,
    "Selecione um período de até 12 meses"
  );
export type InvoiceQuery = z.infer<typeof InvoiceQuerySchema>;
export type FiscalInvoice = {
  id: string;
  number: string;
  customer: string;
  issuedOn: string;
  amountCents: number;
  status: "billed" | "cancelled" | "not_billed";
  issuerDocument: string;
  issuerMunicipalRegistration: string;
  issuerCity: string;
  orderNumber: string;
};
export type FiscalPage = {
  provider: "omie";
  company: string;
  cnpj: string;
  environment: "H" | "P";
  page: number;
  pages: number;
  total: number;
  invoices: FiscalInvoice[];
};
export const fiscalStatusLabel = {
  billed: "Faturada no Omie",
  cancelled: "Cancelada",
  not_billed: "Não faturada",
} as const;
