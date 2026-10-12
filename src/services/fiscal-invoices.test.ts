import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), call: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/omie-financial", () => ({ omieConnectorSession: m.session }));
import { listFiscalInvoices } from "./fiscal-invoices";
import type { AuthContext } from "@/lib/auth/auth-context";
const admin = { uid: "admin", role: "SUPER_ADMIN", tenantId: null } as AuthContext;
const query = { start: "2026-10-01", end: "2026-10-31", environment: "P", page: 1 };
const fixture = () => ({
  nPagina: 1,
  nTotPaginas: 1,
  nRegistros: 1,
  nTotRegistros: 1,
  nfseEncontradas: [
    {
      Cabecalho: {
        nCodNF: 123,
        nNumeroNFSe: "5",
        nValorNFSe: 123.45,
        cStatusNFSe: "F",
        cAmbienteNFSe: "P",
        cCNPJEmissor: "12345678000190",
        cRazaoDestinatario: "Cliente sintético",
      },
      Emissao: { cDataEmissao: "05/10/2026" },
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ cnpj: "12.345.678/0001-90", company: "Teste", call: m.call });
  m.call.mockResolvedValue(fixture());
});
describe("fiscal provider boundary", () => {
  it("normalizes the official Omie contract without claiming authorization", async () => {
    const data = await listFiscalInvoices(admin, query);
    expect(data.invoices[0]).toMatchObject({
      amountCents: 12345,
      status: "billed",
      issuedOn: "2026-10-05",
    });
    expect(m.call).toHaveBeenCalledWith(
      "invoices",
      expect.objectContaining({ nPagina: 1, dEmiInicial: "01/10/2026", cAmbienteNFSe: "P" })
    );
    expect(m.call).toHaveBeenCalledOnce();
  });
  it.each(["DOCTOR", "PROVIDER", "CLIENT_ADMIN"])(
    "denies %s before reading credentials",
    async (role) => {
      await expect(
        listFiscalInvoices({ ...admin, role } as AuthContext, query)
      ).rejects.toMatchObject({ status: 403 });
      expect(m.session).not.toHaveBeenCalled();
    }
  );
  it("blocks tenant administrators", async () => {
    await expect(
      listFiscalInvoices({ ...admin, role: "ADMIN", tenantId: "tenant" }, query)
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each([
    { provider: "national" },
    { start: "2026-02-30" },
    { start: "2026-11-01" },
    { start: "2024-01-01" },
    { method: "FaturarOS" },
  ])("fails closed for unsupported input %j", async (patch) => {
    await expect(listFiscalInvoices(admin, { ...query, ...patch })).rejects.toBeDefined();
    expect(m.call).not.toHaveBeenCalled();
  });
  it.each([
    { cCNPJEmissor: "99999999000199" },
    { cAmbienteNFSe: "H" },
    { nValorNFSe: -1 },
    { cStatusNFSe: "X" },
  ])("rejects mismatched or invalid notes %j", async (patch) => {
    const data = fixture();
    Object.assign(data.nfseEncontradas[0].Cabecalho, patch);
    m.call.mockResolvedValue(data);
    await expect(listFiscalInvoices(admin, query)).rejects.toMatchObject({ status: 503 });
  });
  it("rejects notes outside the requested dates and malformed pagination", async () => {
    const data = fixture();
    data.nfseEncontradas[0].Emissao.cDataEmissao = "30/09/2026";
    m.call.mockResolvedValue(data);
    await expect(listFiscalInvoices(admin, query)).rejects.toMatchObject({ status: 503 });
    m.call.mockResolvedValue({ ...fixture(), nPagina: 2 });
    await expect(listFiscalInvoices(admin, query)).rejects.toMatchObject({ status: 503 });
  });
  it("rejects duplicate IDs instead of double counting", async () => {
    const data = fixture();
    data.nfseEncontradas.push(data.nfseEncontradas[0]);
    data.nRegistros = 2;
    data.nTotRegistros = 2;
    m.call.mockResolvedValue(data);
    await expect(listFiscalInvoices(admin, query)).rejects.toMatchObject({ status: 503 });
  });
});
