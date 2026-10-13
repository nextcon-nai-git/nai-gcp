import { beforeEach, expect, it, vi } from "vitest";
import { extractDocumentAutofillData } from "./document-ocr-autofill-flow";
const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/auth/ai-action", () => ({
  requireAiAction: vi.fn(async () => ({})),
  DOCUMENT_AI_ROLES: ["ENGINEER"],
}));
vi.mock("@/ai/genkit", () => ({
  ai: { generate: mock.generate, defineFlow: (_config: unknown, handler: unknown) => handler },
}));
beforeEach(() => {
  mock.generate.mockReset().mockRejectedValue(new Error("private provider details"));
});

it("OCR sem campos não converte título em pessoa nem preenche dados pessoais fictícios", async () => {
  const result = await extractDocumentAutofillData(
    "CARTEIRA NACIONAL DE HABILITAÇÃO\nREPÚBLICA FEDERATIVA DO BRASIL",
    "CNH"
  );
  expect(result).toMatchObject({
    nomeCompleto: "",
    cpfCnpj: "",
    categoriaCnh: "",
    dataNascimentoOuEmissao: "",
    dataValidade: "",
    cargoOuServico: "",
    cidade: "",
    uf: "",
    enderecoCompleto: "",
    scoreConfiabilidade: 0,
    valorContrato: null,
  });
});

it("mantém campos explícitos separados e não usa uma data de nascimento como validade", async () => {
  const result = await extractDocumentAutofillData(
    "CNH\n  NOME: PESSOA SINTÉTICA\n  CPF: 529.982.247-25\n  DATA NASCIMENTO: 15/05/1988",
    "CNH"
  );
  expect(result).toMatchObject({
    nomeCompleto: "PESSOA SINTÉTICA",
    cpfCnpj: "529.982.247-25",
    dataNascimentoOuEmissao: "1988-05-15",
    dataValidade: "",
    categoriaCnh: "",
  });
});

it("recusa identificação ambígua sem associar o titular ao primeiro nome", async () => {
  const result = await extractDocumentAutofillData(
    "CNH\nNOME: PRIMEIRA PESSOA\nNOME: SEGUNDA PESSOA",
    "CNH"
  );
  expect(result.nomeCompleto).toBe("");
});

it.each([
  "ASO\nPaciente: Pessoa sintética\nResultado: APTO",
  "Ficha clínica\nPaciente: Pessoa sintética\nCID: M54.5",
])("encaminha conteúdo clínico ao fluxo restrito antes de ler na IA", async (source) => {
  await expect(extractDocumentAutofillData(source, "CNH")).rejects.toThrow(
    "acesso clínico restrito"
  );
  expect(mock.generate).not.toHaveBeenCalled();
});

it("não finge OCR de binário fornecido como texto", async () => {
  await expect(
    extractDocumentAutofillData("data:image/png;base64,aGVsbG8=", "CNH")
  ).rejects.toThrow("texto legível");
  expect(mock.generate).not.toHaveBeenCalled();
});
