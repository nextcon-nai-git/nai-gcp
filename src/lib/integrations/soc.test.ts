// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseSocResponse,
  requireSocAccess,
  socCompanyIds,
  socConfiguration,
  socQuery,
  socRead,
} from "./soc";
import type { AuthContext } from "@/lib/auth/auth-context";

beforeEach(() => {
  vi.stubEnv("SOC_PRINCIPAL_COMPANY_ID", "1005519");
  vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", "101,102");
  for (const prefix of ["COMPANIES", "EMPLOYEES", "ASOS"]) {
    vi.stubEnv(`SOC_${prefix}_CODE`, "123");
    vi.stubEnv(`SOC_${prefix}_KEY`, "test-secret-only");
  }
});
afterEach(() => vi.unstubAllEnvs());
const employee = (overrides = {}) => ({
  CODIGOEMPRESA: "101",
  CODIGO: "15",
  NOME: "Teste",
  MATRICULAFUNCIONARIO: "0012",
  ...overrides,
});
const response = (body: unknown, status = 200) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
    );

describe("SOC scope and credentials", () => {
  it.each(["CLIENT_ADMIN", "HR", "DOCTOR", "GUEST"])("denies %s", (role) => {
    expect(() => requireSocAccess({ role, tenantId: null } as AuthContext)).toThrow();
  });
  it("rejects tenant-bound operations and allows internal operations", () => {
    expect(() =>
      requireSocAccess({ role: "OPERATIONS", tenantId: "client" } as AuthContext)
    ).toThrow();
    expect(() =>
      requireSocAccess({ role: "OPERATIONS", tenantId: null } as AuthContext)
    ).not.toThrow();
  });
  it("does not expose credentials or claim connectivity from configuration", () => {
    expect(JSON.stringify(socConfiguration())).not.toContain("test-secret-only");
    expect(socConfiguration().connected).toBeNull();
    vi.stubEnv("SOC_EMPLOYEES_KEY", "");
    expect(socConfiguration().resources.employees.configured).toBe(false);
  });
  it("fails closed for absent, malformed or oversized company scope", () => {
    for (const value of [
      "",
      "101,any",
      Array.from({ length: 2001 }, (_, i) => String(i + 1)).join(","),
    ]) {
      vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", value);
      expect(socCompanyIds()).toEqual([]);
    }
  });
  it("supports the full explicit portfolio without wildcard authorization", () => {
    const ids = Array.from({ length: 162 }, (_, i) => String(i + 1));
    vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", ids.join(","));
    expect(socCompanyIds()).toEqual(ids);
    expect(() => socQuery("employees", { companyId: "162" })).not.toThrow();
    expect(() => socQuery("employees", { companyId: "163" })).toThrow();
    vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", "*");
    expect(socCompanyIds()).toEqual([]);
  });
  it("keeps the ASO employee batch capped at 50 after portfolio expansion", () => {
    expect(() =>
      socQuery("asos", {
        companyId: "101",
        start: "2026-10-01",
        end: "2026-10-16",
        employeeIds: Array.from({ length: 51 }, (_, i) => String(i + 1)).join(","),
      })
    ).toThrow("1 a 50");
  });
  it("never calls provider for unauthorized company", async () => {
    const fetcher = response([]);
    await expect(socRead("employees", { companyId: "999" }, fetcher)).rejects.toMatchObject({
      code: "COMPANY_NOT_ALLOWED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("never calls provider when key is missing", async () => {
    vi.stubEnv("SOC_EMPLOYEES_KEY", "");
    const fetcher = response([]);
    await expect(socRead("employees", { companyId: "101" }, fetcher)).rejects.toMatchObject({
      code: "CONFIGURATION_REQUIRED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("SOC contracts and errors", () => {
  it("uses fixed endpoint, documented parameters, no cache and no redirect", async () => {
    const fetcher = response([employee()]);
    await socRead("employees", { companyId: "101" }, fetcher);
    const [url, options] = fetcher.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe("https://ws1.soc.com.br/WebSoc/exportadados");
    expect(JSON.parse(parsed.searchParams.get("parametro")!)).toMatchObject({
      empresa: "1005519",
      codigo: "123",
      chave: "test-secret-only",
      tipoSaida: "json",
      empresaTrabalho: "101",
      parametroData: "0",
    });
    expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
  });
  it("reads the companies CSV with quoted delimiters and accented names", async () => {
    const fetcher = response(
      '\uFEFFCODIGO;RAZAOSOCIAL;ATIVO;CODIGOCLIENTEINTEGRACAO\r\n101;"Clínica; Teste";1;001\r\n999;Outro;1;002'
    );
    expect(await socRead("companies", {}, fetcher)).toEqual([
      { id: "101", name: "Clínica; Teste", active: "1", integrationCode: "001" },
    ]);
  });
  it.each([
    "",
    "<html>acesso negado</html>",
    '{"erro":"key secret CPF"}',
    '[{"CODIGO":"1"}]',
    "Sem movimentação",
  ])("rejects unknown response rather than presenting zero results", (body) => {
    expect(() => parseSocResponse("employees", body)).toThrow();
  });
  it("accepts explicit empty JSON array", () =>
    expect(parseSocResponse("employees", "[]")).toEqual([]));
  it.each([
    [401, "ACCESS_DENIED"],
    [403, "ACCESS_DENIED"],
    [429, "RATE_LIMIT"],
    [500, "PROVIDER_HTTP"],
  ])("classifies HTTP %s without leaking provider content", async (status, code) => {
    await expect(
      socRead("employees", { companyId: "101" }, response("private-response", Number(status)))
    ).rejects.toMatchObject({ code });
  });
  it("sanitizes transport exceptions containing the URL or key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("test-secret-only"));
    await expect(socRead("employees", { companyId: "101" }, fetcher)).rejects.toMatchObject({
      code: "TRANSPORT_FAILURE",
    });
    await expect(socRead("employees", { companyId: "101" }, fetcher)).rejects.not.toThrow(
      "test-secret-only"
    );
  });
  it("bounds streamed responses", async () => {
    await expect(
      socRead("employees", { companyId: "101" }, response("x".repeat(16 * 1024 * 1024 + 1)))
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
  it("rejects mixed-company records", async () => {
    await expect(
      socRead(
        "employees",
        { companyId: "101" },
        response([employee(), employee({ CODIGOEMPRESA: "102" })])
      )
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH" });
  });
  it("preserves leading zeroes, flags review without claiming invalid identity, removes CPF", async () => {
    const rows = await socRead(
      "employees",
      { companyId: "101" },
      response([
        employee({ CPFFUNCIONARIO: "private" }),
        employee({ CODIGO: "16" }),
        employee({ CODIGO: "17", MATRICULAFUNCIONARIO: "" }),
      ])
    );
    expect(rows[0]).toMatchObject({
      registration: "0012",
      review: "Matrícula repetida; conferir vínculos",
    });
    expect(rows[2]).toMatchObject({ review: "Matrícula ausente; conferir regra do vínculo" });
    expect(JSON.stringify(rows)).not.toContain("private");
  });
});
it("preserves distinct unit codes even when the names match", async () => {
  const rows = await socRead(
    "employees",
    { companyId: "101" },
    response([
      employee({ CODIGOUNIDADE: "286", NOMEUNIDADE: "CEUDESP", MATRICULAFUNCIONARIO: "01" }),
      employee({
        CODIGO: "16",
        CODIGOUNIDADE: "300",
        NOMEUNIDADE: "CEUDESP",
        MATRICULAFUNCIONARIO: "02",
      }),
    ])
  );
  expect(rows.map((r) => r.unitId)).toEqual(["286", "300"]);
});

describe("SOC ASO query", () => {
  const query = { companyId: "101", start: "2026-10-01", end: "2026-10-16", employeeIds: "15" };
  const aso = {
    CODIGOEMPRESA: "101",
    CODIGOFUNCIONARIO: "15",
    IDFICHA: "22",
    DTASO: "15/10/2026",
    CPFTRAB: "private",
    RESASOSOC: "3",
  };
  it("uses emission date and explicit employee scope", () => {
    expect(socQuery("asos", query)).toMatchObject({
      empresa: "101",
      dataInicio: "01/10/2026",
      dataFim: "16/10/2026",
      pDataIncAso: "2",
      pFuncionario: "1",
      funcionario: "15",
    });
  });
  it.each([
    { start: "2026-02-30" },
    { start: "2026-01-01" },
    { end: "2026-09-30" },
    { employeeIds: "" },
    { employeeIds: "15,abc" },
  ])("rejects unsafe filters %s", (change) =>
    expect(() => socQuery("asos", { ...query, ...change })).toThrow()
  );
  it("deduplicates exam rows and excludes clinical conclusions", async () => {
    const fetcher = response([aso, aso]);
    const rows = await socRead("asos", query, fetcher);
    const parameters = JSON.parse(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.get("parametro")!
    );
    expect(parameters.empresa).toBe("101");
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("RESASOSOC");
    expect(JSON.stringify(rows)).not.toContain("private");
  });
  it("rejects ASOs belonging to an unrequested employee", async () => {
    await expect(
      socRead("asos", query, response([{ ...aso, CODIGOFUNCIONARIO: "16" }]))
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH" });
  });
});
