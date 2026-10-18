// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { PGR_MAX_FILE_BYTES } from "@/lib/pgr-schema";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  appCheck: vi.fn(),
  role: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/auth/require-pgr-app-check", () => ({ requirePgrAppCheck: mocks.appCheck }));
vi.mock("@/lib/auth/require-pgr-access", () => ({ requirePgrRole: mocks.role }));
vi.mock("@/services/pgr-workspace", () => ({
  preparePgrDraft: mocks.prepare,
  savePgrDraft: mocks.save,
}));
import { POST as analyze } from "./analyze/route";
import { POST as save } from "./save/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ uid: "test-reviewer", role: "SUPER_ADMIN" });
  mocks.prepare.mockResolvedValue({ draftId: "synthetic-draft" });
  mocks.save.mockResolvedValue({ saved: true });
});

describe.each([
  { name: "análise", handler: analyze },
  { name: "gravação", handler: save },
])("upload de documento: $name", ({ handler }) => {
  it("mantém o arquivo original e os campos após leitura limitada", async () => {
    const form = new FormData();
    form.set("file", new File(["%PDF-test"], "Fonte.PDF", { type: "application/pdf" }));
    form.set("draftId", "draft-one");
    form.set("companyId", "company-one");
    form.set("confirmed", "true");
    const response = await handler(
      new NextRequest("https://nai.example/api/pgr", { method: "POST", body: form })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    if (handler === analyze)
      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "test-reviewer" }),
        new Uint8Array(Buffer.from("%PDF-test")),
        "application/pdf",
        "Fonte.PDF"
      );
    else
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "test-reviewer" }),
        expect.objectContaining({
          draftId: "draft-one",
          companyId: "company-one",
          confirmed: true,
        }),
        new Uint8Array(Buffer.from("%PDF-test"))
      );
  });
  it.each(["auth", "appCheck", "role"] as const)(
    "verifica %s antes de ler conteúdo",
    async (guard) => {
      mocks[guard].mockImplementation(() => {
        throw new AuthError("Acesso negado", guard === "auth" ? 401 : 403);
      });
      const request = new NextRequest("https://nai.example/api/pgr", {
        method: "POST",
        body: "not read",
      });
      const response = await handler(request);
      expect(response.status).toBe(guard === "auth" ? 401 : 403);
      expect(request.bodyUsed).toBe(false);
      expect(mocks.prepare).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    }
  );
  it("limita envio sem Content-Length antes de analisar ou persistir", async () => {
    const cancel = vi.fn();
    const request = new NextRequest("https://nai.example/api/pgr", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(PGR_MAX_FILE_BYTES));
          controller.enqueue(new Uint8Array(65537));
        },
        cancel,
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    expect((await handler(request)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("identifica formulário malformado como erro de entrada", async () => {
    const request = new NextRequest("https://nai.example/api/pgr", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: "broken",
    });
    expect((await handler(request)).status).toBe(400);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
