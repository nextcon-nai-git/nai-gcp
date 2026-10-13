import { beforeEach, describe, it, expect, vi } from "vitest";
import { parseAsoTextWithHeuristics } from "../ai/flows/aso-heuristic-parser";
import { processDigitalAsoIngestion } from "../ai/flows/aso-full-ingestion-flow";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/auth/ai-action", () => ({
  requireAiAction: vi.fn(async () => ({})),
  CLINICAL_AI_ROLES: ["DOCTOR"],
}));
vi.mock("@/ai/genkit", () => ({
  ai: { generate: mocks.generate, defineFlow: (_config: unknown, handler: unknown) => handler },
}));
beforeEach(() => {
  mocks.generate.mockReset().mockRejectedValue(new Error("private provider details"));
});

const sample = `ATESTADO DE SAÚDE OCUPACIONAL - ASO
EMPRESA: EMPRESA SINTÉTICA LTDA
CNPJ: 43.776.491/0001-70
COLABORADOR: TRABALHADOR SINTÉTICO
CPF: 123.456.789-00
CARGO: OPERADOR DE CALDEIRA
SETOR: OPERAÇÃO INDUSTRIAL
DATA DE NASCIMENTO: 15/05/1988
TIPO DE ASO: PERIÓDICO
DATA DO EXAME: 10/09/2026
EXAMES COMPLEMENTARES:
- AUDIOMETRIA TONAL E VOCAL: NORMAL
- ESPIROMETRIA OCUPACIONAL: 08/09/2026
- HEMOGRAMA COMPLETO: ALTERADO
- GLICEMIA EM JEJUM
PARECER MÉDICO:
APTO PARA A FUNÇÃO
MÉDICO EXAMINADOR: DRA. PROFISSIONAL SINTÉTICA
CRM: 12345/SP`;

describe("Transcrição de ASO sem fabricação clínica", () => {
  it("preserva identidade e data explícitas sem deduzir validade anual", () => {
    const result = parseAsoTextWithHeuristics(sample);
    expect(result.empresaIdentificada).toBe("EMPRESA SINTÉTICA LTDA");
    expect(result.cnpjEmpresa).toBe("43.776.491/0001-70");
    expect(result.colaborador).toMatchObject({
      nome: "TRABALHADOR SINTÉTICO",
      cpf: "123.456.789-00",
      dataNascimento: "1988-05-15",
      cargoFuncao: "OPERADOR DE CALDEIRA",
      setorGhe: "OPERAÇÃO INDUSTRIAL",
    });
    expect(result.asoInfo).toMatchObject({
      tipoAso: "Periódico",
      dataEmissao: "2026-09-10",
      dataValidade: "",
      resultadoAso: "Apto",
      medicoExaminador: "DRA. PROFISSIONAL SINTÉTICA",
      crmMedico: "CRM: 12345/SP",
    });
    expect(result.acoesSaudeRecomendadas).toEqual([]);
    expect(result.scoreConfiabilidade).toBe(0);
  });

  it("mantém cada resultado e data de exame sem copiar a aptidão ou data geral", () => {
    const result = parseAsoTextWithHeuristics(sample);
    expect(result.examesRealizados).toHaveLength(4);
    expect(result.examesRealizados.map((exam) => exam.resultado)).toEqual([
      "Normal",
      "Não Informado",
      "Alterado",
      "Não Informado",
    ]);
    expect(result.examesRealizados.map((exam) => exam.dataExame)).toEqual([
      "",
      "2026-09-08",
      "",
      "",
    ]);
    expect(result.examesRealizados[2].detalheAlteracao).toBe("HEMOGRAMA COMPLETO: ALTERADO");
  });

  it("não preenche identidade, aptidão, exames, médico ou datas ausentes", () => {
    const result = parseAsoTextWithHeuristics(
      "ASO\nDocumento incompleto",
      "ASO_AVP_PESSOA_ADMISSIONAL.pdf"
    );
    expect(result.empresaIdentificada).toBe("");
    expect(result.colaborador.nome).toBe("");
    expect(result.asoInfo).toEqual({
      tipoAso: "Não Informado",
      resultadoAso: "Não Informado",
      dataEmissao: "",
      dataValidade: "",
      medicoExaminador: "",
      crmMedico: "",
      restricoesDetalhadas: "",
    });
    expect(result.examesRealizados).toEqual([]);
  });

  it.each([
    "data:application/pdf;base64,JVBERi0xLjQ=",
    "data:image/png;base64,aGVsbG8=",
    "Pedido de exames",
    "",
  ])("não interpreta binário, nome de arquivo ou outro documento como ASO (%s)", (source) => {
    expect(() => parseAsoTextWithHeuristics(source, "ASO_ADMISSIONAL_PESSOA.pdf")).toThrow(
      "Não foi possível ler"
    );
  });

  it.each(["[ ] APTO\n[ ] INAPTO", "APTO / INAPTO", "APTO\nINAPTO"])(
    "não confunde opções ou conclusões conflitantes com aptidão (%s)",
    (options) => {
      expect(parseAsoTextWithHeuristics(`ASO\n${options}`).asoInfo.resultadoAso).toBe(
        "Não Informado"
      );
    }
  );

  it("respeita opção marcada sem escolher a primeira opção do formulário", () => {
    const result = parseAsoTextWithHeuristics(
      "ASO\n[ ] APTO [x] INAPTO\n[ ] ADMISSIONAL [x] DEMISSIONAL"
    );
    expect(result.asoInfo.resultadoAso).toBe("Inapto");
    expect(result.asoInfo.tipoAso).toBe("Demissional");
  });

  it("não confunde nascimento com emissão e rejeita datas impossíveis", () => {
    const result = parseAsoTextWithHeuristics(
      "ASO\nDATA DE NASCIMENTO: 15/05/1988\nDATA DO EXAME: 31/02/2026\nVALIDADE: 2027-09-10"
    );
    expect(result.colaborador.dataNascimento).toBe("1988-05-15");
    expect(result.asoInfo.dataEmissao).toBe("");
    expect(result.asoInfo.dataValidade).toBe("2027-09-10");
  });

  it("preserva texto legível quando IA falha e informa revisão pendente", async () => {
    const result = await processDigitalAsoIngestion(sample);
    expect(result.colaborador.nome).toBe("TRABALHADOR SINTÉTICO");
    expect(result.asoInfo.resultadoAso).toBe("Apto");
    expect(result.scoreConfiabilidade).toBe(0);
    expect(result.resumoEpidemiologico).toContain("preliminar");
    expect(result.resumoEpidemiologico).not.toContain("private provider details");
  });

  it("IA indisponível em PDF não retorna falso sucesso ou trabalhador pelo filename", async () => {
    await expect(
      processDigitalAsoIngestion(
        "data:application/pdf;base64,JVBERi0xLjQ=",
        "ASO_ADMISSIONAL_PESSOA.pdf"
      )
    ).rejects.toThrow("Não foi possível ler");
  });

  it("não conclui ingestão sem identificação de trabalhador", async () => {
    await expect(processDigitalAsoIngestion("ASO\n[ ] APTO [ ] INAPTO")).rejects.toThrow(
      "identificação do trabalhador"
    );
  });

  it("resposta da IA com campos clínicos omitidos não ganha defaults de normalidade ou aptidão", async () => {
    mocks.generate.mockResolvedValueOnce({
      output: {
        colaborador: { nome: "TRABALHADOR SINTÉTICO" },
        asoInfo: {},
        examesRealizados: [{ nomeExame: "Audiometria" }],
      },
    });
    const result = await processDigitalAsoIngestion("data:image/png;base64,aGVsbG8=");
    expect(result.asoInfo.resultadoAso).toBe("Não Informado");
    expect(result.asoInfo.tipoAso).toBe("Não Informado");
    expect(result.asoInfo.dataValidade).toBe("");
    expect(result.examesRealizados[0].resultado).toBe("Não Informado");
    expect(result.examesRealizados[0].detalheAlteracao).toBe("");
  });
});
