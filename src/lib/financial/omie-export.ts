import { z } from "zod";
export const OmieExport = z.object({
  sourceId: z.string().uuid(),
  kind: z.enum(["supplier", "payable", "receivable"]),
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
});
export type OmieExportRecord = z.infer<typeof OmieExport>;
export const ExportSelection = z
  .object({
    kind: z.enum(["supplier", "payable", "receivable"]),
    sourceId: z.string().uuid(),
    partyCode: z.number().int().positive().optional(),
    categoryCode: z.string().trim().min(1).max(30).optional(),
    accountCode: z.number().int().positive().optional(),
  })
  .strict();
export type ExportSelectionType = z.infer<typeof ExportSelection>;
export function omieIntegrationKey(kind: string, id: string) {
  return `NAI-${kind}-${id}`;
}
export const normalizeDocument = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();
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
      data.razao_social !== p.razao_social ||
      String(data.email || "").toLowerCase() !== String(p.email).toLowerCase()
    )
      return null;
  } else {
    if (
      data.codigo_lancamento_integracao !== record.key ||
      data.codigo_cliente_fornecedor !== p.codigo_cliente_fornecedor ||
      data.data_vencimento !== p.data_vencimento ||
      data.codigo_categoria !== p.codigo_categoria ||
      data.id_conta_corrente !== p.id_conta_corrente ||
      typeof data.valor_documento !== "number" ||
      Math.round(data.valor_documento * 100) !== Math.round(Number(p.valor_documento) * 100)
    )
      return null;
  }
  const id = data[record.kind === "supplier" ? "codigo_cliente_omie" : "codigo_lancamento_omie"];
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}
