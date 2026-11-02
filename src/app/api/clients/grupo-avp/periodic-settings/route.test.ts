// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const m = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), configure: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/avp-periodic-sync", () => ({
  getAvpPeriodicSettings: m.read,
  configureAvpPeriodicSources: m.configure,
}));
import { GET, POST } from "./route";
const input = {
  campaignUrl: `https://docs.google.com/spreadsheets/d/${"a".repeat(30)}/edit`,
  accreditationUrl: `https://docs.google.com/spreadsheets/d/${"b".repeat(30)}/edit`,
  revision: "",
};
const request = (body: unknown = input) =>
  new NextRequest("https://example.test/periodic-settings", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({
    uid: "internal",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
  m.read.mockResolvedValue({ configured: false });
  m.configure.mockResolvedValue({ revision: "valid" });
});
it.each([
  { role: "ADMIN", tenantId: "GRUPO_AVP", servedCompanies: [] },
  { role: "OPERATIONS", tenantId: null, servedCompanies: ["GRUPO_AVP"] },
  { role: "ADMIN", tenantId: "OTHER", servedCompanies: [] },
])(
  "não permite configurar ou obter links por perfil sem administração interna",
  async (profile) => {
    m.auth.mockResolvedValue({ uid: "scoped", ...profile });
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(m.read).not.toHaveBeenCalled();
    expect(m.configure).not.toHaveBeenCalled();
  }
);
it("exige autenticação antes da leitura ou escrita", async () => {
  m.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
  expect((await GET(request())).status).toBe(401);
  expect((await POST(request())).status).toBe(401);
  expect(m.configure).not.toHaveBeenCalled();
});
it("valida a URL e o tamanho antes de acionar fontes ou gravar", async () => {
  expect(
    (await POST(request({ ...input, campaignUrl: "http://169.254.169.254/metadata" }))).status
  ).toBe(422);
  expect((await POST(request({ ...input, campaignUrl: "x".repeat(5000) }))).status).toBe(413);
  expect(m.configure).not.toHaveBeenCalled();
});
it("limita o payload aos IDs validados, revisão e ator autenticado", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(m.configure).toHaveBeenCalledWith(
    { campaignSpreadsheetId: "a".repeat(30), accreditationSpreadsheetId: "b".repeat(30) },
    "",
    "internal"
  );
});
it("não divulga detalhes de credenciais e informa conflito sem sobrescrever", async () => {
  m.configure.mockRejectedValueOnce(new Error("private credential"));
  const response = await POST(request());
  expect(JSON.stringify(await response.json())).not.toContain("private credential");
  m.configure.mockRejectedValueOnce(new Error("CONFLICT"));
  expect((await POST(request())).status).toBe(409);
});
