import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a" } as { uid: string } | null,
  scope: "a",
  data: [] as Record<string, unknown>[],
  error: null as Error | null,
  add: vi.fn(),
  upload: vi.fn(),
  url: vi.fn(),
  classify: vi.fn(),
  token: vi.fn(),
  toast: vi.fn(),
}));
const db = {},
  storage = {};
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user }),
  useFirestore: () => db,
  useStorage: () => storage,
  useMemoFirebase: (f: () => unknown) => f(),
  useCollection: () => ({ data: m.data, isLoading: false, error: m.error }),
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: m.scope }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/ai/flows/document-classifier-flow", () => ({ classifyDocument: m.classify }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...v: string[]) => v.join("/"),
  query: (base: unknown) => base,
  collectionGroup: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => "server-time",
  addDoc: m.add,
}));
vi.mock("firebase/storage", () => ({
  ref: (_s: unknown, path: string) => path,
  uploadBytes: m.upload,
  getDownloadURL: m.url,
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a" };
  m.scope = "a";
  m.data = [
    {
      id: "report",
      companyId: "a",
      name: "Laudo sintético",
      type: "pgr",
      statusIA: "Concluído",
      aiAnalysis: {
        resumo_executivo: "Parecer para revisão",
        acoes_imediatas_recomendadas: ["Conferir evidências"],
      },
    },
    { id: "other", companyId: "b", name: "Outro cliente", type: "pgr" },
  ];
  m.error = null;
  m.add.mockReset().mockResolvedValue({ id: "new" });
  m.upload.mockReset().mockResolvedValue(undefined);
  m.url.mockReset().mockResolvedValue("https://example.com/report.pdf");
  m.classify.mockReset().mockResolvedValue({ docType: "pgr", companyName: "Empresa sintética" });
  m.token.mockReset().mockResolvedValue("token-a");
  m.toast.mockReset();
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data:application/pdf;base64,VEVTVA==";
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.onload?.();
      }
    }
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function upload(
  file = new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" })
) {
  await v.click("Adicionar ao acervo");
  const input = document.querySelector<HTMLInputElement>("#ai-sorter")!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
describe("report archive", () => {
  it("shows only the selected company's reports and opens its analysis", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Laudo sintético");
    expect(v.container.textContent).not.toContain("Outro cliente");
    await v.click("Ver Parecer IA");
    expect(document.body.textContent).toContain("Parecer para revisão");
  });
  it("distinguishes errors from an empty archive", async () => {
    m.data = [];
    m.error = Error("denied");
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Não foi possível consultar o acervo");
    expect(v.container.textContent).not.toContain("Nenhum laudo protocolado");
  });
  it.each(["text/plain", "image/png"])(
    "rejects unsupported %s before classification",
    async (type) => {
      await v.render(<Page />);
      await upload(new File(["x"], "wrong", { type }));
      expect(m.classify).not.toHaveBeenCalled();
    }
  );
  it("requires a selected company before protocoling", async () => {
    m.scope = "all";
    await v.render(<Page />);
    await upload();
    await v.click("Confirmar armazenamento");
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Unidade não selecionada" })
    );
  });
  it.each(["", "application/x-pdf", "application/octet-stream"])(
    "accepts a PDF with browser type %s and normalizes its upload metadata",
    async (type) => {
      await v.render(<Page />);
      await upload(new File(["%PDF-1.7 synthetic"], "synthetic.PDF", { type }));
      expect(m.classify).toHaveBeenCalledOnce();
      await v.click("Confirmar armazenamento");
      expect(m.upload.mock.calls[0][1]).toMatchObject({
        name: "synthetic.PDF",
        type: "application/pdf",
      });
    }
  );
  it("rejects an explicitly non-PDF media type even with a PDF suffix", async () => {
    await v.render(<Page />);
    await upload(new File(["x"], "wrong.pdf", { type: "image/png" }));
    expect(m.classify).not.toHaveBeenCalled();
  });
  it("keeps successful classification when storage fails and allows retry", async () => {
    await v.render(<Page />);
    await upload();
    m.upload.mockRejectedValueOnce(Error("storage"));
    await v.click("Confirmar armazenamento");
    expect(m.add).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro no Protocolo" })
    );
    await v.click("Confirmar armazenamento");
    expect(m.add).toHaveBeenCalledWith(
      "companies/a/reports",
      expect.objectContaining({
        companyId: "a",
        url: "https://example.com/report.pdf",
        name: "synthetic.pdf",
      })
    );
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Laudo Protocolado com Sucesso!" })
    );
  });
  it("waits for metadata write before claiming success", async () => {
    await v.render(<Page />);
    await upload();
    m.toast.mockClear();
    const p = deferred<unknown>();
    m.add.mockReturnValueOnce(p.promise);
    await v.click("Confirmar armazenamento");
    expect(m.toast).not.toHaveBeenCalled();
    await act(async () => p.reject(Error("metadata")));
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro no Protocolo" })
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it("does not link an upload that finishes after company change", async () => {
    await v.render(<Page />);
    await upload();
    const p = deferred<unknown>();
    m.upload.mockReturnValueOnce(p.promise);
    await v.click("Confirmar armazenamento");
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve(undefined));
    expect(m.add).not.toHaveBeenCalled();
    expect(m.url).not.toHaveBeenCalled();
  });
  it("does not classify with credentials completed after logout", async () => {
    await v.render(<Page />);
    const p = deferred<string>();
    m.token.mockReturnValueOnce(p.promise);
    await upload();
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old-token"));
    expect(m.classify).not.toHaveBeenCalled();
  });
});
