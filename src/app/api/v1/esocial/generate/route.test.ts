import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: state.get }) }) },
}));
vi.mock("@/lib/developer-api-guard", async (original) => ({
  ...(await original<typeof import("@/lib/developer-api-guard")>()),
  requireApiKey: state.auth,
}));
import { POST } from "./route";
const input = () =>
  JSON.parse(readFileSync("tests/fixtures/esocial/s2220-reviewed-input.json", "utf8"));
const request = (body: unknown) =>
  new NextRequest("https://nai.test/api/v1/esocial/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.mockResolvedValue({
    id: "synthetic-key",
    clientId: "company-a",
    scopes: ["esocial:write"],
  });
  state.get.mockResolvedValue({ exists: true, data: () => ({ cnpj: "12.345.678/0001-90" }) });
});

describe("rascunho eSocial autenticado e isolado por empresa", () => {
  it("retorna somente S-2220 sem assinatura e sem transmissão", async () => {
    const response = await POST(request({ type: "S2220", data: input() }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-NAI-Signature-Status")).toBe("UNSIGNED");
    expect(response.headers.get("X-NAI-Transmission-Status")).toBe("NOT_SUBMITTED");
    expect(response.headers.get("Content-Disposition")).toContain("nao-assinado");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).not.toContain("Signature");
  });
  it("nega outra empresa antes de consultar dados", async () => {
    expect(
      (await POST(request({ companyId: "company-b", type: "S2220", data: input() }))).status
    ).toBe(403);
    expect(state.get).not.toHaveBeenCalled();
  });
  it("exige escopo de geração", async () => {
    state.auth.mockResolvedValue({ clientId: "company-a", scopes: ["esocial:read"] });
    expect((await POST(request({ type: "S2220", data: input() }))).status).toBe(403);
    expect(state.get).not.toHaveBeenCalled();
  });
  it("exige empresa concreta para chave global", async () => {
    state.auth.mockResolvedValue({ clientId: "GLOBAL", scopes: ["esocial:write"] });
    expect((await POST(request({ type: "S2220", data: input() }))).status).toBe(400);
    expect(state.get).not.toHaveBeenCalled();
  });
  it("recusa empregador diferente do cadastro autorizado", async () => {
    const data = input();
    data.ideEmpregador.nrInsc = "98.765.432/0001-90";
    expect((await POST(request({ type: "S2220", data }))).status).toBe(403);
  });
  it("recusa empresa inexistente", async () => {
    state.get.mockResolvedValue({ exists: false });
    expect((await POST(request({ type: "S2220", data: input() }))).status).toBe(404);
  });
  it("recusa ASO incompleto sem inventar médico ou exame", async () => {
    const data = input();
    delete data.aso.medico;
    expect((await POST(request({ type: "S2220", data }))).status).toBe(422);
  });
  it.each(["S2210", "S2240"])("bloqueia evento %s com leiaute pendente", async (type) => {
    const response = await POST(request({ type, data: input() }));
    expect(response.status).toBe(501);
    expect(await response.json()).toHaveProperty("status", "LAYOUT_VALIDATION_REQUIRED");
    expect(state.get).not.toHaveBeenCalled();
  });
  it.each([null, [], "text"])("recusa JSON inválido %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(state.get).not.toHaveBeenCalled();
  });
  it("limita tamanho real da solicitação sem depender do Content-Length", async () => {
    const response = await POST(request({ type: "S2220", data: { text: "a".repeat(66000) } }));
    expect(response.status).toBe(413);
    expect(state.get).not.toHaveBeenCalled();
  });
});
