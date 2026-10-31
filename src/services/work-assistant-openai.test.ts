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
  it("executes only the authorized preparation callback and returns server-authored confirmation text", async () => {
    const preview = { proposalId: "preview", employees: [{ id: "e1" }] } as any;
    const prepare = vi.fn().mockResolvedValue(preview);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          {
            type: "function_call",
            name: "prepare_selected_kits",
            arguments: "{}",
            call_id: "call-1",
          },
          { type: "message", content: [{ type: "output_text", text: "Enviei ao SOC" }] },
        ],
      }),
    });
    const result = await askWorkAssistant(
      [{ role: "user", content: "Prepare os kits selecionados" }],
      { selectedKitBatch: { count: 1 } },
      prepare
    );
    expect(prepare).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ kitProposal: preview, actions: [] });
    expect(result.answer).toContain("Nenhum PDF foi emitido");
    expect(result.answer).not.toContain("Enviei");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.parallel_tool_calls).toBe(false);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].parameters.additionalProperties).toBe(false);
  });
  it.each([
    [{ type: "function_call", name: "send_to_soc", arguments: "{}" }],
    [{ type: "function_call", name: "prepare_selected_kits", arguments: '{"clinicId":"forged"}' }],
    [{ type: "function_call", name: "prepare_selected_kits", arguments: "[]" }],
    [{ type: "function_call", name: "prepare_selected_kits", arguments: "invalid" }],
    [
      { type: "function_call", name: "prepare_selected_kits", arguments: "{}" },
      { type: "function_call", name: "prepare_selected_kits", arguments: "{}" },
    ],
  ])("rejects unexpected, forged or repeated tool calls %#", async (...output) => {
    const prepare = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "completed", output }) });
    await expect(
      askWorkAssistant([{ role: "user", content: "gere" }], {}, prepare)
    ).rejects.toThrow();
    expect(prepare).not.toHaveBeenCalled();
  });
  it("does not execute a tool if there was no selected authorized batch", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [{ type: "function_call", name: "prepare_selected_kits", arguments: "{}" }],
      }),
    });
    await expect(askWorkAssistant([{ role: "user", content: "gere" }], {})).rejects.toThrow(
      "autorizada"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toBeUndefined();
  });
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
