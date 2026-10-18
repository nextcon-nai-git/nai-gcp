// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buscarEnderecoPorCep } from "./address-lookup";
import { enriquecerDadosEmpresa } from "./company-enrichment";
import { consultarTaxasEIndicesOficiais } from "./economic-rates";
const fetchMock = vi.fn();
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response({}, false));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
describe("verified registry lookups", () => {
  it.each(["", "1", "123456789"])("rejects invalid CEP %s without network", async (cep) => {
    expect((await buscarEnderecoPorCep(cep)).sucesso).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["", "123", "1".repeat(15)])("rejects invalid CNPJ %s without network", async (cnpj) => {
    expect((await enriquecerDadosEmpresa(cnpj)).sucesso).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["network", "http", "malformed"])(
    "never invents company/address after %s failure",
    async (mode) => {
      if (mode === "network") fetchMock.mockRejectedValue(new Error("synthetic"));
      if (mode === "malformed")
        fetchMock.mockResolvedValue({
          ok: true,
          json: async () => {
            throw Error("json");
          },
        });
      const company = await enriquecerDadosEmpresa("11.222.333/0001-81");
      const address = await buscarEnderecoPorCep("80000-001");
      expect(company).toMatchObject({ sucesso: false });
      expect(company.dados).toBeUndefined();
      expect(address).toMatchObject({ sucesso: false });
      expect(address.dados).toBeUndefined();
    }
  );
  it.each([
    [
      0,
      "OpenCEP",
      { cep: "80000-001", logradouro: "Rua sintética", localidade: "Curitiba", uf: "PR" },
    ],
    [
      1,
      "ViaCEP",
      { cep: "80000-001", logradouro: "Rua sintética", localidade: "Curitiba", uf: "PR" },
    ],
    [
      2,
      "BrasilAPI CEP",
      { cep: "80000-001", street: "Rua sintética", city: "Curitiba", state: "PR" },
    ],
    [3, "ApiCEP", { code: "80000-001", address: "Rua sintética", city: "Curitiba", state: "PR" }],
  ] as const)(
    "uses the first verified address from provider %s",
    async (index, provider, payload) => {
      for (let i = 0; i < index; i++) fetchMock.mockResolvedValueOnce(response({}, false));
      fetchMock.mockResolvedValueOnce(response(payload));
      const result = await buscarEnderecoPorCep("80000-001");
      expect(result.dados).toMatchObject({
        localidade: "Curitiba",
        uf: "PR",
        providerUtilizado: provider,
        logradouro: "Rua sintética",
      });
      expect(fetchMock).toHaveBeenCalledTimes(index + 1);
      expect(fetchMock.mock.calls.every((c) => c[1].redirect === "error" && c[1].signal)).toBe(
        true
      );
    }
  );
  it("leaves missing address fields empty", async () => {
    fetchMock.mockResolvedValueOnce(response({ cep: "80000-001" }));
    expect((await buscarEnderecoPorCep("80000001")).dados).toMatchObject({
      localidade: "",
      uf: "",
      logradouro: "",
    });
  });
  it.each([0, 1, 2])("normalizes company contact fields from source %s", async (index) => {
    for (let i = 0; i < index; i++) fetchMock.mockResolvedValueOnce(response({}, false));
    fetchMock.mockResolvedValueOnce(
      response(
        index === 2
          ? {
              nome: "Empresa sintética",
              fantasia: "Fantasia",
              atividade_principal: [{ code: "62.09-1-00", text: "Atividade" }],
              telefone: "41999999999",
              email: "teste@example.com",
              municipio: "Curitiba",
              uf: "PR",
              cep: "80000001",
            }
          : {
              razao_social: "Empresa sintética",
              nome_fantasia: "Fantasia",
              cnae_fiscal: 6209100,
              cnae_fiscal_descricao: "Atividade",
              ddd_telefone_1: "41999999999",
              email: "teste@example.com",
              municipio: "Curitiba",
              uf: "PR",
              cep: "80000001",
            }
      )
    );
    const r = await enriquecerDadosEmpresa("11222333000181");
    expect(r.dados).toMatchObject({
      razaoSocial: "Empresa sintética",
      municipio: "Curitiba",
      uf: "PR",
      telefone: "(41) 999999999",
      situacaoCadastral: "Não informada",
    });
    expect(fetchMock).toHaveBeenCalledTimes(index + 1);
  });
  it("does not infer a company website from a public mailbox", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ razao_social: "Empresa", email: "exemplo@gmail.com" })
    );
    expect((await enriquecerDadosEmpresa("11222333000181")).dados?.website).toBe("");
  });
});
describe("economic index provenance", () => {
  it.each(["offline", "empty", "invalid"])(
    "does not fabricate current values for %s",
    async (mode) => {
      if (mode === "offline") fetchMock.mockRejectedValue(Error("offline"));
      else
        fetchMock.mockResolvedValue(
          response(
            mode === "empty"
              ? []
              : [
                  { nome: "Selic", valor: null },
                  { nome: "CDI", valor: "" },
                  { nome: "IPCA", valor: "invalid" },
                ]
          )
        );
      expect((await consultarTaxasEIndicesOficiais()).sucesso).toBe(false);
    }
  );
  it("returns only values present in the response, preserving zero and negative values", async () => {
    fetchMock.mockResolvedValue(
      response([
        { nome: "Selic", valor: 1 },
        { nome: "CDI", valor: "0" },
        { nome: "IPCA", valor: -0.2 },
        { nome: "inválido", valor: "bad" },
      ])
    );
    const r = await consultarTaxasEIndicesOficiais();
    expect(r.dados?.taxas.map((t) => [t.nome, t.valor])).toEqual([
      ["Selic", 1],
      ["CDI", 0],
      ["IPCA", -0.2],
    ]);
    expect(r.dados?.totalTaxas).toBe(3);
    expect(r.dados?.taxas.some((t) => t.nome === "Dólar PTAX")).toBe(false);
  });
});
