// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { emptyContractFields } from "@/lib/clinic-contract";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  exists: vi.fn(),
  download: vi.fn(),
  save: vi.fn(),
  match: vi.fn(),
  generate: vi.fn(),
  email: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: () => ({ exists: mock.exists, download: mock.download, save: mock.save }),
    }),
  }),
}));
vi.mock("@/lib/clinic-contract-docx", () => ({
  templateMatches: mock.match,
  generateClinicContract: mock.generate,
  contractEmailDraft: mock.email,
}));
import { GET, POST } from "./route";
const req = (body?: unknown) =>
  new NextRequest(
    "https://nai.test/api/clients/grupo-avp/clinic-contract",
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}
  );
const upload = () => {
  const form = new FormData();
  form.set("file", new File(["synthetic"], "template.docx"));
  return new NextRequest("https://nai.test/api/clients/grupo-avp/clinic-contract", {
    method: "POST",
    body: form,
  });
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({
    uid: "internal",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
  mock.exists.mockResolvedValue([true]);
  mock.download.mockResolvedValue([Buffer.from("synthetic")]);
  mock.match.mockReturnValue(true);
  mock.generate.mockResolvedValue({
    bytes: Buffer.from("generated"),
    text: "Minuta",
    pending: ["[campo]"],
  });
  mock.email.mockReturnValue("X-Unsent: 1");
});
describe("modelo privado de contrato", () => {
  it.each(["GET", "POST"])("exige autenticação e vínculo interno em %s", async (method) => {
    mock.auth.mockRejectedValueOnce(new AuthError("Sessão ausente", 401));
    expect((await (method === "GET" ? GET(req()) : POST(req({})))).status).toBe(401);
    for (const user of [
      { role: "ADMIN", tenantId: "GRUPO_AVP", servedCompanies: [] },
      { role: "OPERATIONS", tenantId: null, servedCompanies: [] },
      { role: "HR", tenantId: "GRUPO_AVP", servedCompanies: [] },
    ]) {
      mock.auth.mockResolvedValue(user);
      expect((await (method === "GET" ? GET(req()) : POST(req({})))).status).toBe(403);
    }
    expect(mock.exists).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("oferece leitura sem cache ao operador interno AVP, mas não cadastro", async () => {
    mock.auth.mockResolvedValue({
      uid: "operator",
      role: "OPERATIONS",
      tenantId: null,
      servedCompanies: ["GRUPO_AVP"],
    });
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(await r.json()).toMatchObject({ ready: true, canUpload: false });
    expect((await POST(upload())).status).toBe(403);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("rejeita outro modelo e preserva o original numa repetição", async () => {
    mock.match.mockReturnValueOnce(false);
    expect((await POST(upload())).status).toBe(400);
    expect(mock.save).not.toHaveBeenCalled();
    mock.save.mockRejectedValueOnce({ code: 412 });
    expect((await POST(upload())).status).toBe(200);
    expect(mock.save.mock.calls[0][1]).toMatchObject({
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "private, no-store" },
    });
    expect(mock.download).toHaveBeenCalled();
  });
  it("gera prévia sem envio ou gravação de contrato assinado", async () => {
    const r = await POST(req({ fields: emptyContractFields(), format: "preview" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ text: "Minuta", pending: ["[campo]"] });
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.email).not.toHaveBeenCalled();
  });
  it("não gera com fonte ausente, campos inválidos ou e-mail vazio", async () => {
    expect(
      (
        await POST(
          req({ fields: { ...emptyContractFields(), email: "bad\r\nBcc:x" }, format: "email" })
        )
      ).status
    ).toBe(400);
    expect((await POST(req({ fields: emptyContractFields(), format: "email" }))).status).toBe(400);
    mock.exists.mockResolvedValue([false]);
    expect((await POST(req({ fields: emptyContractFields(), format: "docx" }))).status).toBe(404);
    expect(mock.generate).not.toHaveBeenCalled();
  });
});
