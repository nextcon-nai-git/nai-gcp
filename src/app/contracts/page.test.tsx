import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: {
    user: { uid: "admin" },
    role: "ADMIN",
    companyId: "nextcon",
    tenantId: null,
    isUserLoading: false,
    userError: null,
  } as {
    user: { uid: string } | null;
    role: string;
    companyId: string | null;
    tenantId: string | null;
    isUserLoading: boolean;
    userError: Error | null;
  },
  contracts: [] as Record<string, unknown>[],
  companies: [] as Record<string, unknown>[],
  contractsError: null as Error | null,
  companiesError: null as Error | null,
  query: vi.fn(),
  hash: vi.fn(),
  preserve: vi.fn(),
  analyze: vi.fn(),
  integrate: vi.fn(),
  token: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => mocks.session,
  useFirestore: () => ({}),
  useStorage: () => ({}),
  useMemoFirebase: (factory: () => unknown) => factory(),
  useCollection: (source: { group?: boolean }) => ({
    data: source.group ? mocks.contracts : mocks.companies,
    isLoading: false,
    error: source.group ? mocks.contractsError : mocks.companiesError,
  }),
}));
vi.mock("firebase/firestore", () => ({
  collection: () => ({ group: false }),
  collectionGroup: () => ({ group: true }),
  orderBy: () => "ordered",
  limit: (value: number) => ({ limit: value }),
  query: (source: object, ...constraints: unknown[]) => {
    mocks.query(source, constraints);
    return source;
  },
}));
vi.mock("@/lib/contracts/integration", () => ({
  hashContractFile: mocks.hash,
  preserveContractSource: mocks.preserve,
  integrateAnalyzedContract: mocks.integrate,
  ContractImportConfirmationPending: class extends Error {},
}));
vi.mock("@/ai/flows/contract-analysis-flow", () => ({ analyzeContract: mocks.analyze }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: mocks.token }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href}>{children}</a>
  ),
}));
import ContractsManagement from "./page";
let root: Root, host: HTMLDivElement;
const result = {
  summary: "Resumo para revisão",
  clientInfo: {
    name: "Cliente identificado",
    cnpj: "11.222.333/0001-81",
    segment: "Teste",
    riskDegree: 2,
    address: "Endereço",
  },
  clauses: { rights: [], duties: ["Elaborar PGR da unidade"] },
  operationalTasks: [
    {
      title: "Preparar PGR",
      description: "Conferir riscos identificados no contrato",
      category: "pgr",
      frequency: "anual",
      checklist: ["Conferir cláusula 4"],
    },
  ],
};
const source = {
  sha256: "a".repeat(64),
  storagePath: "internos_nextcon/contract-sources/" + "a".repeat(64),
  generation: "1",
  sizeBytes: 8,
};
const company = { id: "client1", name: "Cliente cadastrado", cnpj: "11222333000181", active: true };
async function render() {
  await act(async () => {
    root.render(<ContractsManagement />);
  });
}
async function upload(
  files = [new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" })]
) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function reviewed() {
  await upload();
  await act(async () => {
    const select = host.querySelector<HTMLSelectElement>("select")!;
    select.value = "client1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.session = {
    user: { uid: "admin" },
    role: "ADMIN",
    companyId: "nextcon",
    tenantId: null,
    isUserLoading: false,
    userError: null,
  };
  mocks.contracts = [];
  mocks.companies = [company];
  mocks.contractsError = mocks.companiesError = null;
  mocks.hash.mockReset().mockResolvedValue("a".repeat(64));
  mocks.preserve.mockReset().mockResolvedValue(source);
  mocks.analyze.mockReset().mockResolvedValue(result);
  mocks.integrate.mockReset().mockResolvedValue({ created: true });
  mocks.token.mockReset().mockResolvedValue("synthetic");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("contract import review and lifecycle", () => {
  it("finds a stored alphanumeric CNPJ from its formatted representation", async () => {
    mocks.contracts = [
      {
        id: "alpha",
        companyId: "client1",
        companyName: "Cliente alfanumérico",
        extractedCompanyDocument: "12ABC34501DE35",
      },
    ];
    await render();
    const search = Array.from(host.querySelectorAll("input")).find(
      (input) => input.type === "text"
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        search,
        "12.ABC.345/01DE-35"
      );
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.textContent).toContain("Cliente alfanumérico");
    expect(host.textContent).not.toContain("Nenhum contrato encontrado");
  });

  it("removes an open dossier and cancels queued imports after a Firestore denial", async () => {
    mocks.contracts = [
      {
        id: "old",
        companyId: "client1",
        companyName: "Cliente privado",
        summary: "Resumo privado",
      },
    ];
    await render();
    await upload();
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Cliente privado"))!
        .click()
    );
    expect(document.body.textContent).toContain("Resumo privado");
    mocks.contractsError = Object.assign(new Error("Denied"), { code: "permission-denied" });
    await render();
    expect(document.body.textContent).not.toContain("Resumo privado");
    expect(document.body.textContent).not.toContain("Resumo para revisão");
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(host.textContent).toContain("Os dados da importação foram retirados da tela");
  });

  it("ends a failed file read without hanging or calling the AI", async () => {
    vi.stubGlobal(
      "FileReader",
      class {
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.onerror?.();
        }
      }
    );
    await render();
    await upload();
    expect(host.textContent).toContain("Não foi possível concluir a análise");
    expect(host.textContent).not.toContain("Analisando o lote");
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false);
  });
  it("processes a batch sequentially and prevents another batch while the first is pending", async () => {
    let finish!: (hash: string) => void;
    mocks.hash.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await upload([new File(["%PDF-1.7"], "one.pdf"), new File(["%PDF-1.7"], "two.pdf")]);
    expect(mocks.hash).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
    await act(async () => {
      finish("a".repeat(64));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(mocks.hash).toHaveBeenCalledTimes(2);
    expect(mocks.analyze).toHaveBeenCalledTimes(2);
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false);
  });
  it.each(["loading", "error", "logout", "tenant", "company", "doctor"])(
    "does not query contracts for unavailable or unauthorized scope: %s",
    async (state) => {
      if (state === "loading") mocks.session.isUserLoading = true;
      if (state === "error") mocks.session.userError = new Error("session unavailable");
      if (state === "logout") mocks.session.user = null;
      if (state === "tenant") mocks.session.tenantId = "client";
      if (state === "company") mocks.session.companyId = "other-client";
      if (state === "doctor") mocks.session.role = "DOCTOR";
      await render();
      expect(mocks.query).not.toHaveBeenCalled();
      expect(host.querySelector('input[type="file"]')).toBeNull();
    }
  );
  it("shows the extraction and every task before integration and uses the selected client's ID", async () => {
    await render();
    await reviewed();
    for (const text of [
      "Resumo para revisão",
      "Cliente identificado",
      "11.222.333/0001-81",
      "Elaborar PGR da unidade",
      "Preparar PGR",
      "Conferir cláusula 4",
    ])
      expect(host.textContent).toContain(text);
    expect(mocks.integrate).not.toHaveBeenCalled();
    const button = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Integrar SGI"
    )!;
    await act(async () => {
      button.click();
      button.click();
    });
    expect(mocks.integrate).toHaveBeenCalledTimes(1);
    expect(mocks.integrate.mock.calls[0].slice(2)).toEqual([
      result,
      "client1",
      source,
      "admin",
      true,
      expect.any(AbortSignal),
    ]);
    expect(host.textContent).toContain("Integração confirmada");
  });
  it("does not continue storage or AI work after logout during file hashing", async () => {
    let finish!: (hash: string) => void;
    mocks.hash.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await upload();
    mocks.session.user = null;
    await render();
    await act(async () => finish("a".repeat(64)));
    expect(mocks.preserve).not.toHaveBeenCalled();
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("contrato.pdf");
  });
  it("does not continue AI after a late credential or render an old account's extraction", async () => {
    let finish!: (token: string) => void;
    mocks.token.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await upload();
    mocks.session.user = { uid: "other-admin" };
    await render();
    await act(async () => finish("old-token"));
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("contrato.pdf");
  });
  it("ignores confirmation of an already sent integration after account change", async () => {
    let finish!: (value: unknown) => void;
    mocks.integrate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await reviewed();
    await act(async () => {
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent === "Integrar SGI")!
        .click();
    });
    const signal = mocks.integrate.mock.calls[0][7] as AbortSignal;
    mocks.session.user = { uid: "other-admin" };
    await render();
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ created: true }));
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Integração confirmada");
  });
  it("rejects a mismatched customer and invalidates confirmation when selection changes", async () => {
    mocks.companies.push({
      ...company,
      id: "other",
      name: "Outro cliente",
      cnpj: "12345678000195",
    });
    await render();
    await reviewed();
    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = "other";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    await act(async () => {
      host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    });
    await act(async () => {
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent === "Integrar SGI")!
        .click();
    });
    expect(mocks.integrate).not.toHaveBeenCalled();
    expect(host.textContent).toContain("CNPJ corresponda");
  });
  it("rejects oversized batches without silently omitting files", async () => {
    await render();
    await upload(Array.from({ length: 6 }, (_, n) => new File(["%PDF-"], `c${n}.pdf`)));
    expect(host.textContent).toContain("até 5 PDFs");
    expect(mocks.hash).not.toHaveBeenCalled();
  });
  it("shows repository failures, bounds the listing and searches the displayed records", async () => {
    mocks.contractsError = new Error("unavailable");
    await render();
    expect(host.textContent).toContain("Não foi possível consultar os contratos");
    expect(host.textContent).not.toContain("Nenhum contrato encontrado");
    mocks.contractsError = null;
    mocks.contracts = Array.from({ length: 201 }, (_, n) => ({
      id: `r${n}`,
      companyId: "client1",
      companyName: `Contrato ${n}`,
      summary: "Histórico preservado",
    }));
    await render();
    expect(host.textContent).toContain("200 contratos mais recentes");
    expect(host.textContent).not.toContain("Contrato 200");
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('input:not([type="file"])')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Contrato 199"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.textContent).toContain("Contrato 199");
    expect(host.textContent).not.toContain("Contrato 198");
    await act(async () => {
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent?.includes("Contrato 199"))!
        .click();
    });
    expect(document.body.textContent).toContain("Histórico preservado");
  });
  it("clears open dossiers when the profile loses internal scope", async () => {
    mocks.contracts = [
      {
        id: "private",
        companyId: "client1",
        companyName: "Contrato privado",
        summary: "Conteúdo privado",
      },
    ];
    await render();
    await act(async () => {
      Array.from(host.querySelectorAll("button"))
        .find((b) => b.textContent?.includes("Contrato privado"))!
        .click();
    });
    expect(document.body.textContent).toContain("Conteúdo privado");
    mocks.session.tenantId = "client1";
    await render();
    expect(document.body.textContent).not.toContain("Conteúdo privado");
  });
});
