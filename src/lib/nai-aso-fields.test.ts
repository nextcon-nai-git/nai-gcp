import { describe, expect, it } from "vitest";
import { readAsoFields } from "./nai-aso-fields";

describe("campos administrativos do ASO", () => {
  function read(...texts: string[]) {
    return readAsoFields(texts.map((texto, i) => ({ numero: i + 1, texto })));
  }
  it("delimita nomes, linhas e colunas pela seção e pela página", () => {
    const result = read(
      "Funcionário\nNome:\nPessoa Exemplo\nCargo: Analista Resultado: Reservado\nMédico responsável\nNome: Outra Pessoa",
      "Nome: Terceira Pessoa\nSetor:",
      "Arquivo\nFunção: Assistente"
    );
    expect(result.fields).toEqual([
      { pagina: 1, trecho: "Nome: Pessoa Exemplo" },
      { pagina: 1, trecho: "Cargo: Analista" },
      { pagina: 3, trecho: "Função: Assistente" },
    ]);
  });
  it("não atribui ao trabalhador o nome do médico em outra coluna", () => {
    const result = read(
      "Funcionário\nNome: Pessoa Exemplo | Médico examinador | Nome: Profissional Exemplo"
    );
    expect(result.fields).toEqual([{ pagina: 1, trecho: "Nome: Pessoa Exemplo" }]);
  });
  it.each([
    "Tipo de exame:",
    "Admissional\nPeriódico",
    "[ ] Admissional",
    "(X) Admissional (X) Periódico",
    "Tipo de exame: marca ilegível",
  ])("pede conferência de opções ambíguas (%s)", (text) => {
    expect(read(text)).toMatchObject({ pending: true, fields: [] });
  });
  it("aceita uma marca inequívoca ou um valor explícito", () => {
    expect(read("Tipo de exame: [ ] Admissional [X] Periódico")).toMatchObject({
      pending: false,
      fields: [{ pagina: 1, trecho: "Tipo de exame: Periódico" }],
    });
    expect(read("Tipo de exame:\nAdmissional")).toMatchObject({
      pending: false,
      fields: [{ pagina: 1, trecho: "Tipo de exame: Admissional" }],
    });
  });
});
