import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a" } as any,
  scope: "a",
  all: false,
  rows: [] as any[],
  error: null as any,
  query: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
  set: vi.fn(),
  extract: vi.fn(),
  token: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user }),
  useFirestore: () => ({}),
  useMemoFirebase: (f: any) => f(),
  useCollection: (q: any) => {
    m.query(q);
    return { data: q ? m.rows : null, isLoading: false, error: m.error };
  },
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ activeClientId: m.scope, canBrowseAllCompanies: m.all }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/ai/flows/ppe-sheet-ocr-flow", () => ({ extractPpeSheetData: m.extract }));
vi.mock("firebase/firestore", () => ({
  collection: (_: any, ...path: string[]) => path.join("/"),
  collectionGroup: (_: any, name: string) => name,
  query: (...v: any[]) => v,
  orderBy: (...v: any[]) => v,
  doc: (c: any) => c,
  addDoc: m.add,
  writeBatch: () => ({ set: m.set, commit: m.commit }),
}));
vi.mock("@/services/ppe/ppe-catalog-service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    INITIAL_PPE_CATALOG: [
      {
        id: "ppe-test",
        name: "EPI sintético",
        category: "CABECA",
        caNumber: "12345",
        caExpirationDate: "2099-12-31",
        manufacturer: "Fabricante teste",
        compatibleRoles: ["Teste"],
        durabilityDays: 180,
        active: true,
      },
    ],
  };
});
import Page from "./page";
const extracted = {
  nomeColaborador: "Pessoa sintética",
  cpfMatricula: "TEST-001",
  setorFuncao: "Teste",
  parecerCompliance: "Revisar os dados",
  itens: [
    {
      epiNome: "EPI extraído",
      numeroCA: "12345",
      dataEntrega: "2026-10-18",
      quantidade: 2,
      assinado: true,
    },
  ],
};
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a" };
  m.scope = "a";
  m.all = false;
  m.rows = [];
  m.error = null;
  for (const k of [m.query, m.add, m.commit, m.set, m.extract, m.token, m.toast]) k.mockReset();
  m.add.mockResolvedValue({ id: "new" });
  m.commit.mockResolvedValue(undefined);
  m.extract.mockResolvedValue(extracted);
  m.token.mockResolvedValue("token");
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
async function scanner() {
  await v.render(<Page />);
  await v.click("Scanner Neural OCR");
  await v.input("textarea", "Ficha sintética para extração");
}
async function delivery() {
  await v.render(<Page />);
  await v.click("Nova Entrega Digital");
  await v.input('input[placeholder="Ex: Carlos Eduardo Silva"]', "Pessoa sintética");
  await v.input('input[placeholder="000.000.000-00"]', "TEST-001");
  await act(async () =>
    document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
  );
}
describe("PPE recorded evidence", () => {
  it("does not query deliveries without a session", async () => {
    m.user = null;
    await v.render(<Page />);
    expect(m.query).toHaveBeenLastCalledWith(null);
  });
  it("requires explicit global permission for a cross-company query", async () => {
    m.scope = "all";
    await v.render(<Page />);
    expect(m.query).toHaveBeenLastCalledWith(null);
    m.all = true;
    await v.render(<Page />);
    expect(m.query).toHaveBeenLastCalledWith(["ppe_deliveries", ["deliveredAt", "desc"]]);
  });
  it("shows read failures instead of presenting a confirmed empty ledger", async () => {
    m.error = Error("denied");
    await v.render(<Page />);
    expect(v.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível consultar"
    );
  });
  it("does not classify missing CA status as verified", async () => {
    m.rows = [{ id: "a", employeeName: "Pessoa teste", epiNome: "EPI teste" }];
    await v.render(<Page />);
    expect(v.container.textContent).toContain("C.A. a verificar");
  });
  it("filters employee and CA without changing source records", async () => {
    m.rows = [
      {
        id: "a",
        employeeName: "Pessoa alfa",
        numeroCA: "123",
        epiNome: "EPI A",
        caStatus: "VALIDO",
      },
      {
        id: "b",
        employeeName: "Pessoa beta",
        numeroCA: "456",
        epiNome: "EPI B",
        caStatus: "VENCIDO",
      },
    ];
    await v.render(<Page />);
    await v.input('input[placeholder="Buscar colaborador, EPI ou C.A..."]', "456");
    expect(v.container.textContent).toContain("Pessoa beta");
    expect(v.container.textContent).not.toContain("Pessoa alfa");
  });
  it("records an accepted delivery without inventing a digital signature", async () => {
    await delivery();
    await v.submit();
    expect(m.add).toHaveBeenCalledWith(
      "companies/a/ppe_deliveries",
      expect.objectContaining({
        employeeName: "Pessoa sintética",
        signed: false,
        signatureType: "PENDING",
        quantity: 1,
        termAccepted: true,
      })
    );
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Entrega registrada; assinatura pendente" })
    );
  });
  it("rejects invalid quantities even when form submission bypasses HTML validation", async () => {
    await delivery();
    await v.input('input[type="number"]', "-1");
    await v.submit();
    expect(m.add).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Confira a quantidade e a data da entrega" })
    );
  });
  it("waits for actual persistence and prevents duplicate submits", async () => {
    await delivery();
    const p = deferred<any>();
    m.add.mockReturnValue(p.promise);
    await v.submit();
    await v.submit();
    expect(m.add).toHaveBeenCalledOnce();
    expect(m.toast).not.toHaveBeenCalled();
    await act(async () => p.resolve({ id: "ok" }));
    expect(m.toast).toHaveBeenCalledOnce();
  });
  it("keeps the delivery form when persistence fails", async () => {
    await delivery();
    m.add.mockRejectedValue(Error("Denied"));
    await v.submit();
    expect(
      document.querySelector<HTMLInputElement>('input[placeholder="Ex: Carlos Eduardo Silva"]')
        ?.value
    ).toBe("Pessoa sintética");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro ao gravar entrega" })
    );
  });
  it("does not show a late successful delivery after switching companies", async () => {
    await delivery();
    const p = deferred<any>();
    m.add.mockReturnValue(p.promise);
    await v.submit();
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve({ id: "ok" }));
    expect(m.toast).not.toHaveBeenCalled();
  });
  it("extracts with credentials then saves unverified evidence without claiming eSocial transmission", async () => {
    await scanner();
    await v.click("Extrair dados da ficha");
    expect(m.extract).toHaveBeenCalledWith("Ficha sintética para extração", "token");
    await v.click("Salvar itens para conferência");
    expect(m.set).toHaveBeenCalledWith(
      "companies/a/ppe_deliveries",
      expect.objectContaining({
        signed: false,
        signatureDetectedByOcr: true,
        caStatus: "PENDENTE_VERIFICACAO",
        quantity: 2,
      })
    );
    expect(m.commit).toHaveBeenCalledOnce();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("sem transmissão ao eSocial"),
      })
    );
  });
  it("does not fabricate missing OCR dates or quantities", async () => {
    m.extract.mockResolvedValue({
      ...extracted,
      itens: [{ ...extracted.itens[0], dataEntrega: "", quantidade: 0 }],
    });
    await scanner();
    await v.click("Extrair dados da ficha");
    await v.click("Salvar itens para conferência");
    expect(m.commit).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Confira os itens extraídos" })
    );
  });
  it("preserves extraction after a write failure so the operator can retry", async () => {
    await scanner();
    await v.click("Extrair dados da ficha");
    m.commit.mockRejectedValueOnce(Error("offline"));
    await v.click("Salvar itens para conferência");
    expect(document.body.textContent).toContain("EPI extraído");
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Erro ao Salvar" }));
    await v.click("Salvar itens para conferência");
    expect(m.commit).toHaveBeenCalledTimes(2);
  });
  it("ignores late OCR results on account change", async () => {
    await scanner();
    const p = deferred<any>();
    m.extract.mockReturnValue(p.promise);
    await v.click("Extrair dados da ficha");
    m.user = { uid: "b" };
    await v.render(<Page />);
    await act(async () => p.resolve(extracted));
    expect(document.body.textContent).not.toContain("Pessoa sintética");
    expect(m.toast).not.toHaveBeenCalled();
  });
  it("does not call OCR when token resolves after logout", async () => {
    await scanner();
    const p = deferred<string>();
    m.token.mockReturnValue(p.promise);
    await v.click("Extrair dados da ficha");
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.extract).not.toHaveBeenCalled();
  });
  it("surfaces OCR errors and enables retry", async () => {
    await scanner();
    m.extract.mockRejectedValueOnce(Error("service"));
    await v.click("Extrair dados da ficha");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro na Análise de IA" })
    );
    expect(v.button("Extrair dados da ficha").disabled).toBe(false);
  });
});
