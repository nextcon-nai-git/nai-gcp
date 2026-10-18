import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { useExecutiveDashboard } from "./use-executive-dashboard";
function Panel({ scope = "a" }: { scope?: string }) {
  const r = useExecutiveDashboard(scope);
  return (
    <>
      <p>{JSON.stringify(r.data)}</p>
      <p>{r.error}</p>
      <button onClick={() => void r.refresh()}>Atualizar</button>
    </>
  );
}
let v: ReturnType<typeof ui>;
const res = (body: unknown, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => body,
});
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.fetch.mockReset().mockResolvedValue(res({ synthetic: "dashboard-a" }));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("executive dashboard data boundaries", () => {
  it("clears data on explicit denial and recovers through refresh", async () => {
    await v.render(<Panel />);
    expect(v.container.textContent).toContain("dashboard-a");
    m.fetch.mockResolvedValueOnce(res({ error: "Acesso revogado" }, 403));
    await v.click("Atualizar");
    expect(v.container.textContent).not.toContain("dashboard-a");
    expect(v.container.textContent).toContain("Acesso revogado");
    await v.click("Atualizar");
    expect(v.container.textContent).toContain("dashboard-a");
  });
  it("keeps newer results when an old scope finishes last", async () => {
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.render(<Panel />);
    m.fetch.mockResolvedValueOnce(res({ synthetic: "dashboard-b" }));
    await v.render(<Panel scope="b" />);
    await act(async () => p.resolve(res({ synthetic: "old-a" })));
    expect(v.container.textContent).toContain("dashboard-b");
    expect(v.container.textContent).not.toContain("old-a");
  });
  it("never starts fetch after token resolves on unmount", async () => {
    const p = deferred<string>();
    m.user!.getIdToken.mockReturnValueOnce(p.promise);
    await v.render(<Panel />);
    await v.render(<p>Saída</p>);
    await act(async () => p.resolve("stale"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("does not refresh while hidden and resumes on the next visible interval", async () => {
    vi.useFakeTimers();
    let visible = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visible as DocumentVisibilityState
    );
    await v.render(<Panel />);
    await act(async () => vi.advanceTimersByTime(60000));
    expect(m.fetch).toHaveBeenCalledTimes(1);
    visible = "visible";
    await act(async () => vi.advanceTimersByTime(60000));
    expect(m.fetch).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
  it("keeps data unavailable for logged-out sessions", async () => {
    m.user = null;
    await v.render(<Panel />);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(v.container.textContent).not.toContain("dashboard-a");
  });
});
