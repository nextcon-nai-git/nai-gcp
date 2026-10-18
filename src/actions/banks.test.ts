import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { consultarBancosBrasil } from "./banks";
const fetchMock = vi.fn();
const banks = [
  { ispb: "00000001", code: 1, name: "Árvore", fullName: "Banco Árvore Teste" },
  { ispb: "12345678", code: 341, name: "Beta", fullName: "Instituição Beta" },
  { ispb: "87654321", code: null, fullName: "Sem COMPE" },
];
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify(banks)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
describe("bank catalogue queries", () => {
  it.each(["001", 1])("matches COMPE %s without confusing leading zeroes", async (code) => {
    const r = await consultarBancosBrasil({ code });
    expect(r.dados?.bancos.map((b) => b.ispb)).toEqual(["00000001"]);
  });
  it("filters accent-insensitive full names and ISPB together", async () => {
    const r = await consultarBancosBrasil({ name: " INSTITUICAO ", ispb: "1234" });
    expect(r.dados?.bancos.map((b) => b.code)).toEqual([341]);
  });
  it("paginates after filtering and preserves the total", async () => {
    const r = await consultarBancosBrasil({ offset: 1, limit: 1 });
    expect(r.dados).toMatchObject({ total: 3, offset: 1, limit: 1 });
    expect(r.dados?.bancos[0].name).toBe("Beta");
  });
  it("keeps a missing COMPE null and uses full name when short name is absent", async () => {
    const r = await consultarBancosBrasil({ ispb: "87654321" });
    expect(r.dados?.bancos[0]).toMatchObject({ code: null, name: "Sem COMPE" });
  });
  it.each([
    { limit: NaN },
    { limit: Infinity },
    { limit: 0 },
    { limit: 1.2 },
    { offset: -1 },
    { offset: Infinity },
    { code: "invalid" },
    { code: "-1" },
    { ispb: "text" },
  ])("rejects invalid filters before any external request: %j", async (options) => {
    expect((await consultarBancosBrasil(options)).sucesso).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["http", "network", "empty", "shape", "json"])(
    "identifies local fallback when provider fails: %s",
    async (mode) => {
      if (mode === "network") fetchMock.mockRejectedValue(Error("offline"));
      else
        fetchMock.mockResolvedValue(
          mode === "http"
            ? new Response("fail", { status: 503 })
            : mode === "json"
              ? new Response("bad")
              : new Response(JSON.stringify(mode === "empty" ? [] : {}))
        );
      const r = await consultarBancosBrasil({ code: "001" });
      expect(r.sucesso).toBe(true);
      expect(r.dados?.provedor).toBe("NAI Local Banking Engine");
      expect(r.dados?.bancos[0].code).toBe(1);
    }
  );
  it("reports zero matches without substituting a different bank", async () => {
    const r = await consultarBancosBrasil({ code: 999 });
    expect(r.dados).toMatchObject({ total: 0, bancos: [] });
  });
});
