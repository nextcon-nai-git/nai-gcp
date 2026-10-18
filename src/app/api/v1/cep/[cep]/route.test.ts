// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/actions/address-lookup", () => ({ buscarEnderecoPorCep: m.lookup }));
import { GET } from "./route";
const get = (cep = "80000-001") =>
  GET(new Request("https://example.com/api/v1/cep/" + cep), { params: Promise.resolve({ cep }) });
beforeEach(() => m.lookup.mockReset());
describe("CEP API error semantics", () => {
  it("returns retryable non-cacheable 503 for provider outages", async () => {
    m.lookup.mockResolvedValue({
      sucesso: false,
      erro: "CEP_UNAVAILABLE",
      mensagem: "Indisponível",
    });
    const response = await get();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("60");
    expect((await response.json()).erro).toBe("CEP_UNAVAILABLE");
  });
  it("returns 404 for confirmed absence", async () => {
    m.lookup.mockResolvedValue({ sucesso: false, erro: "CEP_NOT_FOUND" });
    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers.get("Retry-After")).toBeNull();
  });
  it("rejects invalid input without calling providers", async () => {
    expect((await get("123")).status).toBe(400);
    expect(m.lookup).not.toHaveBeenCalled();
  });
  it("preserves a successful verified result", async () => {
    const dados = { cep: "80000001", providerUtilizado: "ViaCEP", localidade: "Curitiba" };
    m.lookup.mockResolvedValue({ sucesso: true, dados });
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sucesso: true, provedor: "ViaCEP", dados });
  });
});
