// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { askWorkAssistant } from "./work-assistant-openai";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "test-model");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("OpenAI operational assistant", () => {
  it("does not contact the provider without server configuration", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(askWorkAssistant([{ role: "user", content: "resumo" }], {})).rejects.toThrow(
      "configuração"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps credentials out of the prompt, disables storage and clears event dates", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  answer: "Proposta",
                  actions: [
                    {
                      title: "Exame admissional",
                      instructions: "Antes da atividade",
                      responsibleName: "Serviço médico",
                      dueDate: "2026-11-01",
                      deadlineBasis: "legal_event",
                      source: "Card existente",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    });
    const r = await askWorkAssistant([{ role: "user", content: "proponha" }], {
      company: { id: "ONE" },
    });
    expect(r.actions[0].dueDate).toBe("");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.model).toBe("test-model");
    expect(JSON.stringify(body)).not.toContain("test-key");
    expect(body.text.format.strict).toBe(true);
  });
  it("does not apply incomplete or invalid model output", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "incomplete", output: [] }),
    });
    await expect(askWorkAssistant([{ role: "user", content: "teste" }], {})).rejects.toThrow(
      "incompleta"
    );
  });
  it("does not expose provider error bodies", async () => {
    fetchMock.mockResolvedValue({ ok: false, text: async () => "private-provider-details" });
    await expect(askWorkAssistant([{ role: "user", content: "teste" }], {})).rejects.toThrow(
      "OpenAI não concluiu"
    );
  });
});
