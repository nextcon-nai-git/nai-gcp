import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "admin" } as any,
  scope: "all",
  providers: [] as any[],
  companies: [{ id: "a", name: "Empresa sintética" }],
  error: null as any,
  reserve: vi.fn(),
  update: vi.fn(),
  hash: vi.fn(),
  upload: vi.fn(),
  url: vi.fn(),
  toast: vi.fn(),
  analyze: vi.fn(),
  token: vi.fn(),
  enrich: vi.fn(),
  parse: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({
    user: m.user,
    role: m.user ? "ADMIN" : null,
    companyId: "nextcon",
    tenantId: null,
    isUserLoading: false,
    userError: null,
  }),
  useFirestore: () => ({}),
  useStorage: () => ({}),
  useMemoFirebase: (f: any) => f(),
  useCollection: (q: any) => ({
    data: q ? (q.name === "providers" ? m.providers : m.companies) : null,
    isLoading: false,
    error: q?.name === "providers" ? m.error : null,
  }),
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: m.scope }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/ai/flows/provider-contract-analysis-flow", () => ({
  analyzeProviderContract: m.analyze,
}));
vi.mock("@/actions/company-enrichment", () => ({ enriquecerDadosEmpresa: m.enrich }));
vi.mock("firebase/firestore", () => ({
  collection: (_: any, name: string) => ({ name }),
  query: (c: any) => c,
  orderBy: vi.fn(),
  doc: (_: any, ...p: any[]) => p.join("/"),
  serverTimestamp: () => "timestamp",
}));
vi.mock("firebase/storage", () => ({
  ref: (_: any, path: string) => path,
  uploadBytes: m.upload,
  getDownloadURL: m.url,
}));
vi.mock("@/lib/provider-integrity", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  hashProviderIdentifier: m.hash,
  createFirestoreProviderConditionalWriteStore: () => "store",
  createFirestoreProviderReservationStore: () => "store",
  reserveAndWriteProvider: m.reserve,
  updateProviderIfCurrent: m.update,
}));
vi.mock("papaparse", () => ({ default: { parse: m.parse } }));
vi.mock("@/components/ui/select", () => import("../../../tests/ui/native-select"));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: () => null,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "admin" };
  m.scope = "all";
  m.providers = [];
  m.error = null;
  for (const mock of [
    m.reserve,
    m.update,
    m.hash,
    m.upload,
    m.url,
    m.toast,
    m.analyze,
    m.token,
    m.enrich,
    m.parse,
    m.fetch,
  ])
    mock.mockReset();
  m.reserve.mockResolvedValue({ status: "confirmed" });
  m.update.mockResolvedValue(undefined);
  m.hash.mockImplementation(async (s: string) => s.replace(/[^a-z0-9]/gi, ""));
  m.token.mockResolvedValue("token");
  m.upload.mockResolvedValue({ ref: "uploaded" });
  m.url.mockResolvedValue("https://example.test/private");
  m.parse.mockImplementation((_: any, options: any) =>
    options.complete({
      data: [{ NOME: "Clínica sintética", CNPJ: "11222333000181", TIPO: "CLINIC" }],
      errors: [],
    })
  );
  m.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        city: "Cidade teste",
        state: "ES",
        street: "Rua teste",
        neighborhood: "Bairro teste",
      })
    )
  );
  vi.stubGlobal("fetch", m.fetch);
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data:application/pdf;base64,dGVzdA==";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onload?.();
      }
    }
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function form(name = "Profissional sintético") {
  await v.render(<Page />);
  await v.click("Novo Credenciamento");
  await v.input('input[name="name"]', name);
}
async function file(selector: string, file = new File(["test"], "test.csv", { type: "text/csv" })) {
  const input = document.querySelector<HTMLInputElement>(selector)!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
const provider = () => ({
  id: "provider-test",
  name: "Profissional sintético",
  cnpj: "11222333000181",
  active: true,
  taxIdStatus: "verified",
  revision: 3,
  servedCompanies: ["a"],
});
describe("provider operator writes", () => {
  it("creates an inactive draft without claiming identity verification or access provisioning", async () => {
    await form();
    await v.submit();
    expect(m.reserve).toHaveBeenCalledOnce();
    expect(m.reserve.mock.calls[0][0].providerData).toMatchObject({
      name: "Profissional sintético",
      active: false,
      taxIdStatus: "pending_verification",
    });
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Registro Protocolado" })
    );
  });
  it.each(["duplicate", "not_committed", "committed_unconfirmed", "outcome_unknown"])(
    "keeps the form and attempt identity for %s",
    async (status) => {
      m.reserve.mockResolvedValueOnce({ status });
      await form();
      await v.input('input[name="cnpj"]', "11222333000181");
      await v.submit();
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Erro na Gravação" })
      );
      const attempt = m.reserve.mock.calls[0][0].attemptId;
      await v.submit();
      expect(m.reserve.mock.calls[1][0].attemptId).toBe(attempt);
    }
  );
  it("rejects invalid tax documents before reserving a record", async () => {
    await form();
    await v.input('input[name="cnpj"]', "123");
    await v.submit();
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining("CPF/CNPJ válido") })
    );
  });
  it("rejects a document already attached to another provider", async () => {
    m.providers = [provider()];
    await form("Outro profissional");
    await v.input('input[name="cnpj"]', "11222333000181");
    await v.submit();
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining("já está vinculado") })
    );
  });
  it("does not overwrite a verified identity using a matching name", async () => {
    m.providers = [provider()];
    await form();
    await v.submit();
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining("nome conflita") })
    );
  });
  it("preserves verified identity on edit and increments the optimistic revision", async () => {
    m.providers = [provider()];
    await v.render(<Page />);
    await v.click("Editar Dados");
    await v.input('input[name="phone"]', "41999999999");
    await v.submit();
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expected: provider(),
        update: expect.objectContaining({
          revision: 4,
          active: true,
          taxIdStatus: "verified",
          phone: "41999999999",
        }),
      })
    );
  });
  it("changing a verified name makes verification and activation pending", async () => {
    m.providers = [provider()];
    await v.render(<Page />);
    await v.click("Editar Dados");
    await v.input('input[name="name"]', "Nome alterado sintético");
    await v.submit();
    expect(m.update.mock.calls[0][0].update).toMatchObject({
      taxIdStatus: "pending_verification",
      active: false,
    });
  });
  it("does not change the tax identity of an existing record", async () => {
    m.providers = [provider()];
    await v.render(<Page />);
    await v.click("Editar Dados");
    await v.input('input[name="cnpj"]', "52998224725");
    await v.submit();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining("não pode ser alterado") })
    );
  });
  it("does not query or save when the authorized provider snapshot is unavailable", async () => {
    m.error = Error("denied");
    await form();
    await v.submit();
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Dados indisponíveis" })
    );
  });
  it("waits for upload confirmation before persisting its URL", async () => {
    await form();
    await file("#prov-contract", new File(["pdf"], "contract.pdf", { type: "application/pdf" }));
    await file("#prov-photo", new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    await file("#prov-council", new File(["pdf"], "council.pdf", { type: "application/pdf" }));
    await v.submit();
    expect(m.upload).toHaveBeenCalledTimes(3);
    expect(m.reserve.mock.calls[0][0].providerData).toMatchObject({
      contractUrl: "https://example.test/private",
      photoUrl: "https://example.test/private",
      councilCardUrl: "https://example.test/private",
    });
  });
  it("does not persist metadata after upload finishes following logout", async () => {
    await form();
    await file("#prov-photo", new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    const p = deferred<any>();
    m.upload.mockReturnValueOnce(p.promise);
    await v.submit();
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve({ ref: "uploaded" }));
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.url).not.toHaveBeenCalled();
  });
  it("prevents duplicate manual commits while reservation is pending", async () => {
    await form();
    const p = deferred<any>();
    m.reserve.mockReturnValue(p.promise);
    await v.submit();
    await v.submit();
    expect(m.reserve).toHaveBeenCalledOnce();
    await act(async () => p.resolve({ status: "confirmed" }));
  });
  it("archives only after operator confirmation and successful conditional write", async () => {
    m.providers = [provider()];
    await v.render(<Page />);
    await v.click("Arquivar cadastro");
    expect(m.update.mock.calls[0][0].verify).toEqual({ isDeleted: true, active: false });
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Cadastro Arquivado" })
    );
  });
  it("leaves a record untouched when archive is declined or fails", async () => {
    m.providers = [provider()];
    await v.render(<Page />);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await v.click("Arquivar cadastro");
    expect(m.update).not.toHaveBeenCalled();
    m.update.mockRejectedValueOnce(Error("conflict"));
    await v.click("Arquivar cadastro");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Falha ao arquivar cadastro" })
    );
  });
  it("previews CSV before committing and reports a confirmed reread", async () => {
    await v.render(<Page />);
    await file("#provider-csv-import");
    expect(m.reserve).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("Prévia da importação");
    await v.click("Confirmar gravação dos válidos");
    expect(m.reserve.mock.calls[0][0].providerData).toMatchObject({
      active: false,
      taxIdStatus: "pending_verification",
      cnpj: "11222333000181",
    });
    expect(v.container.textContent).toContain("Gravado e confirmado por leitura");
  });
  it.each(["not_committed", "committed_unconfirmed", "outcome_unknown"])(
    "retries CSV %s with the same reservation key",
    async (status) => {
      m.reserve.mockResolvedValueOnce({ status });
      await v.render(<Page />);
      await file("#provider-csv-import");
      await v.click("Confirmar gravação dos válidos");
      const first = m.reserve.mock.calls[0][0];
      await v.click("Repetir tentativas incertas");
      expect(m.reserve.mock.calls[1][0]).toMatchObject({
        attemptId: first.attemptId,
        providerRef: first.providerRef,
      });
    }
  );
  it("reports duplicates as partial import rather than a successful replacement", async () => {
    m.reserve.mockResolvedValueOnce({ status: "duplicate" });
    await v.render(<Page />);
    await file("#provider-csv-import");
    await v.click("Confirmar gravação dos válidos");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Importação parcial" })
    );
    expect(v.container.textContent).toContain("nenhum cadastro foi sobrescrito");
  });
  it("rejects oversized CSV and malformed parser output", async () => {
    await v.render(<Page />);
    const big = new File(["x"], "big.csv");
    Object.defineProperty(big, "size", { value: 100000000 });
    await file("#provider-csv-import", big);
    expect(m.parse).not.toHaveBeenCalled();
    m.parse.mockImplementationOnce((_: any, o: any) =>
      o.complete({ data: [], errors: [{ row: 0, message: "Malformed" }] })
    );
    await file("#provider-csv-import");
    expect(v.container.textContent).toContain("Malformed");
    expect(v.button("Confirmar gravação dos válidos").disabled).toBe(true);
  });
  it("ignores parser completion after tenant switch", async () => {
    m.parse.mockImplementation(() => {});
    await v.render(<Page />);
    await file("#provider-csv-import");
    const callback = m.parse.mock.calls[0][1].complete;
    m.scope = "a";
    await v.render(<Page />);
    await act(async () =>
      callback({ data: [{ NOME: "Clínica antiga", CNPJ: "11222333000181" }], errors: [] })
    );
    expect(v.container.textContent).not.toContain("Clínica antiga");
  });
  it("handles parser and reservation failures without a false success", async () => {
    m.parse.mockImplementationOnce((_: any, o: any) => o.error(Error("parse failed")));
    await v.render(<Page />);
    await file("#provider-csv-import");
    expect(v.container.textContent).toContain("parse failed");
    await v.click("Fechar prévia");
    await file("#provider-csv-import");
    m.hash.mockRejectedValueOnce(Error("hash failed"));
    await v.click("Confirmar gravação dos válidos");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Importação não concluída" })
    );
    expect(v.button("Confirmar gravação dos válidos").disabled).toBe(false);
  });
  it("extracts a contract into editable fields without saving a provider", async () => {
    m.analyze.mockResolvedValue({
      name: "Clínica de teste",
      cnpj: "11222333000181",
      city: "Cidade teste",
      state: "ES",
      address: "Rua teste",
    });
    await v.render(<Page />);
    await file("#ai-onboarding", new File(["pdf"], "contract.pdf", { type: "application/pdf" }));
    expect(m.analyze).toHaveBeenCalledWith(
      { pdfDataUri: "data:application/pdf;base64,dGVzdA==" },
      "token"
    );
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "CLÍNICA DE TESTE"
    );
    expect(m.reserve).not.toHaveBeenCalled();
  });
  it("rejects non-PDF and empty PDF before extraction", async () => {
    await v.render(<Page />);
    await file("#ai-onboarding", new File(["x"], "fake.txt", { type: "text/plain" }));
    await file("#ai-onboarding", new File([], "empty.pdf", { type: "application/pdf" }));
    expect(m.analyze).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "PDF inválido" }));
  });
  it("does not send contract contents after a late token from the old session", async () => {
    const p = deferred<string>();
    m.token.mockReturnValue(p.promise);
    await v.render(<Page />);
    await file("#ai-onboarding", new File(["pdf"], "contract.pdf", { type: "application/pdf" }));
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.analyze).not.toHaveBeenCalled();
  });
  it("keeps form data when CEP fails and applies a successful lookup", async () => {
    await form();
    await v.input('input[name="cep"]', "29000000");
    m.fetch.mockRejectedValueOnce(Error("network"));
    await v.click("Buscar CEP");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Consulta de CEP indisponível" })
    );
    await v.click("Buscar CEP");
    expect(document.querySelector<HTMLInputElement>('input[name="city"]')?.value).toBe(
      "Cidade teste"
    );
  });
  it("does not replace a corrected CNPJ with an earlier lookup response", async () => {
    await form();
    await v.input('input[name="cnpj"]', "11222333000181");
    const p = deferred<any>();
    m.enrich.mockReturnValue(p.promise);
    await v.click("Buscar CNPJ");
    await v.input('input[name="cnpj"]', "00000000000000");
    await act(async () => p.resolve({ sucesso: true, dados: { razaoSocial: "Antiga" } }));
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "Profissional sintético"
    );
  });
});
