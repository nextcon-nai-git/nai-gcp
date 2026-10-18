import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ user: null as any, scope: "a", fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: m.scope }) }));
import Copilot from "./medical-copilot";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token") };
  m.scope = "a";
  m.fetch.mockReset().mockResolvedValue(new Response("Resposta sintética para revisão"));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function render(patient = "patient-a") {
  await v.render(<Copilot pacienteId={patient} />);
}
async function send() {
  await v.input("input", "Pergunta sintética");
  await v.submit();
}
describe("clinical copilot streaming isolation", () => {
  it.each(["all", "unauthorized", ""])(
    "does not send a patient request with company scope %s",
    async (scope) => {
      m.scope = scope;
      await render();
      await send();
      expect(m.fetch).not.toHaveBeenCalled();
    }
  );
  it("requires a signed-in user and a patient", async () => {
    m.user = null;
    await render();
    await send();
    expect(m.fetch).not.toHaveBeenCalled();
    m.user = { uid: "a" };
    await render("");
    await send();
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("sends the authenticated company/patient pair and displays streamed UTF-8 correctly", async () => {
    const bytes = new TextEncoder().encode("Análise sintética");
    m.fetch.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(bytes.slice(0, 3));
            c.enqueue(bytes.slice(3));
            c.close();
          },
        })
      )
    );
    await render();
    await send();
    const options = m.fetch.mock.calls[0][1];
    expect(options.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(options.body)).toEqual({
      pacienteId: "patient-a",
      companyId: "a",
      mensagemMedico: "Pergunta sintética",
    });
    expect(v.container.textContent).toContain("Análise sintética");
  });
  it.each(["http", "body", "network"])(
    "surfaces stream failures and allows another request: %s",
    async (mode) => {
      if (mode === "network") m.fetch.mockRejectedValueOnce(Error("offline"));
      else
        m.fetch.mockResolvedValueOnce(
          mode === "http" ? new Response("Denied", { status: 403 }) : { ok: true, body: null }
        );
      await render();
      await send();
      expect(v.container.textContent).toContain("verifique o histórico do paciente manualmente");
      expect(v.container.querySelector("input")?.disabled).toBe(false);
    }
  );
  it("does not send after a token resolves following a patient switch", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValue(p.promise);
    await render();
    await send();
    await render("patient-b");
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
    expect(v.container.textContent).not.toContain("Pergunta sintética");
  });
  it("aborts a previous company stream and suppresses its late chunks", async () => {
    const p = deferred<any>(),
      cancel = vi.fn().mockResolvedValue(undefined);
    m.fetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: () => p.promise, cancel }) },
    });
    await render();
    await send();
    const signal = m.fetch.mock.calls[0][1].signal;
    m.scope = "b";
    await render();
    expect(signal.aborted).toBe(true);
    await act(async () =>
      p.resolve({ done: false, value: new TextEncoder().encode("Private old answer") })
    );
    expect(v.container.textContent).not.toContain("Private old answer");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("prevents concurrent requests and clears the entire thread on logout", async () => {
    const p = deferred<Response>();
    m.fetch.mockReturnValue(p.promise);
    await render();
    await send();
    await v.submit();
    expect(m.fetch).toHaveBeenCalledOnce();
    m.user = null;
    await render();
    await act(async () => p.resolve(new Response("Old answer")));
    expect(v.container.textContent).not.toContain("Old answer");
    expect(v.container.textContent).not.toContain("Pergunta sintética");
  });
});
