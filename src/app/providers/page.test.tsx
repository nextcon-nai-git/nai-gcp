import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    user: { uid: "internal" },
    role: "ADMIN",
    companyId: "nextcon",
    tenantId: null,
    isUserLoading: true,
    userError: null,
  } as {
    user: { uid: string } | null;
    role: string | null;
    companyId: string | null;
    tenantId: string | null;
    isUserLoading: boolean;
    userError: Error | null;
  },
  activeClientId: "all" as string,
  collection: {
    data: [{ id: "provider-private", name: "Prestador Fictício Confidencial" }] as
      | {
          id: string;
          name: string;
          profession?: string;
          type?: string;
          councilNumber?: string;
          rqe?: string;
          servedCompanies?: string[];
        }[]
      | null,
    isLoading: false,
    error: null as Error | null,
  },
  useCollection: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  useUser: () => mocks.session,
  useFirestore: () => ({}),
  useStorage: () => null,
  useMemoFirebase: (factory: () => unknown) => factory(),
  useCollection: (target: unknown) => {
    mocks.useCollection(target);
    return mocks.collection;
  },
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ activeClientId: mocks.activeClientId }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/ai/flows/provider-contract-analysis-flow", () => ({
  analyzeProviderContract: vi.fn(),
}));
vi.mock("@/actions/company-enrichment", () => ({ enriquecerDadosEmpresa: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  query: (collection: unknown, ...constraints: unknown[]) => ({ collection, constraints }),
  orderBy: (...args: unknown[]) => args,
  doc: (...args: unknown[]) => args,
  serverTimestamp: () => "synthetic-timestamp",
  getDocFromServer: vi.fn(),
}));

import ProvidersManagement from "./page";

let root: Root;
let container: HTMLDivElement;

async function changeInput(name: string, value: string) {
  const input = document.body.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.session = {
    user: { uid: "internal" },
    role: "ADMIN",
    companyId: "nextcon",
    tenantId: null,
    isUserLoading: true,
    userError: null,
  };
  mocks.activeClientId = "all";
  mocks.collection = {
    data: [{ id: "provider-private", name: "Prestador Fictício Confidencial" }],
    isLoading: false,
    error: null,
  };
  mocks.useCollection.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("providers page authorization state", () => {
  it("hides previously loaded provider data when the live profile loses internal scope", async () => {
    await act(async () => root.render(<ProvidersManagement />));
    expect(container.textContent).toContain("Verificando autorização");

    mocks.session = {
      user: { uid: "internal" },
      role: "ADMIN",
      companyId: "nextcon",
      tenantId: "company-a",
      isUserLoading: false,
      userError: null,
    };
    await act(async () => root.render(<ProvidersManagement />));

    expect(container.textContent).toContain("Acesso não autorizado");
    expect(container.textContent).not.toContain("Prestador Fictício Confidencial");
    expect(mocks.useCollection).toHaveBeenLastCalledWith(null);
  });

  it("does not display stale provider data after a profile read error", async () => {
    mocks.session = {
      user: { uid: "internal" },
      role: null,
      companyId: null,
      tenantId: null,
      isUserLoading: false,
      userError: new Error("synthetic profile read failure"),
    };
    await act(async () => root.render(<ProvidersManagement />));

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível verificar sua sessão"
    );
    expect(container.textContent).not.toContain("Prestador Fictício Confidencial");
  });

  it("shows provider read errors and invokes the real page retry action", async () => {
    mocks.session = {
      user: { uid: "internal" },
      role: "SUPER_ADMIN",
      companyId: null,
      tenantId: null,
      isUserLoading: false,
      userError: null,
    };
    mocks.collection = {
      data: null,
      isLoading: false,
      error: new Error("synthetic provider read failure"),
    };
    await act(async () => root.render(<ProvidersManagement />));

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível carregar os cadastros autorizados."
    );
    const callsBeforeRetry = mocks.useCollection.mock.calls.length;
    const retryButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Tentar novamente")
    );
    expect(retryButton).toBeDefined();
    await act(async () => retryButton?.click());
    expect(mocks.useCollection.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});

describe("provider council fields", () => {
  it("opens the new provider form with independent council and RQE fields", async () => {
    mocks.session.isUserLoading = false;
    await act(async () => root.render(<ProvidersManagement />));

    const createButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Novo Credenciamento")
    );
    expect(createButton).toBeDefined();
    await act(async () => createButton?.click());

    expect(document.body.querySelector('input[name="councilNumber"]')).not.toBeNull();
    expect(document.body.querySelector('input[name="rqe"]')).not.toBeNull();

    const councilNumber = await changeInput("councilNumber", "CRM fictício novo");
    const rqe = await changeInput("rqe", "RQE fictício novo");
    await changeInput("email", "e-mail inválido");
    await act(async () =>
      document.body.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click()
    );

    expect(document.body.textContent).toContain("E-mail inválido");
    expect(councilNumber?.value).toBe("CRM fictício novo");
    expect(rqe?.value).toBe("RQE fictício novo");
  });

  it("opens an existing provider with its separate council and RQE values", async () => {
    mocks.session.isUserLoading = false;
    mocks.collection = {
      data: [
        {
          id: "provider-fake",
          name: "Prestador Fictício",
          profession: "Médico",
          type: "DOCTOR",
          councilNumber: "CRM fictício",
          rqe: "RQE fictício",
          servedCompanies: [],
        },
      ],
      isLoading: false,
      error: null,
    };
    await act(async () => root.render(<ProvidersManagement />));

    const providerRow = [...container.querySelectorAll("tr")].find((row) =>
      row.textContent?.includes("Prestador Fictício")
    );
    const providerButton = providerRow?.querySelector("button");
    expect(providerButton).toBeDefined();
    await act(async () => providerButton?.click());

    expect(
      document.body.querySelector<HTMLInputElement>('input[name="councilNumber"]')?.value
    ).toBe("CRM fictício");
    expect(document.body.querySelector<HTMLInputElement>('input[name="rqe"]')?.value).toBe(
      "RQE fictício"
    );

    const councilNumber = await changeInput("councilNumber", "CRM fictício atualizado");
    const rqe = await changeInput("rqe", "RQE fictício atualizado");
    await changeInput("email", "e-mail inválido");
    await act(async () =>
      document.body.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click()
    );

    expect(document.body.textContent).toContain("E-mail inválido");
    expect(councilNumber?.value).toBe("CRM fictício atualizado");
    expect(rqe?.value).toBe("RQE fictício atualizado");
  });
});
