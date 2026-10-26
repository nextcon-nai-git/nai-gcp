// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  patch: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/avp-periodic-workflow", () => ({
  readPeriodicWork: mocks.read,
  patchPeriodicWork: mocks.patch,
  readPeriodicHistory: mocks.history,
}));
import { GET, PATCH } from "./route";
const request = (method = "GET", body?: unknown, query = "") =>
  new NextRequest("https://nai.test/api/clients/grupo-avp/periodic-work" + query, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    uid: "operator",
    role: "OPERATIONS",
    tenantId: null,
    servedCompanies: ["GRUPO_AVP"],
  });
  mocks.read.mockResolvedValue({ cards: [] });
  mocks.history.mockResolvedValue([]);
});
describe("acesso à fila de trabalho AVP", () => {
  it.each(["GET", "PATCH"])("nega %s a outra empresa antes de ler ou escrever", async (method) => {
    mocks.auth.mockResolvedValue({
      uid: "other",
      role: "ADMIN",
      tenantId: "other",
      servedCompanies: [],
    });
    expect((await (method === "GET" ? GET(request()) : PATCH(request("PATCH", {})))).status).toBe(
      403
    );
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
  it("nega histórico ao usuário AVP externo", async () => {
    mocks.auth.mockResolvedValue({
      uid: "client",
      role: "HR",
      tenantId: "GRUPO_AVP",
      servedCompanies: [],
    });
    expect((await GET(request("GET", undefined, "?id=periodico-2026-1"))).status).toBe(403);
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("retorna consulta privada e trata falha de fonte como erro", async () => {
    expect((await GET(request())).headers.get("cache-control")).toContain("no-store");
    mocks.read.mockRejectedValueOnce(new Error("source failure"));
    expect((await GET(request())).status).toBe(503);
  });
  it("rejeita entrada inválida e preserva conflito de concorrência", async () => {
    expect((await PATCH(request("PATCH", {}))).status).toBe(400);
    mocks.patch.mockRejectedValueOnce(new AuthError("Conflito", 409));
    const body = {
      id: "periodico-2026-1",
      sourceVersion: "a".repeat(64),
      revision: 0,
      stage: "validar",
      responsible: "Operador teste",
      nextDate: "",
      evidence: "Referência e data registradas",
    };
    expect((await PATCH(request("PATCH", body))).status).toBe(409);
    expect(mocks.patch).toHaveBeenCalledWith(body, "operator");
  });
});
