import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: auth }));
import { POST } from "@/app/api/clients/grupo-avp/sync-sheets/route";
const request = (sheetUrl: string) =>
  new NextRequest("https://nai.local/api/clients/grupo-avp/sync-sheets", {
    method: "POST",
    body: JSON.stringify({ sheetUrl, currentAsos: [] }),
  });
describe("Sincronização AVP protegida", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    auth.mockResolvedValue({ role: "ADMIN", servedCompanies: [], tenantId: null });
  });
  it("rejeita usuário sem vínculo AVP antes de buscar planilha", async () => {
    auth.mockResolvedValue({ role: "CLIENT_ADMIN", servedCompanies: [], tenantId: "OTHER" });
    const fetch = vi.spyOn(globalThis, "fetch");
    expect((await POST(request("https://docs.google.com/spreadsheets/d/test/edit"))).status).toBe(
      403
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejeita sessão ausente", async () => {
    auth.mockRejectedValue(new AuthError("Sessão ausente", 401));
    expect((await POST(request("https://docs.google.com/spreadsheets/d/test/edit"))).status).toBe(
      401
    );
  });
  it.each([
    { role: "ADMIN", servedCompanies: [], tenantId: "OTHER" },
    { role: "GUEST", servedCompanies: ["GRUPO_AVP"], tenantId: "GRUPO_AVP" },
  ])("rejeita perfil sem autorização AVP: $role", async (user) => {
    auth.mockResolvedValue(user);
    const fetch = vi.spyOn(globalThis, "fetch");
    expect((await POST(request("https://docs.google.com/spreadsheets/d/test/edit"))).status).toBe(
      403
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["{", "null", "[]"])("rejeita corpo inválido %s", async (body) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(
      (await POST(new NextRequest("https://nai.local/sync", { method: "POST", body }))).status
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("limita o corpo real mesmo sem content-length", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(
      (
        await POST(
          new NextRequest("https://nai.local/sync", {
            method: "POST",
            body: JSON.stringify({ sheetUrl: "x".repeat(5_000_001) }),
          })
        )
      ).status
    ).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bloqueia URL e redirecionamento externo", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secrets" } })
      );
    expect((await POST(request("http://127.0.0.1/test"))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect((await POST(request("https://docs.google.com/spreadsheets/d/test/edit"))).status).toBe(
      400
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("limita tamanho e detecta login do Google", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("csv", { headers: { "content-length": "5000001" } }));
    expect((await POST(request("https://docs.google.com/spreadsheets/d/test/edit"))).status).toBe(
      413
    );
    fetch.mockResolvedValue(new Response("<html>Login</html>"));
    expect((await POST(request("https://docs.google.com/spreadsheets/d/test/edit"))).status).toBe(
      422
    );
  });
});
