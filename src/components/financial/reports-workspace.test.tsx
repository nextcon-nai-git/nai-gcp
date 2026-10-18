import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ user: null as any, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { FinancialReportsWorkspace } from "./reports-workspace";
const report = {
  id: "a".repeat(64),
  title: "Relatório sintético",
  sourceName: "origem.pdf",
  periodStart: "2026-01-01",
  periodEnd: "2026-10-18",
  description: "Critério de registro",
};
const response = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
  blob: async () => new Blob(["%PDF-test"], { type: "application/pdf" }),
});
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.fetch.mockReset().mockResolvedValue(response({ reports: [report] }));
  vi.stubGlobal("fetch", m.fetch);
  URL.createObjectURL = vi.fn().mockReturnValue("blob:private-report");
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function upload() {
  await v.input('input[name="title"]', "Relatório novo");
  await v.input('input[name="periodStart"]', "2026-01-01");
  await v.input('input[name="periodEnd"]', "2026-12-31");
  await v.submit();
}
describe("private financial reports", () => {
  it("does not read without a signed-in account", async () => {
    m.user = null;
    await v.render(<FinancialReportsWorkspace />);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(document.querySelector("form")).toBeNull();
  });
  it("loads with account credentials and filters the saved archive", async () => {
    await v.render(<FinancialReportsWorkspace />);
    expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token-a");
    expect(v.container.textContent).toContain("Critério de registro");
    await v.input('input[placeholder="Título, período ou arquivo"]', "missing");
    expect(v.container.textContent).not.toContain(report.title);
    await v.input('input[placeholder="Título, período ou arquivo"]', "ORIGEM.PDF");
    expect(v.container.textContent).toContain(report.title);
  });
  it("distinguishes a failed query from a confirmed empty archive", async () => {
    m.fetch.mockResolvedValue(response({ error: "Sem permissão" }, 403));
    await v.render(<FinancialReportsWorkspace />);
    expect(v.container.textContent).toContain("Sem permissão");
    expect(v.container.textContent).not.toContain("Nenhum relatório importado");
    expect(document.querySelector("form")).toBeNull();
  });
  it("waits for persistence, blocks another submit and clears fields only on success", async () => {
    await v.render(<FinancialReportsWorkspace />);
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await upload();
    expect(v.container.textContent).not.toContain("Relatório salvo no acervo");
    expect(v.button("Processando").disabled).toBe(true);
    await v.submit();
    expect(m.fetch).toHaveBeenCalledTimes(2);
    const body = m.fetch.mock.calls[1][1].body as FormData;
    expect(body.get("title")).toBe("Relatório novo");
    await act(async () =>
      p.resolve(response({ report: { ...report, id: "b".repeat(64), title: "Relatório novo" } }))
    );
    expect(v.container.textContent).toContain("Relatório salvo no acervo");
    expect(document.querySelector<HTMLInputElement>('input[name="title"]')!.value).toBe("");
  });
  it("preserves a failed upload for retry", async () => {
    await v.render(<FinancialReportsWorkspace />);
    m.fetch.mockRejectedValueOnce(Error("Servidor indisponível"));
    await upload();
    expect(v.container.textContent).toContain("Servidor indisponível");
    expect(document.querySelector<HTMLInputElement>('input[name="title"]')!.value).toBe(
      "Relatório novo"
    );
    expect(v.container.textContent).not.toContain("Relatório salvo no acervo");
  });
  it("keeps a single copy when the server reports an existing source", async () => {
    await v.render(<FinancialReportsWorkspace />);
    m.fetch.mockResolvedValueOnce(response({ report, alreadySaved: true }));
    await upload();
    expect(v.container.textContent).toContain("já estava salvo");
    expect(v.container.querySelectorAll("article")).toHaveLength(1);
  });
  it("downloads the original through authenticated fetch and revokes the URL on close", async () => {
    await v.render(<FinancialReportsWorkspace />);
    m.fetch.mockResolvedValueOnce(response({}));
    await v.click("Acessar PDF");
    const link = v.container.querySelector<HTMLAnchorElement>("a[download]")!;
    expect(link.download).toBe("origem.pdf");
    expect(link.href).toBe("blob:private-report");
    expect(m.fetch.mock.calls[1][0]).toBe(`/api/financial/reports/${report.id}?source=1`);
    expect(v.container.querySelector("iframe")).toBeNull();
    await v.click("Fechar PDF");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-report");
  });
  it("does not offer a download when the source request fails", async () => {
    await v.render(<FinancialReportsWorkspace />);
    m.fetch.mockResolvedValueOnce(response({ error: "Fonte indisponível" }, 503));
    await v.click("Acessar PDF");
    expect(v.container.textContent).toContain("Fonte indisponível");
    expect(v.container.querySelector("a[download]")).toBeNull();
  });
  it("clears visible reports and the PDF when authorization is revoked", async () => {
    await v.render(<FinancialReportsWorkspace />);
    m.fetch.mockResolvedValueOnce(response({}));
    await v.click("Acessar PDF");
    m.fetch.mockResolvedValueOnce(response({ error: "Acesso revogado" }, 403));
    await v.click("Atualizar relatórios");
    expect(v.container.textContent).not.toContain(report.title);
    expect(v.container.querySelector("a[download]")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it("does not send a request with credentials resolved after logout", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValue(p.promise);
    await v.render(<FinancialReportsWorkspace />);
    m.user = null;
    await v.render(<FinancialReportsWorkspace />);
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("does not reveal a previous account's late source response", async () => {
    await v.render(<FinancialReportsWorkspace />);
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Acessar PDF");
    m.user = { uid: "b", getIdToken: vi.fn().mockResolvedValue("token-b") };
    m.fetch.mockResolvedValue(response({ reports: [] }));
    await v.render(<FinancialReportsWorkspace />);
    await act(async () => p.resolve(response({})));
    expect(v.container.textContent).not.toContain(report.title);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
