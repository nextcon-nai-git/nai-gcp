import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a" } as any,
  scope: "a",
  run: vi.fn(),
  token: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: m.scope }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/ai/flows/knowledge-assistant-flow", () => ({ runKnowledgeAssistant: m.run }));
vi.mock("@/components/voice/voice-assistant-button", () => ({
  VoiceAssistantButton: ({ onTranscript, isProcessing }: any) => (
    <button disabled={isProcessing} onClick={() => onTranscript("Transcrição sintética")}>
      Transcrição teste
    </button>
  ),
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a" };
  m.scope = "a";
  m.run.mockReset().mockResolvedValue({
    answer: "Resposta sintética",
    advice: "Conferir a fonte",
    references: [],
  });
  m.token.mockReset().mockResolvedValue("token");
  m.toast.mockReset();
});
afterEach(async () => v.cleanup());
async function send() {
  await v.input("input", "Dúvida sintética");
  await v.submit();
}
describe("knowledge consultation session", () => {
  it("submits an authenticated query and displays advice", async () => {
    await v.render(<Page />);
    await send();
    expect(m.run).toHaveBeenCalledWith({ query: "Dúvida sintética" }, "token");
    expect(v.container.textContent).toContain("Resposta sintética");
    expect(v.container.textContent).toContain("Conferir a fonte");
  });
  it.each([
    "Estou abrindo a empresa",
    "Recebi uma cobrança",
    "Só quero renovar",
    "Quero apenas enviar",
  ])("uses the selected objective: %s", async (label) => {
    await v.render(<Page />);
    await v.click(label);
    expect(m.run).toHaveBeenCalledOnce();
    expect(m.run.mock.calls[0][0].query.length).toBeGreaterThan(25);
  });
  it("submits a voice transcript through the same authenticated action", async () => {
    await v.render(<Page />);
    await v.click("Transcrição teste");
    expect(m.run).toHaveBeenCalledWith({ query: "Transcrição sintética" }, "token");
  });
  it("switches the visible consultation label without inventing a new answer", async () => {
    await v.render(<Page />);
    await v.click("Saúde do Trabalho");
    expect(m.run).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("Saúde do Trabalho");
    await v.click("Segurança do Trabalho");
    expect(m.run).not.toHaveBeenCalled();
  });
  it("keeps blank or unauthenticated queries off the server", async () => {
    m.user = null;
    await v.render(<Page />);
    await send();
    expect(m.run).not.toHaveBeenCalled();
  });
  it("prevents duplicate submissions while the action is pending", async () => {
    const p = deferred<any>();
    m.run.mockReturnValue(p.promise);
    await v.render(<Page />);
    await send();
    await v.submit();
    expect(m.run).toHaveBeenCalledOnce();
    await act(async () => p.resolve({ answer: "Concluído", references: [] }));
    expect(v.container.textContent).toContain("Concluído");
  });
  it("does not display previous company answers after changing scope", async () => {
    const p = deferred<any>();
    m.run.mockReturnValue(p.promise);
    await v.render(<Page />);
    await send();
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve({ answer: "Resposta antiga", references: [] }));
    expect(v.container.textContent).not.toContain("Resposta antiga");
    expect(v.container.textContent).not.toContain("Dúvida sintética");
  });
  it("does not transmit a query after token completion following logout", async () => {
    const p = deferred<string>();
    m.token.mockReturnValue(p.promise);
    await v.render(<Page />);
    await send();
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.run).not.toHaveBeenCalled();
  });
  it("reports failure and enables retry without presenting a successful answer", async () => {
    m.run.mockRejectedValueOnce(Error("offline"));
    await v.render(<Page />);
    await send();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro na NAI", description: "offline" })
    );
    await send();
    expect(m.run).toHaveBeenCalledTimes(2);
  });
});
