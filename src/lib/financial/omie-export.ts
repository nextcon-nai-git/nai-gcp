import { z } from "zod";
import { isCalendarDate, omieAmountUnits, omieUnitsToCents } from "./omie-dre";

const titleId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const source = {
  sourceId: titleId,
  kind: z.enum(["supplier", "payable", "receivable"]),
};
function validateSource(value: z.infer<typeof ExportReferenceBase>, ctx: z.RefinementCtx) {
  if (value.kind === "supplier" && !z.string().uuid().safeParse(value.sourceId).success)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceId"],
      message: "Fornecedor inválido.",
    });
}
const ExportReferenceBase = z.object(source);
export const ExportReference = ExportReferenceBase.strict().superRefine(validateSource);
export const OmieExport = z
  .object({
    ...source,
    key: z.string(),
    scope: z.string(),
    company: z.string(),
    hash: z.string(),
    payload: z.record(z.unknown()),
    status: z.enum(["reserved", "confirmed"]),
    remoteId: z.number().int().positive().nullable(),
    actor: z.string(),
    at: z.string(),
    confirmedAt: z.string().nullable(),
    confirmedBy: z.string().nullable(),
  })
  .superRefine(validateSource);
export type OmieExportRecord = z.infer<typeof OmieExport>;
const characteristic = z
  .object({
    field: z.string().trim().min(1).max(30),
    value: z.string().trim().min(1).max(60),
  })
  .strict();
export const SupplierRegistration = z
  .object({
    address: z.string().trim().min(1).max(60),
    number: z.string().trim().min(1).max(60),
    district: z.string().trim().min(1).max(60),
    city: z.string().trim().min(1).max(40),
    state: z.enum([
      "AC",
      "AL",
      "AP",
      "AM",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MT",
      "MS",
      "MG",
      "PA",
      "PB",
      "PR",
      "PE",
      "PI",
      "RJ",
      "RN",
      "RS",
      "RO",
      "RR",
      "SC",
      "SP",
      "SE",
      "TO",
    ]),
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/),
    characteristics: z
      .array(characteristic)
      .max(30)
      .refine(
        (rows) => new Set(rows.map((r) => r.field.toLocaleUpperCase("pt-BR"))).size === rows.length,
        "Característica repetida."
      ),
    requirementsReviewed: z.literal(true),
  })
  .strict();
export const ExportSelection = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("supplier"),
      sourceId: z.string().uuid(),
      registration: SupplierRegistration,
    })
    .strict(),
  z
    .object({
      kind: z.enum(["payable", "receivable"]),
      sourceId: titleId,
      partyCode: z.number().int().positive(),
      categoryCode: z.string().trim().min(1).max(20),
      accountCode: z.number().int().positive(),
      issueDate: z.string().refine(isCalendarDate, "Data de emissão inválida."),
    })
    .strict(),
]);
export type ExportSelectionType = z.infer<typeof ExportSelection>;
export function omieIntegrationKey(kind: string, id: string) {
  return `NAI-${kind}-${id}`;
}
export const normalizeDocument = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();
const normalizedText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
function matchesRegistration(payload: Record<string, unknown>, data: Record<string, unknown>) {
  for (const key of ["endereco", "endereco_numero", "bairro", "estado"]) {
    if (payload[key] !== undefined && normalizedText(data[key]) !== normalizedText(payload[key]))
      return false;
  }
  if (
    payload.cep !== undefined &&
    String(data.cep || "").replace(/\D/g, "") !== String(payload.cep).replace(/\D/g, "")
  )
    return false;
  if (
    payload.cidade !== undefined &&
    normalizedText(data.cidade) !== normalizedText(payload.cidade) &&
    String(data.cidade_ibge || "") !== String(payload.cidade)
  )
    return false;
  if (Array.isArray(payload.caracteristicas) && payload.caracteristicas.length) {
    const fields = z.array(z.object({ campo: z.string(), conteudo: z.string() }));
    const expected = fields.safeParse(payload.caracteristicas),
      actual = fields.safeParse(data.caracteristicas);
    if (
      !expected.success ||
      !actual.success ||
      expected.data.some(
        (c) =>
          !actual.data.some(
            (remote) =>
              normalizedText(remote.campo) === normalizedText(c.campo) &&
              remote.conteudo.trim() === c.conteudo.trim()
          )
      )
    )
      return false;
  }
  return true;
}
export function matchesOmieExport(
  record: OmieExportRecord,
  data: Record<string, unknown>
): number | null {
  const p = record.payload;
  if (record.kind === "supplier") {
    if (
      data.codigo_cliente_integracao !== record.key ||
      typeof data.cnpj_cpf !== "string" ||
      normalizeDocument(data.cnpj_cpf) !== normalizeDocument(String(p.cnpj_cpf)) ||
      normalizedText(data.razao_social) !== normalizedText(p.razao_social) ||
      String(data.email || "").toLowerCase() !== String(p.email).toLowerCase() ||
      !matchesRegistration(p, data)
    )
      return null;
  } else {
    if (
      data.codigo_lancamento_integracao !== record.key ||
      data.codigo_cliente_fornecedor !== p.codigo_cliente_fornecedor ||
      data.data_vencimento !== p.data_vencimento ||
      data.codigo_categoria !== p.codigo_categoria ||
      data.id_conta_corrente !== p.id_conta_corrente ||
      (p.data_emissao !== undefined && data.data_emissao !== p.data_emissao) ||
      typeof data.valor_documento !== "number" ||
      typeof p.valor_documento !== "number"
    )
      return null;
    try {
      if (
        omieUnitsToCents(omieAmountUnits(data.valor_documento)) !==
        omieUnitsToCents(omieAmountUnits(p.valor_documento))
      )
        return null;
    } catch {
      return null;
    }
  }
  const id = data[record.kind === "supplier" ? "codigo_cliente_omie" : "codigo_lancamento_omie"];
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}
