import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
const storage = vi.hoisted(() => ({ data: null as string | null, calls: 0 }));
vi.mock("@/lib/firebase-admin", () => ({}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: () => {
        storage.calls++;
        return {
          download: async () => {
            if (!storage.data) throw { code: 404 };
            return [Buffer.from(storage.data)];
          },
          save: async (data: string) => {
            storage.data = data;
          },
          delete: async () => {
            storage.data = null;
          },
        };
      },
    }),
  }),
}));
import { connectOmie, disconnectOmie, listOmie, omieStatus } from "./omie-financial";
const admin: AuthContext = {
  uid: "admin",
  email: "admin@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const credentials = { appKey: "synthetic-key", appSecret: "synthetic-secret" };
const saved = {
  ...credentials,
  company: "NEXTCON TESTE",
  cnpj: "00.000.000/0001-00",
  verifiedAt: "2026-10-10T10:00:00Z",
  connectedBy: "admin",
};
const fetchMock = vi.fn();
beforeEach(() => {
  storage.calls = 0;
  storage.data = null;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
describe("Omie financial boundary", () => {
  it("denies operations and tenant admins before accessing credentials or network", async () => {
    for (const user of [
      { ...admin, role: "OPERATIONS" as const },
      { ...admin, role: "ADMIN" as const, tenantId: "tenant" },
    ]) {
      await expect(omieStatus(user)).rejects.toThrow();
      await expect(connectOmie(user, credentials)).rejects.toThrow();
      await expect(listOmie(user, {})).rejects.toThrow();
      await expect(disconnectOmie(user)).rejects.toThrow();
    }
    expect(storage.calls).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports disconnected without inventing a successful sync", async () => {
    expect(await omieStatus(admin)).toEqual({ connected: false });
    await expect(listOmie(admin, {})).rejects.toThrow("Conecte");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("verifies company and never returns credentials or extraneous Omie fields", async () => {
    fetchMock.mockResolvedValue(
      response({
        empresas_cadastro: [
          { razao_social: saved.company, cnpj: saved.cnpj, ct_espass: "sensitive-certificate" },
        ],
      })
    );
    const result = await connectOmie(admin, credentials);
    expect(result.company).toBe(saved.company);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
    expect(storage.data).not.toContain("sensitive-certificate");
    expect(await omieStatus(admin)).toEqual(result);
  });
  it("preserves existing configuration on wrong-company or fault responses", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValueOnce(
      response({ empresas_cadastro: [{ razao_social: "OTHER", cnpj: "00" }] })
    );
    await expect(connectOmie(admin, credentials)).rejects.toThrow("NEXTCON");
    fetchMock.mockResolvedValueOnce(
      response({ faultstring: "private secret leaked by provider" }, 500)
    );
    await expect(connectOmie(admin, credentials)).rejects.not.toThrow("private secret");
    expect(JSON.parse(storage.data!)).toEqual(saved);
  });
  it("enforces pagination and maps a minimal read-only response", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValue(
      response({
        pagina: 2,
        total_de_paginas: 3,
        total_de_registros: 140,
        conta_pagar_cadastro: [
          {
            codigo_lancamento_omie: 42,
            codigo_cliente_fornecedor: 1,
            valor_documento: 123.45,
            data_vencimento: "10/10/2026",
            status_titulo: "ATRASADO",
            cnab_integracao_bancaria: { pix_qrcode: "secret-bank-data" },
          },
        ],
      })
    );
    const result = await listOmie(admin, { kind: "payable", page: 2, status: "ATRASADO" });
    expect(result.total).toBe(140);
    expect(result.rows[0].amount).toBe(123.45);
    expect(JSON.stringify(result)).not.toContain("secret-bank-data");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.omie.com.br/api/v1/financas/contapagar/");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toMatchObject({
      call: "ListarContasPagar",
      param: [{ pagina: 2, registros_por_pagina: 50, filtrar_por_status: "ATRASADO" }],
    });
  });
  it("rejects arbitrary operations and malformed responses instead of showing empty finances", async () => {
    storage.data = JSON.stringify(saved);
    await expect(listOmie(admin, { kind: "LancarPagamento" })).rejects.toThrow("inválida");
    await expect(listOmie(admin, { page: -1 })).rejects.toThrow("inválida");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(response({ unexpected: true }));
    await expect(listOmie(admin, {})).rejects.toThrow("Omie");
  });
  it("disconnects locally without changing any data at Omie", async () => {
    storage.data = JSON.stringify(saved);
    expect(await disconnectOmie(admin)).toEqual({ connected: false });
    expect(storage.data).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
