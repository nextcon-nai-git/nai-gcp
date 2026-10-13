import "server-only";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { InvoiceQuerySchema, type InvoiceQuery, type FiscalPage } from "@/lib/financial/nfse";
import { omieConnectorSession } from "@/services/omie-financial";
import { omieAmountUnits, omieUnitsToCents } from "@/lib/financial/omie-dre";

// A provider boundary keeps Omie contracts out of the fiscal workspace.
// A direct national adapter must be implemented and homologated before enabling it.
interface InvoiceReader {
  list(user: AuthContext, query: InvoiceQuery): Promise<FiscalPage>;
}
const text = z.string().max(200);
const digits = (v: string) => v.replace(/\D/g, "");
const row = z.object({
  Cabecalho: z.object({
    nCodNF: z.number().int().positive().safe(),
    nNumeroNFSe: text,
    nValorNFSe: z.number().finite().nonnegative().max(1e12),
    cStatusNFSe: z.enum(["C", "F", "N"]),
    cAmbienteNFSe: z.enum(["H", "P"]),
    cCNPJEmissor: text.refine((v) => /^\d{14}$/.test(digits(v))),
    cIMEmissor: text.default(""),
    cCidadeEmissor: text.default(""),
    cRazaoDestinatario: text,
  }),
  Emissao: z.object({ cDataEmissao: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/) }),
  OrdemServico: z.object({ nNumeroOS: text.default("") }).optional(),
});
const responseSchema = z.object({
  nPagina: z.number().int().min(1),
  nTotPaginas: z.number().int().nonnegative(),
  nRegistros: z.number().int().min(0).max(20),
  nTotRegistros: z.number().int().nonnegative(),
  nfseEncontradas: z.array(row).max(20).default([]),
});
const invalid = () =>
  new AuthError("Não foi possível validar as notas para a empresa e o período consultados.", 503);
const omieReader: InvoiceReader = {
  async list(user, query) {
    const session = await omieConnectorSession(user);
    const toOmie = (v: string) => v.split("-").reverse().join("/");
    const parsed = responseSchema.safeParse(
      await session.call("invoices", {
        nPagina: query.page,
        nRegPorPagina: 20,
        dEmiInicial: toOmie(query.start),
        dEmiFinal: toOmie(query.end),
        cAmbienteNFSe: query.environment,
        cExibirDescricao: "N",
        cExibirDepartamentos: "N",
      })
    );
    if (!parsed.success) throw invalid();
    const data = parsed.data;
    if (
      data.nPagina !== query.page ||
      data.nRegistros !== data.nfseEncontradas.length ||
      data.nTotRegistros < data.nRegistros ||
      (data.nTotRegistros === 0
        ? query.page !== 1 || data.nRegistros !== 0 || data.nTotPaginas > 1
        : data.nTotPaginas < query.page || data.nRegistros === 0)
    )
      throw invalid();
    const seen = new Set<number>();
    const invoices = data.nfseEncontradas.map((item) => {
      const h = item.Cabecalho;
      const issuedOn = item.Emissao.cDataEmissao.split("/").reverse().join("-");
      const validDate = new Date(issuedOn + "T00:00:00Z");
      if (
        digits(h.cCNPJEmissor) !== digits(session.cnpj) ||
        h.cAmbienteNFSe !== query.environment ||
        issuedOn < query.start ||
        issuedOn > query.end ||
        !Number.isFinite(validDate.getTime()) ||
        validDate.toISOString().slice(0, 10) !== issuedOn ||
        seen.has(h.nCodNF)
      )
        throw invalid();
      seen.add(h.nCodNF);
      let amountCents: number;
      try {
        amountCents = omieUnitsToCents(omieAmountUnits(h.nValorNFSe));
      } catch {
        throw invalid();
      }
      return {
        id: `omie:${h.nCodNF}`,
        number: h.nNumeroNFSe,
        customer: h.cRazaoDestinatario,
        issuedOn,
        amountCents,
        status: ({ C: "cancelled", F: "billed", N: "not_billed" } as const)[h.cStatusNFSe],
        issuerDocument: digits(h.cCNPJEmissor),
        issuerMunicipalRegistration: h.cIMEmissor,
        issuerCity: h.cCidadeEmissor,
        orderNumber: item.OrdemServico?.nNumeroOS || "",
      };
    });
    return {
      provider: "omie",
      company: session.company,
      cnpj: session.cnpj,
      environment: query.environment,
      page: data.nPagina,
      pages: data.nTotPaginas,
      total: data.nTotRegistros,
      invoices,
    };
  },
};
export async function listFiscalInvoices(user: AuthContext, input: unknown): Promise<FiscalPage> {
  requireFinancialAccess(user);
  const parsed = InvoiceQuerySchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Informe ambiente, página e datas válidas em um período de até 12 meses.");
  if (parsed.data.provider === "national")
    throw new AuthError(
      "Emissão direta ainda não implementada e homologada. Use o Omie nesta etapa.",
      409
    );
  return omieReader.list(user, parsed.data);
}
