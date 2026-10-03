import { describe, it, expect } from "vitest";

describe("Ambiente de Testes", () => {
  it("deve passar em um teste de sanidade básico", () => {
    expect(1 + 1).toBe(2);
  });

  it("deve ter acesso a variáveis globais do Vitest", () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});
