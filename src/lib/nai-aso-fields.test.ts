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
  it("aceita rótulos isolados e nunca usa o rótulo seguinte como valor", () => {
    expect(
      read("Funcionário\nNome\nPessoa Exemplo\nCargo:\nSetor\nArquivo\nFunção:\nData do exame")
        .fields
    ).toEqual([
      { pagina: 1, trecho: "Nome: Pessoa Exemplo" },
      { pagina: 1, trecho: "Setor: Arquivo" },
    ]);
  });
  it("preserva a profissão médica do trabalhador e o setor seguinte", () => {
    expect(
      read("Funcionário\nNome: Pessoa Exemplo Cargo: Médico do Trabalho\nSetor: Saúde").fields
    ).toEqual([
      { pagina: 1, trecho: "Nome: Pessoa Exemplo" },
      { pagina: 1, trecho: "Cargo: Médico do Trabalho" },
      { pagina: 1, trecho: "Setor: Saúde" },
    ]);
    expect(read("Função: Médica da Família Resultado: Reservado").fields).toEqual([
      { pagina: 1, trecho: "Função: Médica da Família" },
    ]);
  });
  it("mantém o cabeçalho do examinador separado do cargo vazio", () => {
    for (const row of [
      "Cargo: | Médico do Trabalho | Nome: Profissional Exemplo",
      "Cargo: Médico do Trabalho: Profissional Exemplo",
    ]) {
      expect(read("Funcionário\n" + row + "\nNome: Outro Profissional").fields).toEqual([]);
    }
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
