import { afterEach, describe, expect, it, vi } from "vitest";
import { ai, MODEL_MAP } from "./router";
import { auditS2220EventFlow } from "./flows/audit-s2220";
import { generateWithFallback } from "./resilient-runner";
import {
  checkAuditProfile,
  executeAuthorizedAudit,
} from "../../services/esocial/s2220-audit-access";
import { z } from "genkit";
import { applicationDefault } from "firebase-admin/app";
const base = {
  cpfTrabalhador: "12345678909",
  tipoExame: "9",
  dataAso: "2026-05-12",
  resultadoAso: "1",
  medicoEmitente: { nome: "MÉDICA TESTE", crm: "98765", ufCrm: "PR" },
  examesComplementares: [
    { codigoProcedimento: "0295", dataExame: "2026-05-12", observacao: "PRIVADO TESTE" },
  ],
};
const response = (prioridades: string[]) =>
  ({
    output: { prioridades },
    finishReason: "stop",
    usage: { inputTokens: 8, outputTokens: 4 },
  }) as Awaited<ReturnType<typeof ai.generate>>;
const status = (s: number) =>
  Object.assign(new Error("mensagem sensível do provedor"), { status: s });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("auditoria S-2220", () => {
  it("audita demissional e mantém o documento fora da geração e dos logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const gen = vi.spyOn(ai, "generate").mockResolvedValue(response(["conclusao", "agente"]));
    const result = await auditS2220EventFlow(base);
    expect(result).toMatchObject({
      statusConformidade: "CONFORME",
      scoreRisco: 0,
      modeloUtilizado: MODEL_MAP.gemini,
      validacaoTabelasEsocial: { tabela24Conforme: null, tabela27Conforme: true },
    });
    expect(result.recomendacoesCorrecao).toHaveLength(1);
    const external = JSON.stringify([gen.mock.calls, log.mock.calls]);
    for (const privateText of [
      base.cpfTrabalhador,
      base.medicoEmitente.nome,
      base.medicoEmitente.crm,
      base.dataAso,
      "PRIVADO TESTE",
      "0295",
    ])
      expect(external).not.toContain(privateText);
  });
  it.each([
    { cpfTrabalhador: "12345678901" },
    { cpfTrabalhador: "xxxxxxxxxxx" },
    { dataAso: "2026-02-30" },
    { tipoExame: "5" },
    { selectedProvider: "outro" },
  ])("recusa entrada inválida antes da IA (%j)", async (patch) => {
    const gen = vi.spyOn(ai, "generate");
    await expect(auditS2220EventFlow({ ...base, ...patch })).rejects.toThrow();
    expect(gen).not.toHaveBeenCalled();
  });
  it("separa inaptidão de rejeição e confere vigência, duplicidade, consentimento e ordem", async () => {
    vi.spyOn(ai, "generate").mockResolvedValue(response([]));
    expect(await auditS2220EventFlow({ ...base, tipoExame: "4", resultadoAso: "2" })).toMatchObject(
      { statusConformidade: "CONFORME", revisaoMedicaPrioritaria: true, scoreRisco: 0 }
    );
    const item = { codigoProcedimento: "0281", dataExame: "2026-06-01", resultado: "2" };
    const result = await auditS2220EventFlow({
      ...base,
      examesComplementares: [item, item, { ...item, codigoProcedimento: "X" }],
      agentesNocivosRelacionados: ["X"],
    });
    expect(result.validacaoTabelasEsocial).toEqual({
      tabela24Conforme: false,
      tabela27Conforme: false,
    });
    expect(result.inconsistenciasDetectadas.map((i) => i.campo)).toEqual(
      expect.arrayContaining([
        "examesComplementares.0.ordemExame",
        "examesComplementares.0.dataExame",
        "examesComplementares.0.resultado",
        "examesComplementares.1",
        "agentesNocivosRelacionados.0",
      ])
    );
  });
  it("preserva o parecer documental quando nenhum modelo responde", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.spyOn(ai, "generate").mockRejectedValue(status(403));
    expect(await auditS2220EventFlow({ ...base, examesComplementares: [] })).toMatchObject({
      statusConformidade: "NAO_CONFORME",
      modeloUtilizado: null,
      tentativas: 1,
    });
  });
});
describe("executor resiliente", () => {
  const ask = (primaryProvider: "gemini" | "gpt" | "claude") =>
    generateWithFallback({
      primaryProvider,
      prompt: "TESTE",
      outputSchema: z.object({ prioridades: z.array(z.string()) }),
    });
  it.each([
    ["gpt", "claude", "gemini"],
    ["claude", "gpt", "gemini"],
    ["gemini", "gpt", "claude"],
  ] as const)("respeita a prioridade %s, %s, %s", async (first, second, last) => {
    vi.stubEnv("OPENAI_API_KEY", "TESTE");
    vi.stubEnv("ANTHROPIC_API_KEY", "TESTE");
    const gen = vi
      .spyOn(ai, "generate")
      .mockRejectedValueOnce(status(403))
      .mockResolvedValueOnce(response([]));
    expect(await ask(first)).toMatchObject({
      executedModel: MODEL_MAP[second],
      fallbackOccurred: true,
      attemptsCount: 2,
    });
    expect(gen.mock.calls.map(([o]) => (o as { model: string }).model)).toEqual([
      MODEL_MAP[first],
      MODEL_MAP[second],
    ]);
    gen
      .mockClear()
      .mockRejectedValueOnce(status(404))
      .mockRejectedValueOnce(status(403))
      .mockResolvedValueOnce(response([]));
    expect(await ask(first)).toMatchObject({ executedModel: MODEL_MAP[last], attemptsCount: 3 });
  });
  it("registra duas retentativas, consumo e uma única conclusão sem erro cru", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const gen = vi
      .spyOn(ai, "generate")
      .mockRejectedValueOnce(status(429))
      .mockRejectedValueOnce(status(503))
      .mockResolvedValueOnce(response([]));
    expect(await ask("gemini")).toMatchObject({ attemptsCount: 3, fallbackOccurred: false });
    expect(gen).toHaveBeenCalledTimes(3);
    const entries = log.mock.calls.map(([s]) => JSON.parse(s).naiMetrics);
    expect(entries.map((m) => m.event)).toEqual([
      "AI_RETRY_ATTEMPT",
      "AI_RETRY_ATTEMPT",
      "AI_EXECUTION_SUCCESS",
    ]);
    expect(entries[2]).toMatchObject({ inputTokens: 8, outputTokens: 4 });
    expect(JSON.stringify(entries)).not.toContain("sensível");
  });
  it("troca na saída inválida e interrompe uma solicitação bloqueada", async () => {
    vi.stubEnv("OPENAI_API_KEY", "TESTE");
    const gen = vi
      .spyOn(ai, "generate")
      .mockResolvedValueOnce(response(null as unknown as string[]))
      .mockResolvedValueOnce(response([]));
    expect(await ask("gemini")).toMatchObject({
      executedModel: MODEL_MAP.gpt,
      failedProviders: [{ error: "invalid_output", provider: "gemini", retriesTried: 0 }],
    });
    gen
      .mockClear()
      .mockRejectedValue(Object.assign(new Error(), { name: "GenerationBlockedError" }));
    await expect(ask("gemini")).rejects.toThrow("indisponível");
    expect(gen).toHaveBeenCalledTimes(1);
  });
  it("cancela a tentativa no prazo e contabiliza o timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let signal: AbortSignal | undefined;
    vi.spyOn(ai, "generate")
      .mockImplementationOnce(async (opts) => {
        signal = (await opts).abortSignal;
        return new Promise(() => {});
      })
      .mockResolvedValueOnce(response([]));
    const pending = ask("gemini");
    await vi.advanceTimersByTimeAsync(13001);
    expect(signal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ attemptsCount: 2 });
  });
});
describe("controle clínico", () => {
  it("rejeita token ausente e restringe o perfil à empresa", async () => {
    await expect(executeAuthorizedAudit("", "A", base)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(() => checkAuditProfile({ role: "DOCTOR", servedCompanies: ["A"] }, "A")).not.toThrow();
    for (const profile of [
      { role: "DOCTOR", servedCompanies: ["B"] },
      { role: "OPERATIONS", servedCompanies: ["A"] },
      { role: "SUPER_ADMIN", tenantId: "A" },
      { role: "ADMIN", accessEnabled: false },
      { role: "ADMIN", isDeleted: true },
    ])
      expect(() => checkAuditProfile(profile, "A")).toThrow();
    expect(() => checkAuditProfile({ role: "ADMIN" }, "all")).toThrow();
  });
});

it("executa o fallback pelo generateContent do Vertex com o Genkit real e somente códigos", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "nai-teste");
  vi.stubEnv("NAI_VERTEX_LOCATION", "us");
  vi.spyOn(applicationDefault(), "getAccessToken").mockResolvedValue({
    access_token: "teste",
    expires_in: 60,
  });
  const fetchVertex = vi.fn().mockResolvedValue(
    Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "ignorar" },
              { text: JSON.stringify({ prioridades: ["conclusao"] }) },
            ],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 },
    })
  );
  vi.stubGlobal("fetch", fetchVertex);
  const result = await auditS2220EventFlow({ ...base, selectedProvider: "gpt" });
  expect(result).toMatchObject({
    modeloUtilizado: MODEL_MAP.gemini,
    fallbackAcionado: true,
    tentativas: 1,
  });
  const [url, options] = fetchVertex.mock.calls[0];
  expect(url).toBe(
    "https://aiplatform.us.rep.googleapis.com/v1/projects/nai-teste/locations/us/publishers/google/models/gemini-4-argon:generateContent"
  );
  const body = JSON.parse(options.body);
  expect(body.generationConfig.responseJsonSchema.properties).toHaveProperty("prioridades");
  expect(options.body).not.toContain(base.cpfTrabalhador);
  expect(options.body).not.toContain(base.medicoEmitente.nome);
});
