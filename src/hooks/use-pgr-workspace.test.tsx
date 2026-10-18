import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { uid: "account-a" } as { uid: string } | null,
  headers: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: state.user }) }));
vi.mock("@/lib/pgr-request-headers", () => ({ pgrRequestHeaders: state.headers }));
import { usePgrCollection, usePgrCompanies, updatePgrTask } from "./use-pgr-workspace";

type Result = { data: unknown[]; loading: boolean; error?: string };
type Scope = { enabled?: boolean; company?: string; kind?: "tasks" | "risks" };
let host: HTMLDivElement, root: Root, commits: Array<Result & { uid?: string; scope: string }>;
let requests: Array<{
  url: string;
  init: RequestInit;
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
}>;
function View({ enabled = true, company, kind = "tasks" }: Scope) {
  const companies = usePgrCompanies(enabled && !company);
  const records = usePgrCollection(kind, company || null, enabled && !!company);
  const result = company ? records : companies;
  useLayoutEffect(() => {
    commits.push({
      ...result,
      uid: state.user?.uid,
      scope: `${company || "companies"}/${kind}/${enabled}`,
    });
  });
  return <output>{JSON.stringify(result)}</output>;
}
const render = (props: Scope = {}) => act(async () => root.render(<View {...props} />));
const reply = (index: number, body: unknown, status = 200) =>
  act(async () => requests[index].resolve(new Response(JSON.stringify(body), { status })));
const last = () => commits.at(-1)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  state.user = { uid: "account-a" };
  state.headers.mockReset().mockResolvedValue({ Authorization: "Bearer example" });
  requests = [];
  commits = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => requests.push({ url, init, resolve, reject }))
    )
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PGR subscription boundaries", () => {
  it("hides companies in every render after switching accounts", async () => {
    await render();
    await reply(0, { companies: [{ id: "private-a" }] });
    state.user = { uid: "account-b" };
    await render();
    expect(commits.filter((c) => c.uid === "account-b").every((c) => c.data.length === 0)).toBe(
      true
    );
    expect(last().loading).toBe(true);
  });
  it("hides the prior company before effects when selecting another company", async () => {
    await render({ company: "one" });
    await reply(0, { tasks: [{ id: "private-one" }] });
    await render({ company: "two" });
    expect(
      commits.filter((c) => c.scope.startsWith("two/")).every((c) => c.data.length === 0)
    ).toBe(true);
    expect(requests[0].init.signal?.aborted).toBe(true);
  });
  it("hides previous records when changing collection kind", async () => {
    await render({ company: "one" });
    await reply(0, { tasks: [{ id: "task" }] });
    await render({ company: "one", kind: "risks" });
    expect(
      commits.filter((c) => c.scope.includes("/risks/")).every((c) => c.data.length === 0)
    ).toBe(true);
    expect(requests[1].url).toBe("/api/pgr/risks?companyId=one");
  });
  it.each([{}, { company: "one" }])("hides data immediately after logout: %j", async (props) => {
    await render(props);
    await reply(
      0,
      props.company ? { tasks: [{ id: "secret" }] } : { companies: [{ id: "secret" }] }
    );
    state.user = null;
    await render(props);
    expect(commits.filter((c) => c.uid === undefined).every((c) => c.data.length === 0)).toBe(true);
    expect(last().loading).toBe(false);
    expect(requests[0].init.signal?.aborted).toBe(true);
  });
  it("does not send a request if credentials finish after logout", async () => {
    let release!: (value: object) => void;
    state.headers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    await render();
    state.user = null;
    await render();
    await act(async () => release({ Authorization: "Bearer old-session" }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("ignores late results after a company changes", async () => {
    await render({ company: "one" });
    await render({ company: "two" });
    await reply(1, { tasks: [{ id: "current" }] });
    await reply(0, { tasks: [{ id: "obsolete" }] });
    expect(last().data).toEqual([{ id: "current" }]);
  });
  it("keeps the newest refresh if requests finish out of order", async () => {
    await render({ company: "one" });
    await act(async () => window.dispatchEvent(new Event("nai:pgr-task-updated")));
    await reply(1, { tasks: [{ id: "new" }] });
    await reply(0, { tasks: [{ id: "old" }] });
    expect(last().data).toEqual([{ id: "new" }]);
  });
  it("exposes failed company reads instead of silently presenting an empty list", async () => {
    await render();
    await reply(0, { error: "Acesso negado" }, 403);
    expect(last()).toMatchObject({ data: [], loading: false, error: "Acesso negado" });
  });
  it("rejects malformed collection responses", async () => {
    await render({ company: "one" });
    await reply(0, { tasks: { id: "not-an-array" } });
    expect(last()).toMatchObject({ data: [], loading: false });
    expect(last().error).toBeTruthy();
  });
  it("shows the limit notice and clears previous data after refresh failure", async () => {
    await render({ company: "one" });
    await reply(0, { tasks: [{ id: "row" }], limited: true });
    expect(last().error).toContain("500");
    await act(async () => vi.advanceTimersByTime(30000));
    await reply(1, { error: "Consulta indisponível" }, 503);
    expect(last()).toMatchObject({ data: [], error: "Consulta indisponível", loading: false });
  });
  it("stops polling and hides data when disabled", async () => {
    await render({ company: "one" });
    await reply(0, { tasks: [{ id: "row" }] });
    await render({ company: "one", enabled: false });
    expect(
      commits.filter((c) => c.scope.endsWith("/false")).every((c) => c.data.length === 0)
    ).toBe(true);
    await act(async () => vi.advanceTimersByTime(60000));
    expect(requests).toHaveLength(1);
  });
  it("announces task updates only after successful persistence", async () => {
    const changed = vi.fn();
    window.addEventListener("nai:pgr-task-updated", changed);
    const user = { getIdToken: vi.fn() };
    const saved = updatePgrTask(user, "one", "task", { status: "done" });
    await act(async () => {});
    expect(changed).not.toHaveBeenCalled();
    await reply(0, { ok: true });
    await saved;
    expect(changed).toHaveBeenCalledTimes(1);
    const rejected = updatePgrTask(user, "one", "task", { status: "done" });
    const assertion = expect(rejected).rejects.toThrow("Acesso negado");
    await act(async () => {});
    await reply(1, { error: "Acesso negado" }, 403);
    await assertion;
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener("nai:pgr-task-updated", changed);
  });
});
