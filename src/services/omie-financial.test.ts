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
import { connectOmie, disconnectOmie, listOmie, listOmieDre, omieStatus } from "./omie-financial";
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
      await expect(listOmieDre(user, {})).rejects.toThrow();
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

const dreQuery = { start: "2026-01-01", end: "2026-09-30", dateBasis: "emission" };
const dreRow = {
  dreTipo: "Custos",
  dreGrupo: "Custos diretos",
  dreConta: "Engenharia de Segurança",
  categoria: "Laudos PGR",
  dataMovimento: "10/09/2026",
  valor: -100.1,
  cnpj_cpf: "11.111.111/0001-11",
  nomeClienteFornecedor: "PRESTADOR SINTÉTICO",
  cidade: "Curitiba",
  estado: "PR",
  cnpjEmpresa: saved.cnpj,
};
describe("Omie official DRE boundary", () => {
  it("calls ListarDRE with emission or registration dates and returns minimal financial fields", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValue(
      response({
        listaDRE: [
          { ...dreRow, detalheConta: "private-clinical-detail", pix_qrcode: "private-bank-data" },
        ],
      })
    );
    const result = await listOmieDre(admin, { ...dreQuery, dateBasis: "registration" });
    expect(result.rows[0].amountCents).toBe(-10010);
    expect(result.summary.engineering[0].costCents).toBe(10010);
    expect(JSON.stringify(result)).not.toContain("private-clinical-detail");
    expect(JSON.stringify(result)).not.toContain("private-bank-data");
    expect(JSON.stringify(result)).not.toContain(credentials.appSecret);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.omie.com.br/api/v1/financas/dre/");
    expect(JSON.parse(init.body)).toMatchObject({
      call: "ListarDRE",
      param: [{ dPeriodoInicial: "01/01/2026", dPeriodoFinal: "30/09/2026", cTipoData: "2" }],
    });
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
  });

  it("distinguishes disconnected, malformed and truly empty responses", async () => {
    await expect(listOmieDre(admin, dreQuery)).rejects.toThrow("Conecte");
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValueOnce(response({ listaDRE: [] }));
    const empty = await listOmieDre(admin, dreQuery);
    expect(empty.rows).toEqual([]);
    expect(empty.warnings[0]).toContain("lista DRE vazia");
    for (const invalid of [{}, { listaDRE: null }, { listaDRE: [{}] }]) {
      fetchMock.mockResolvedValueOnce(response(invalid));
      await expect(listOmieDre(admin, dreQuery)).rejects.toThrow("validada");
    }
  });

  it("rejects another company, dates outside the requested period, mismatched metadata and fractional cents", async () => {
    storage.data = JSON.stringify(saved);
    for (const invalid of [
      { listaDRE: [{ ...dreRow, cnpjEmpresa: "99999999000199" }] },
      { listaDRE: [{ ...dreRow, dataMovimento: "01/10/2026" }] },
      { listaDRE: [{ ...dreRow, dataMovimento: "31/09/2026" }] },
      { listaDRE: [{ ...dreRow, valor: 1.005 }] },
      { listaDRE: [dreRow], cTipoData: "2" },
      { listaDRE: [dreRow], dPeriodoFinal: "31/12/2026" },
    ]) {
      fetchMock.mockResolvedValueOnce(response(invalid));
      await expect(listOmieDre(admin, dreQuery)).rejects.toThrow("validada");
    }
  });

  it("masks individuals and employees while preserving separate supplier identity", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValue(
      response({
        listaDRE: [
          { ...dreRow, cnpj_cpf: "111.111.111-11", nomeClienteFornecedor: "PESSOA PRIVADA UM" },
          { ...dreRow, cnpj_cpf: "222.222.222-22", nomeClienteFornecedor: "PESSOA PRIVADA DOIS" },
          {
            ...dreRow,
            cnpj_cpf: "",
            nomeClienteFornecedor: "FUNCIONARIO PRIVADO",
            tagFuncionario: "S",
          },
        ],
      })
    );
    const result = await listOmieDre(admin, dreQuery);
    const serialized = JSON.stringify(result);
    for (const value of [
      "111.111.111-11",
      "222.222.222-22",
      "PESSOA PRIVADA",
      "FUNCIONARIO PRIVADO",
    ])
      expect(serialized).not.toContain(value);
    expect(new Set(result.rows.map((row) => row.partyId)).size).toBe(3);
    expect(
      result.rows.every((row) => row.partyCnpj === null && row.identityStatus === "person_hidden")
    ).toBe(true);
  });

  it("keeps genuine repeated rows and stable source/action identity despite response reordering", async () => {
    storage.data = JSON.stringify(saved);
    const second = { ...dreRow, valor: -20, categoria: "LTCAT" };
    fetchMock.mockResolvedValueOnce(response({ listaDRE: [dreRow, dreRow, second] }));
    fetchMock.mockResolvedValueOnce(response({ listaDRE: [second, dreRow, dreRow] }));
    const first = await listOmieDre(admin, dreQuery);
    const next = await listOmieDre(admin, dreQuery);
    expect(first.rows).toHaveLength(3);
    expect(new Set(first.rows.map((row) => row.id)).size).toBe(3);
    expect(first.summary.engineering[0].costCents).toBe(22020);
    expect(first.sourceSha256).toBe(next.sourceSha256);
    expect(first.suggestedActions).toEqual(next.suggestedActions);
  });

  it("rejects invalid input before network and sanitizes provider faults", async () => {
    storage.data = JSON.stringify(saved);
    await expect(listOmieDre(admin, { ...dreQuery, call: "Pagar" })).rejects.toThrow(
      "período válido"
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(
      response({ faultstring: "synthetic-secret sensitive-upstream" }, 500)
    );
    await expect(listOmieDre(admin, dreQuery)).rejects.not.toThrow("sensitive-upstream");
  });

  it("uses a new action revision when credential rotation changes private pseudonyms", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockImplementation(async () =>
      response({ listaDRE: [{ ...dreRow, cnpj_cpf: "11111111111" }] })
    );
    const before = await listOmieDre(admin, dreQuery);
    storage.data = JSON.stringify({ ...saved, appSecret: "synthetic-rotated-secret" });
    const after = await listOmieDre(admin, dreQuery);
    expect(before.rows[0].partyId).not.toBe(after.rows[0].partyId);
    expect(before.suggestedActions.idempotencyKey).not.toBe(after.suggestedActions.idempotencyKey);
    expect(JSON.stringify(after)).not.toContain("synthetic-rotated-secret");
  });

  it("normalizes employee flags and removes personal identifiers repeated in financial text", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValue(
      response({
        listaDRE: [
          {
            ...dreRow,
            cnpj_cpf: "",
            tagFuncionario: " S ",
            nomeClienteFornecedor: "COLABORADOR SINTÉTICO",
            categoria: "Exames — CPF 123.456.789-01 — COLABORADOR SINTÉTICO",
            dreConta: "Exames de colaborador sintético",
            dreGrupo: "Custos 12345678901",
            cidade: "Curitiba — 123.456.789-01",
          },
        ],
      })
    );
    const result = await listOmieDre(admin, dreQuery);
    const serialized = JSON.stringify(result);
    expect(result.rows[0].identityStatus).toBe("person_hidden");
    for (const value of [
      "123.456.789-01",
      "12345678901",
      "COLABORADOR SINTÉTICO",
      "colaborador sintético",
    ])
      expect(serialized).not.toContain(value);
    expect(result.rows[0].category).toContain("omitida");
  });

  it("limits actual response bytes before JSON parsing even without Content-Length", async () => {
    storage.data = JSON.stringify(saved);
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(9 * 1024 * 1024));
      },
      cancel,
    });
    fetchMock.mockResolvedValue(new Response(stream));
    await expect(listOmieDre(admin, dreQuery)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalled();
  });

  it("rejects an oversized declared body without parsing it", async () => {
    storage.data = JSON.stringify(saved);
    fetchMock.mockResolvedValue(
      new Response("{}", { headers: { "Content-Length": String(17 * 1024 * 1024) } })
    );
    await expect(listOmieDre(admin, dreQuery)).rejects.toThrow("período menor");
  });
});
