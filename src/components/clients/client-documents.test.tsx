import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ user: null as any, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { ClientDocuments } from "./client-documents";
const doc = {
  id: "doc-id",
  name: "Contrato sintético",
  taskCount: 2,
  createdAt: "2026-10-18T12:00:00Z",
};
const response = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
  blob: async () => new Blob(["%PDF-test"]),
});
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.fetch.mockReset().mockResolvedValue(response({ documents: [doc] }));
  vi.stubGlobal("fetch", m.fetch);
  URL.createObjectURL = vi.fn().mockReturnValue("blob:private-client");
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function choose() {
  const el = v.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(el, "files", {
    configurable: true,
    value: [new File(["%PDF-test"], "contrato.pdf", { type: "application/pdf" })],
  });
  await act(async () => el.dispatchEvent(new Event("change", { bubbles: true })));
}
describe("client document isolation and persistence", () => {
  it("loads only the requested client with account credentials", async () => {
    await v.render(<ClientDocuments companyId="client-a" />);
    expect(m.fetch.mock.calls[0][0]).toBe("/api/clients/client-a/documents");
    expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token-a");
    expect(v.container.textContent).toContain(doc.name);
    expect(v.container.querySelector("a")!.href).toContain("company=client-a");
  });
  it("does not read or save without an account", async () => {
    m.user = null;
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    expect(v.button("Salvar documento e criar cards").disabled).toBe(true);
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("surfaces access failures without displaying documents", async () => {
    m.fetch.mockResolvedValueOnce(response({ error: "Sem acesso" }, false));
    await v.render(<ClientDocuments companyId="a" />);
    expect(v.container.textContent).toContain("Sem acesso");
    expect(v.container.textContent).not.toContain(doc.name);
  });
  it("rejects malformed action lines before any upload", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    await v.input("textarea", "x | y");
    await v.click("Salvar documento e criar cards");
    expect(v.container.textContent).toContain("Use até 50 linhas");
    expect(m.fetch).toHaveBeenCalledTimes(1);
  });
  it("waits for persistence before confirming cards and sends parsed actions", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    await v.input("textarea", "Conferir contrato | Conferir prazo e referência");
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Salvar documento e criar cards");
    expect(v.container.textContent).not.toContain("Documento salvo neste cliente");
    expect(v.button("Salvando").disabled).toBe(true);
    const body = m.fetch.mock.calls[1][1].body as FormData;
    expect(JSON.parse(String(body.get("actions")))).toHaveLength(1);
    await act(async () => p.resolve(response({ taskCount: 1 })));
    expect(v.container.textContent).toContain("1 cards criados em A fazer");
    expect(v.container.querySelector("textarea")!.value).toBe("");
  });
  it("retains the file and action text when upload fails", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    await v.input("textarea", "Revisar contrato | Rever escopo");
    m.fetch.mockRejectedValueOnce(Error("Falha no envio"));
    await v.click("Salvar documento e criar cards");
    expect(v.container.textContent).toContain("Falha no envio");
    expect(v.container.textContent).toContain("contrato.pdf");
    expect(v.container.querySelector("textarea")!.value).toContain("Rever escopo");
  });
  it("does not hide a successful write when refreshing the list fails", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    m.fetch
      .mockResolvedValueOnce(response({ taskCount: 2 }))
      .mockRejectedValueOnce(Error("Falha na releitura"));
    await v.click("Salvar documento e criar cards");
    expect(v.container.textContent).toContain("Documento salvo neste cliente");
    expect(v.container.textContent).toContain("Falha na releitura");
  });
  it("identifies an idempotent reupload", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    m.fetch.mockResolvedValueOnce(response({ taskCount: 2, alreadySaved: true }));
    await v.click("Salvar documento e criar cards");
    expect(v.container.textContent).toContain("Nenhuma duplicação criada");
  });
  it("opens authenticated sources and revokes their local URL", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    m.fetch.mockResolvedValueOnce(response({}));
    await v.click("Ver documento original");
    expect(m.fetch.mock.calls[1][0]).toBe("/api/clients/a/documents?pdf=doc-id");
    expect(v.container.querySelector("iframe")!.src).toBe("blob:private-client");
    await v.click("Fechar documento");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-client");
  });
  it("does not expose a document whose fetch finishes after switching clients", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Ver documento original");
    m.fetch.mockResolvedValue(response({ documents: [] }));
    await v.render(<ClientDocuments companyId="b" />);
    await act(async () => p.resolve(response({})));
    expect(v.container.querySelector("iframe")).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("does not refresh the former client or display its save after logout", async () => {
    await v.render(<ClientDocuments companyId="a" />);
    await choose();
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Salvar documento e criar cards");
    m.user = null;
    await v.render(<ClientDocuments companyId="a" />);
    await act(async () => p.resolve(response({ taskCount: 2 })));
    expect(m.fetch).toHaveBeenCalledTimes(2);
    expect(v.container.textContent).not.toContain("Documento salvo neste cliente");
  });
  it("does not use a token delivered after leaving the account", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValue(p.promise);
    await v.render(<ClientDocuments companyId="a" />);
    m.user = null;
    await v.render(<ClientDocuments companyId="a" />);
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
