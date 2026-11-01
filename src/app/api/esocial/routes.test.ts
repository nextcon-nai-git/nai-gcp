// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  admin: vi.fn(),
  canManage: vi.fn(),
  workspace: vi.fn(),
  mutate: vi.fn(),
  document: vi.fn(),
  status: vi.fn(),
  upload: vi.fn(),
  retire: vi.fn(),
  companies: vi.fn(),
  links: vi.fn(),
  saveLink: vi.fn(),
  company: vi.fn(),
  grant: vi.fn(),
  saveGrant: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/esocial/access", () => ({
  requireEsocialMessagingAccess: m.access,
  requireEsocialAdministrator: m.admin,
  canManageEsocialConnection: m.canManage,
}));
vi.mock("@/services/esocial/messaging", () => ({
  getEsocialWorkspace: m.workspace,
  mutateEsocialMessage: m.mutate,
  downloadEsocialDocument: m.document,
}));
vi.mock("@/services/esocial/vault", () => ({
  esocialCertificateStatus: m.status,
  uploadEsocialCertificate: m.upload,
  retireEsocialCertificate: m.retire,
}));
vi.mock("@/services/esocial/records", () => ({
  listEsocialCompanies: m.companies,
  listEsocialEmployeeLinks: m.links,
  saveEsocialEmployeeLink: m.saveLink,
  esocialCompany: m.company,
  getEsocialGrant: m.grant,
  saveEsocialGrant: m.saveGrant,
  stringValue: (value: unknown) => (typeof value === "string" ? value.trim() : ""),
}));
import { GET as messagingGet, POST as messagingPost } from "./messaging/route";
import {
  GET as certificatesGet,
  POST as certificatesPost,
  DELETE as certificatesDelete,
} from "./certificates/route";
import { GET as companiesGet } from "./messaging/companies/route";
import { GET as linksGet, POST as linksPost } from "./links/route";
import { GET as grantsGet, POST as grantsPost } from "./grants/route";
import { GET as documentsGet } from "./documents/route";

const get = (path: string) => new NextRequest(`https://nai.example.test/api/esocial/${path}`);
const post = (path: string, body: unknown) =>
  new NextRequest(`https://nai.example.test/api/esocial/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const certificateRequest = (bytes = 256, confirmed = "true") => {
  const boundary = "synthetic-certificate-test";
  const field = (name: string, value: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const data = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.pfx"\r\nContent-Type: application/x-pkcs12\r\n\r\n`
    ),
    Buffer.alloc(bytes, 7),
    Buffer.from(
      `\r\n${field("password", "synthetic-not-a-real-secret")}${field("registration", "00000000191")}${field("confirmed", confirmed)}--${boundary}--\r\n`
    ),
  ]);
  return new NextRequest("https://nai.example.test/api/esocial/certificates", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: new Uint8Array(data),
  });
};
const user = { uid: "synthetic-operator", role: "ADMIN", tenantId: null, servedCompanies: [] };
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue(user);
  m.access.mockReturnValue(undefined);
  m.admin.mockReturnValue(undefined);
  m.canManage.mockReturnValue(true);
  m.workspace.mockResolvedValue({ events: [], nextCursor: null });
  m.mutate.mockResolvedValue({ event: { id: "synthetic-event" } });
  m.status.mockResolvedValue({ configured: false, vaultConfigured: true, localValid: false });
  m.upload.mockResolvedValue({ configured: true, localValid: true, vaultConfigured: true });
  m.companies.mockResolvedValue([{ id: "company-test", name: "Empresa fictícia", active: true }]);
  m.links.mockResolvedValue([]);
  m.company.mockReturnValue({
    get: async () => ({
      exists: true,
      data: () => ({
        name: "Empresa fictícia",
        cnpj: "00000001000100",
        esocialRegistration: "00000001",
        privateField: "must-not-leak",
      }),
    }),
  });
  m.grant.mockResolvedValue(null);
  m.saveGrant.mockResolvedValue({ active: true });
  m.saveLink.mockResolvedValue({ matricula: "SYNTHETIC" });
});

describe("fronteiras HTTP da mensageria", () => {
  it("autentica antes de consultar documentos, certificados e cadastros", async () => {
    m.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
    for (const [handler, path] of [
      [messagingGet, "messaging?companyId=company-test"],
      [certificatesGet, "certificates"],
      [companiesGet, "messaging/companies"],
      [linksGet, "links?companyId=company-test"],
      [grantsGet, "grants?companyId=company-test"],
      [documentsGet, "documents?id=event&type=unsigned"],
    ] as const) {
      const response = await handler(get(path));
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(m.workspace).not.toHaveBeenCalled();
    expect(m.status).not.toHaveBeenCalled();
    expect(m.company).not.toHaveBeenCalled();
    expect(m.document).not.toHaveBeenCalled();
  });
  it("nega acesso antes de processar mutações e upload", async () => {
    m.access.mockImplementation(() => {
      throw new AuthError("Restrito", 403);
    });
    m.admin.mockImplementation(() => {
      throw new AuthError("Restrito", 403);
    });
    expect(
      (await messagingPost(post("messaging", { action: "prepare", payload: {} }))).status
    ).toBe(403);
    expect((await linksPost(post("links", {}))).status).toBe(403);
    expect((await grantsPost(post("grants", {}))).status).toBe(403);
    expect((await certificatesPost(certificateRequest())).status).toBe(403);
    expect(m.mutate).not.toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.saveGrant).not.toHaveBeenCalled();
    expect(m.saveLink).not.toHaveBeenCalled();
  });
  it("preserva consulta por cliente, ASO, cursor e resumo sem misturar recibo/protocolo", async () => {
    m.workspace.mockResolvedValue({
      events: [{ status: "processing", protocol: "synthetic-batch" }],
    });
    const response = await messagingGet(
      get("messaging?companyId=company-test&asoCaseId=aso-test&summary=true&cursor=page-test")
    );
    expect(m.workspace).toHaveBeenCalledWith(user, {
      companyId: "company-test",
      asoCaseId: "aso-test",
      summary: true,
      cursor: "page-test",
      id: undefined,
    });
    expect(await response.json()).toEqual({
      events: [{ status: "processing", protocol: "synthetic-batch" }],
    });
    expect(response.headers.get("vary")).toBe("Authorization");
  });
  it("limita JSON por bytes efetivos e não encaminha requisição excedida", async () => {
    const response = await messagingPost(
      post("messaging", { action: "import_xml", xml: "x".repeat(256 * 1024) })
    );
    expect(response.status).toBe(413);
    expect(m.mutate).not.toHaveBeenCalled();
  });
  it("devolve ações explícitas ao serviço sem autorização implícita", async () => {
    const body = { action: "transmit", id: "event-test", version: 3, confirmed: true };
    expect((await messagingPost(post("messaging", body))).status).toBe(200);
    expect(m.mutate).toHaveBeenCalledWith(user, body);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("não expõe exceção interna nem conteúdo de certificado", async () => {
    m.upload.mockRejectedValue(new Error("PRIVATE_PASSWORD_OR_PFX_MUST_NOT_LEAK"));
    const response = await certificatesPost(certificateRequest());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_PASSWORD_OR_PFX_MUST_NOT_LEAK");
  });
  it("exige confirmação no upload e respeita os limites do certificado/multipart", async () => {
    expect((await certificatesPost(certificateRequest(256, "false"))).status).toBe(400);
    expect((await certificatesPost(certificateRequest(40 * 1024 + 1))).status).toBe(400);
    expect((await certificatesPost(certificateRequest(64 * 1024 + 1))).status).toBe(413);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("configurar A1 não cria nem transmite eventos e não retorna senha", async () => {
    const response = await certificatesPost(certificateRequest());
    expect(response.status).toBe(200);
    expect(m.upload).toHaveBeenCalledTimes(1);
    expect(m.upload.mock.calls[0][0]).toEqual(user);
    expect(m.upload.mock.calls[0][2]).toBe("synthetic-not-a-real-secret");
    const result = await response.text();
    expect(result).not.toContain("synthetic-not-a-real-secret");
    expect(result).not.toContain("privateKey");
    expect(m.mutate).not.toHaveBeenCalled();
  });
  it("desativar certificado exige confirmação independente", async () => {
    const request = new NextRequest("https://nai.example.test/api/esocial/certificates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: false }),
    });
    expect((await certificatesDelete(request)).status).toBe(400);
    expect(m.retire).not.toHaveBeenCalled();
  });
  it("consulta vínculo no cliente autorizado e retorna apenas inscrição necessária", async () => {
    const response = await linksGet(get("links?companyId=company-test"));
    expect(m.access).toHaveBeenCalledWith(user, "company-test");
    expect(await response.json()).toEqual({
      employees: [],
      company: { registration: "00000001", tpInsc: 1 },
    });
  });
  it("baixa XML privado por tipo explícito como anexo", async () => {
    m.document.mockResolvedValue({ xml: "<synthetic/>", filename: "recibo-teste.xml" });
    const response = await documentsGet(get("documents?id=event-test&type=response"));
    expect(m.document).toHaveBeenCalledWith(user, "event-test", "response");
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("<synthetic/>");
    expect((await documentsGet(get("documents?id=event-test&type=private-key"))).status).toBe(400);
  });
});
