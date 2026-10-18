import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a" },
  scope: "a",
  run: vi.fn(),
  save: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: m.scope }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/ai/flows/knowledge-assistant-flow", () => ({ runKnowledgeAssistant: m.run }));
vi.mock("@/actions/save-nai-lead", () => ({ salvarLeadNai: m.save }));
vi.mock("next/image", () => ({ default: ({ src, alt }: any) => <img src={src} alt={alt} /> }));
import { NaiFloatingWidget } from "./nai-floating-widget";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a" };
  m.scope = "a";
  m.run
    .mockReset()
    .mockResolvedValue({ answer: "Resposta comercial sintética", advice: "Conferir com a equipe" });
  m.save.mockReset().mockResolvedValue({ sucesso: true });
  m.token.mockReset().mockResolvedValue("token");
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "open").mockReturnValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
async function open(skill = "Agendamento de Exames") {
  await v.render(<NaiFloatingWidget />);
  await v.click("NAI");
  await v.click(skill);
}
async function send(text = "Empresa sintética, 10 pessoas, Vitória/ES") {
  await v.input("input", text);
  await v.submit();
}
describe("commercial assistant interaction", () => {
  it.each(["Agendamento de Exames", "Elaboração de Documentos", "Outras Demandas"])(
    "opens the %s menu and returns without sending",
    async (skill) => {
      await open(skill);
      expect(v.button("Voltar ao Menu")).toBeDefined();
      await v.click("Voltar ao Menu");
      expect(m.run).not.toHaveBeenCalled();
      await v.click("Fechar assistente");
      expect(v.button("NAI")).toBeDefined();
    }
  );
  it("uses the selected speciality and sends only the current interaction to the authenticated lead action", async () => {
    await open();
    await send();
    expect(m.run.mock.calls[0][0].query).toContain("Agendamento de Exames");
    expect(m.run.mock.calls[0][0].query).toContain("Não invente preços");
    expect(m.save).toHaveBeenCalledWith(
      {
        skillTitle: expect.stringContaining("Agendamento"),
        userText: "Empresa sintética, 10 pessoas, Vitória/ES",
        aiResponse: "Resposta comercial sintética",
      },
      "token"
    );
    expect(v.container.textContent).toContain("Conferir com a equipe");
  });
  it("handles explicit quick replies and opens WhatsApp only on the operator click", async () => {
    await open();
    await v.click("Como solicitar um agendamento?");
    expect(m.run).toHaveBeenCalledOnce();
    expect(window.open).not.toHaveBeenCalled();
    await v.click("Chamar no WhatsApp Comercial");
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/"),
      "_blank",
      "noopener,noreferrer"
    );
    expect(m.run).toHaveBeenCalledOnce();
  });
  it("marks fallback as unavailable and does not invent a booking", async () => {
    m.run.mockRejectedValueOnce(Error("offline"));
    await open();
    await send();
    expect(v.container.textContent).toContain("nenhum agendamento foi realizado");
    expect(window.open).not.toHaveBeenCalled();
  });
  it("reports failed conversation persistence", async () => {
    m.save.mockResolvedValueOnce({ sucesso: false });
    await open();
    await send();
    expect(v.container.textContent).toContain("Não foi possível salvar esta mensagem");
  });
  it("blocks repeated sends and back navigation while a response is pending", async () => {
    const p = deferred<any>();
    m.run.mockReturnValue(p.promise);
    await open();
    await send();
    await v.click("Como solicitar um agendamento?");
    await v.click("Voltar ao Menu");
    expect(m.run).toHaveBeenCalledOnce();
    expect(v.button("Voltar ao Menu").disabled).toBe(true);
    await act(async () => p.resolve({ answer: "Pronto" }));
    expect(m.save).toHaveBeenCalledOnce();
  });
  it("rejects oversized input before any action", async () => {
    await open();
    await send("x".repeat(4001));
    expect(m.run).not.toHaveBeenCalled();
  });
  it("does not save a previous company response after a scope change", async () => {
    const p = deferred<any>();
    m.run.mockReturnValue(p.promise);
    await open();
    await send();
    m.scope = "b";
    await v.render(<NaiFloatingWidget />);
    await act(async () => p.resolve({ answer: "Antiga" }));
    expect(m.save).not.toHaveBeenCalled();
    expect(v.container.textContent).not.toContain("Antiga");
  });
  it("does not send after the old session token completes", async () => {
    const p = deferred<string>();
    m.token.mockReturnValue(p.promise);
    await open();
    await send();
    m.user = { uid: "b" };
    await v.render(<NaiFloatingWidget />);
    await act(async () => p.resolve("old"));
    expect(m.run).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("does not save with a second token resolved after changing company", async () => {
    const p = deferred<string>();
    m.token.mockResolvedValueOnce("token").mockReturnValueOnce(p.promise);
    await open();
    await send();
    m.scope = "b";
    await v.render(<NaiFloatingWidget />);
    await act(async () => p.resolve("old"));
    expect(m.save).not.toHaveBeenCalled();
  });
});
