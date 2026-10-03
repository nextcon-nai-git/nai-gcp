import { describe, it, expect, vi } from "vitest";
import { sayHello } from "./hello-flow";

// Mock do Genkit para evitar chamadas reais de API durante os testes
vi.mock("@/ai/genkit", () => ({
  ai: {
    defineFlow: vi.fn((_config, fn) => fn),
    generate: vi.fn(() => Promise.resolve({ text: "Olá Teste, eu sou a NAI da Nextcon." })),
  },
}));

describe("Fluxo sayHello", () => {
  it("deve retornar uma saudação da IA", async () => {
    const response = await sayHello("Teste");
    expect(response).toContain("Olá Teste");
    expect(response).toContain("NAI da Nextcon");
  });

  it("deve lidar com entradas de string vazia", async () => {
    const response = await sayHello("");
    expect(response).toBeDefined();
    expect(typeof response).toBe("string");
  });
});
