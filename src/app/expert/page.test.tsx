import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ExpertWorkspace } from "@/lib/expert-workspace";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  token: vi.fn(),
  user: { uid: "expert" },
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: mocks.user, role: "SCOPED_PROVIDER" }),
}));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: mocks.token }));
import ExpertPage from "./page";

let host: HTMLDivElement;
let root: Root;
const workspace = (companyId = "a", ids = ["a", "b", "c"]): ExpertWorkspace => ({
  companyId,
  companies: ids.map((id) => ({ id, name: `Unidade ${id}`, cnpj: id, city: "", state: "" })),
  tasks: [
    {
      id: companyId,
      title: `Card ${companyId}`,
      status: "todo",
      priority: "",
      dueDate: "2026-11-03T00:00:00.000Z",
      checklist: [],
    },
  ],
  truncated: false,
});
const response = (data: unknown, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data,
});
const render = () => act(async () => root.render(<ExpertPage />));
const select = (value: string) =>
  act(async () => {
    const control = host.querySelector("select")!;
    control.value = value;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
const refresh = () => act(async () => host.querySelector("button")!.click());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.user = { uid: "expert" };
  mocks.token.mockReset().mockResolvedValue("synthetic-token");
  mocks.fetch.mockReset().mockResolvedValue(response(workspace()));
  vi.stubGlobal("fetch", mocks.fetch);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("renders the deadline stored by TaskCreateDialog", async () => {
  await render();
  expect(host.textContent).toContain("Prazo: 03/11/2026");
  expect(host.textContent).not.toContain("Não informado");
});

it.each([400, 403])(
  "recovers the remaining unit selector after revocation or deletion (%s)",
  async (status) => {
    await render();
    mocks.fetch.mockResolvedValueOnce(response(workspace("b")));
    await select("b");
    expect(host.textContent).toContain("Card b");
    let finish!: (value: ReturnType<typeof response>) => void;
    mocks.fetch
      .mockResolvedValueOnce(response({ error: "Unidade indisponível." }, status))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    await refresh();
    expect(host.textContent).not.toContain("Card b");
    expect(host.querySelector("select")).toBeNull();
    expect(mocks.fetch.mock.calls.at(-1)?.[0]).toBe("/api/expert/workspace");
    await act(async () => finish(response(workspace("a", ["a", "c"]))));
    expect(Array.from(host.querySelectorAll("option")).map((o) => o.value)).toEqual(["a", "c"]);
    mocks.fetch.mockResolvedValueOnce(response(workspace("c", ["a", "c"])));
    await select("c");
    expect(host.textContent).toContain("Card c");
    expect(mocks.fetch.mock.calls.at(-1)?.[0]).toBe("/api/expert/workspace?company=c");
  }
);

it("fails closed with a bounded retry when all grants are revoked", async () => {
  await render();
  mocks.fetch.mockResolvedValueOnce(response(workspace("b")));
  await select("b");
  mocks.fetch.mockResolvedValue(response({ error: "Nenhuma unidade liberada." }, 403));
  await refresh();
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Nenhuma unidade liberada.");
  expect(host.querySelector("select")).toBeNull();
  expect(host.textContent).not.toContain("Card b");
  await refresh();
  expect(mocks.fetch).toHaveBeenCalledTimes(5);
  expect(mocks.fetch.mock.calls.at(-1)?.[0]).toBe("/api/expert/workspace");
});

it.each([401, 503])("does not retry authentication or server failures (%s)", async (status) => {
  await render();
  mocks.fetch.mockResolvedValueOnce(response(workspace("b")));
  await select("b");
  mocks.fetch.mockResolvedValue(response({ error: "Consulta indisponível." }, status));
  await refresh();
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Consulta indisponível.");
  expect(host.textContent).not.toContain("Card b");
});

it("discards an in-flight recovery when the signed-in account changes", async () => {
  await render();
  mocks.fetch.mockResolvedValueOnce(response(workspace("b")));
  await select("b");
  let finish!: (value: ReturnType<typeof response>) => void;
  mocks.fetch
    .mockResolvedValueOnce(response({ error: "Unidade não autorizada." }, 403))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
  await refresh();
  const signal = mocks.fetch.mock.calls.at(-1)?.[1].signal as AbortSignal;
  mocks.user = { uid: "other-expert" };
  mocks.fetch.mockResolvedValueOnce(response(workspace("other", ["other"])));
  await render();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response(workspace("a", ["a", "c"]))));
  expect(host.textContent).toContain("Card other");
  expect(host.textContent).not.toContain("Card a");
  expect(Array.from(host.querySelectorAll("option")).map((o) => o.value)).toEqual(["other"]);
});
