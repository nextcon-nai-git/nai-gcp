// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  genkit: vi.fn(),
  vertex: vi.fn(),
  model: vi.fn(),
  google: { generate: vi.fn() },
  cloud: { generate: vi.fn() },
}));
vi.mock("genkit", () => ({ genkit: mock.genkit }));
vi.mock("@genkit-ai/google-genai", () => ({
  vertexAI: Object.assign(mock.vertex, { model: mock.model }),
}));
vi.mock("@/ai/genkit", () => ({ ai: mock.google }));
import { getPgrAi } from "./pgr-ai-provider";
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of [
    "PGR_AI_PROVIDER",
    "GOOGLE_GENAI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "K_SERVICE",
  ])
    vi.stubEnv(key, "");
  mock.genkit.mockReturnValue(mock.cloud);
});
afterEach(() => vi.unstubAllEnvs());
describe("IA do PGR no servidor", () => {
  it("retorna indisponível localmente sem credencial, em vez de simular IA", () => {
    expect(getPgrAi()).toBeNull();
    expect(mock.genkit).not.toHaveBeenCalled();
  });
  it("reutiliza o provedor configurado por chave no servidor", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    expect(getPgrAi()).toBe(mock.google);
    expect(mock.vertex).not.toHaveBeenCalled();
  });
  it("usa a identidade de execução do App Hosting para Vertex sem arquivo de chave", () => {
    vi.stubEnv("K_SERVICE", "nai");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "demo-nai-security");
    expect(getPgrAi()).toBe(mock.cloud);
    expect(mock.vertex).toHaveBeenCalledWith({
      projectId: "demo-nai-security",
      location: "global",
    });
    expect(mock.model).toHaveBeenCalledWith("gemini-3.8-flash");
  });
  it("permite desativar a geração sem perder a extração documental", () => {
    vi.stubEnv("PGR_AI_PROVIDER", "disabled");
    vi.stubEnv("K_SERVICE", "nai");
    expect(getPgrAi()).toBeNull();
  });
});
