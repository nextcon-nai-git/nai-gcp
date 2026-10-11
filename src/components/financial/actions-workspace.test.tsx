import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  actionImportFixture,
  savedActionBatchFixture,
} from "../../../tests/fixtures/financial-actions";

const mocks = vi.hoisted(() => ({ user: null as User | null, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
import { FinancialActionsWorkspace } from "./actions-workspace";

let container: HTMLDivElement;
let root: Root;
const batch = () => savedActionBatchFixture();
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const list = (batches = [batch()]) => response({ schemaVersion: 1, batches, nextCursor: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function account(uid: string): User {
  return { uid, getIdToken: vi.fn().mockResolvedValue(`token-${uid}`) } as unknown as User;
}
function button(text: string, scope: ParentNode = container) {
  const found = Array.from(scope.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(text)
  );
  expect(found, `Button ${text}`).toBeDefined();
  return found!;
}
function detail() {
  const found = container.querySelector<HTMLDivElement>('[role="dialog"]');
  expect(found).not.toBeNull();
  return found!;
}
async function changeStatus(value: string) {
  const select = detail().querySelector("select")!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.user = account("finance-a");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("financial action workspace", () => {
  it.each([401, 403])(
    "renders no private actions or import controls after server denial %i",
    async (status) => {
      mocks.fetch.mockResolvedValue(response({ error: "Acesso não autorizado" }, status));
      await act(async () => root.render(<FinancialActionsWorkspace />));
      expect(container.textContent).toContain("Acesso financeiro restrito");
      expect(container.textContent).not.toContain(actionImportFixture.actions[0].title);
      expect(
        Array.from(container.querySelectorAll("button")).some((item) =>
          item.textContent?.includes("Importar ações")
        )
      ).toBe(false);
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/financial/actions",
        expect.objectContaining({
          cache: "no-store",
          headers: expect.objectContaining({ Authorization: "Bearer token-finance-a" }),
        })
      );
    }
  );

  it("clears loaded details on account switch and ignores the old account's late response", async () => {
    const late = deferred<Response>();
    mocks.fetch
      .mockResolvedValueOnce(list())
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(list([]));
    await act(async () => root.render(<FinancialActionsWorkspace />));
    await act(async () => button("Abrir e acompanhar").click());
    expect(detail().textContent).toContain(actionImportFixture.actions[0].rationale);
    await act(async () => button("Atualizar").click());
    mocks.user = account("finance-b");
    await act(async () => root.render(<FinancialActionsWorkspace />));
    expect(container.textContent).not.toContain(actionImportFixture.actions[0].title);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => late.resolve(list()));
    expect(container.textContent).not.toContain(actionImportFixture.actions[0].title);
    expect(container.textContent).toContain("Seu plano financeiro começa aqui");
  });

  it("requires mandatory checks and only displays the saved progress after server confirmation", async () => {
    const original = batch();
    const saved = batch();
    saved.version = 2;
    saved.actions[0].version = 2;
    saved.actions[0].status = "done";
    saved.actions[0].checklist[0].checked = true;
    saved.actions[0].checklist[1].checked = true;
    const confirmation = deferred<Response>();
    mocks.fetch.mockResolvedValueOnce(list([original])).mockReturnValueOnce(confirmation.promise);
    await act(async () => root.render(<FinancialActionsWorkspace />));
    await act(async () => button("Abrir e acompanhar").click());
    expect(
      detail().querySelector('a[href="https://example.com/financeiro"]')?.getAttribute("rel")
    ).toBe("noopener noreferrer");
    await changeStatus("done");
    expect(button("Salvar acompanhamento", detail()).disabled).toBe(true);
    await act(async () => {
      const checks = detail().querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      checks[0].click();
      checks[1].click();
    });
    expect(button("Salvar acompanhamento", detail()).disabled).toBe(false);
    expect(original.actions[0].checklist.every((item) => !item.checked)).toBe(true);
    await act(async () => button("Salvar acompanhamento", detail()).click());
    expect(container.textContent).toContain("Checklist 0/3");
    expect(container.textContent).not.toContain("Alterações salvas e confirmadas");
    const [, request] = mocks.fetch.mock.calls[1];
    const payload = JSON.parse(request.body);
    expect(payload).toEqual({
      batchId: original.id,
      actionId: original.actions[0].id,
      expectedVersion: 1,
      status: "done",
      checklist: [
        { id: "documento", checked: true },
        { id: "comprovante", checked: true },
        { id: "nota", checked: false },
      ],
    });
    await act(async () =>
      confirmation.resolve(response({ batch: saved, action: saved.actions[0] }))
    );
    expect(container.textContent).toContain("Alterações salvas e confirmadas");
    expect(container.textContent).toContain("Checklist 2/3");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("reloads the current record after a version conflict without preserving a stale edit dialog", async () => {
    const updated = batch();
    updated.actions[0].status = "blocked";
    updated.actions[0].version = 2;
    mocks.fetch
      .mockResolvedValueOnce(list())
      .mockResolvedValueOnce(response({ error: "Versão antiga" }, 409))
      .mockResolvedValueOnce(list([updated]));
    await act(async () => root.render(<FinancialActionsWorkspace />));
    await act(async () => button("Abrir e acompanhar").click());
    await changeStatus("in_progress");
    await act(async () => button("Salvar acompanhamento", detail()).click());
    expect(container.textContent).toContain("Sua edição não foi aplicada");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => button("Abrir e acompanhar").click());
    expect(detail().querySelector("select")?.value).toBe("blocked");
    expect(detail().textContent).toContain("Versão 2");
  });

  it("removes financial data on revoked access and prevents an older successful request from restoring it", async () => {
    const older = deferred<Response>();
    mocks.fetch
      .mockResolvedValueOnce(list())
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(response({ error: "Acesso revogado" }, 403));
    await act(async () => root.render(<FinancialActionsWorkspace />));
    await act(async () => button("Atualizar").click());
    await act(async () => button("Abrir e acompanhar").click());
    await changeStatus("in_progress");
    await act(async () => button("Salvar acompanhamento", detail()).click());
    expect(container.textContent).toContain("Acesso financeiro restrito");
    expect(container.textContent).not.toContain(actionImportFixture.actions[0].title);
    await act(async () => older.resolve(list()));
    expect(container.textContent).not.toContain(actionImportFixture.actions[0].title);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("previews a versioned import and uses the confirmed duplicate record with existing progress", async () => {
    const existing = batch();
    existing.actions[0].status = "in_progress";
    existing.actions[0].version = 2;
    existing.actions[0].checklist[0].checked = true;
    mocks.fetch
      .mockResolvedValueOnce(list([]))
      .mockResolvedValueOnce(response({ batch: existing, alreadySaved: true }));
    await act(async () => root.render(<FinancialActionsWorkspace />));
    const file = new File([JSON.stringify(actionImportFixture)], "plano-teste.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(JSON.stringify(actionImportFixture)),
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(detail().textContent).toContain("Revisar importação");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await act(async () => button("Importar ações", detail()).click());
    expect(container.textContent).toContain(
      "O andamento e os checklists existentes foram preservados"
    );
    expect(container.textContent).toContain("Checklist 1/3");
    expect(mocks.fetch.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual(actionImportFixture);
  });
});
