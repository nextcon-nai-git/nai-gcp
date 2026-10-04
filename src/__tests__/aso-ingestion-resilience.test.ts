import { describe, it, expect } from "vitest";
import { parseAsoTextWithHeuristics } from "../ai/flows/aso-heuristic-parser";
import { processDigitalAsoIngestion } from "../ai/flows/aso-full-ingestion-flow";

describe("Motor de Ingestão de ASO Ocupacional (NR-07 & IA)", () => {
  const sampleAsoText = `
    COMPROVANTE DE REALIZAÇÃO DE EXAME MÉDICO OCUPACIONAL
    ATESTADO DE SAÚDE OCUPACIONAL - ASO
    
    EMPRESA: GRUPO AVP ENGENHARIA LTDA
    CNPJ: 12.345.678/0001-90
    
    COLABORADOR: CARLOS EDUARDO DA SILVA
    CPF: 123.456.789-00
    CARGO: OPERADOR DE CALDEIRA
    SETOR: OPERAÇÃO INDUSTRIAL
    DATA DE NASCIMENTO: 15/05/1988
    
    TIPO DE ASO: PERIÓDICO
    DATA DO EXAME: 10/09/2026
    
    EXAMES COMPLEMENTARES:
    - AUDIOMETRIA TONAL E VOCAL: NORMAL
    - ESPIROMETRIA OCUPACIONAL: NORMAL
    - HEMOGRAMA COMPLETO: NORMAL
    - GLICEMIA EM JEJUM: NORMAL
    
    PARECER MÉDICO:
    APTO PARA A FUNÇÃO
    MÉDICO EXAMINADOR: DR. ROBERTO DE ALMEIDA
    CRM: 12345/SP
  `;

  it("deve extrair com precisão os dados cadastrais da empresa e do colaborador", () => {
    const res = parseAsoTextWithHeuristics(sampleAsoText);

    expect(res.empresaIdentificada).toContain("GRUPO AVP ENGENHARIA");
    expect(res.cnpjEmpresa).toBe("12.345.678/0001-90");
    expect(res.colaborador.nome).toBe("CARLOS EDUARDO DA SILVA");
    expect(res.colaborador.cpf).toBe("123.456.789-00");
    expect(res.colaborador.cargoFuncao).toBe("OPERADOR DE CALDEIRA");
    expect(res.colaborador.setorGhe).toBe("OPERAÇÃO INDUSTRIAL");
    expect(res.colaborador.dataNascimento).toBe("1988-05-15");
  });

  it("deve identificar o tipo de ASO, data de emissão, validade e aptidão", () => {
    const res = parseAsoTextWithHeuristics(sampleAsoText);

    expect(res.asoInfo.tipoAso).toBe("Periódico");
    expect(res.asoInfo.dataEmissao).toBe("2026-09-10");
    expect(res.asoInfo.dataValidade).toBe("2027-09-10");
    expect(res.asoInfo.resultadoAso).toBe("Apto");
    expect(res.asoInfo.crmMedico).toBe("CRM: 12345/SP");
  });

  it("deve catalogar todos os exames complementares obrigatórios NR-07", () => {
    const res = parseAsoTextWithHeuristics(sampleAsoText);

    expect(res.examesRealizados.length).toBeGreaterThanOrEqual(4);
    const nomesExames = res.examesRealizados.map((e) => e.nomeExame);
    expect(nomesExames).toContain("Audiometria Tonal & Vocal");
    expect(nomesExames).toContain("Espirometria Ocupacional");
    expect(nomesExames).toContain("Hemograma Completo");
    expect(nomesExames).toContain("Glicemia em Jejum");
  });

  it("deve gerar planos e ações de saúde ocupacional preditivas (PCA, PPR, Ergonomia)", () => {
    const res = parseAsoTextWithHeuristics(sampleAsoText);

    expect(res.acoesSaudeRecomendadas.length).toBeGreaterThan(0);
    const joinedAcoes = res.acoesSaudeRecomendadas.join(" ");
    expect(joinedAcoes).toContain("PCA");
    expect(joinedAcoes).toContain("PPR");
    expect(joinedAcoes).toContain("Ginástica Laboral");
  });

  it("deve inferir dados a partir do nome do arquivo em PDFs digitalizados como imagem", () => {
    const emptyPdfText = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...";
    const fileName = "ASO_ADMISSIONAL_MARCOS_VINICIUS_OLIVEIRA.pdf";

    const res = parseAsoTextWithHeuristics(emptyPdfText, fileName);

    expect(res.colaborador.nome).toContain("MARCOS VINICIUS OLIVEIRA");
    expect(res.asoInfo.tipoAso).toBe("Admissional");
    expect(res.asoInfo.resultadoAso).toBe("Apto");
  });

  it("processDigitalAsoIngestion nunca deve estourar exceção mesmo com API offline", async () => {
    // Executa a função principal do fluxo com o fallback ativo
    const res = await processDigitalAsoIngestion(sampleAsoText);

    expect(res).toBeDefined();
    expect(res.colaborador.nome).toBe("CARLOS EDUARDO DA SILVA");
    expect(res.asoInfo.resultadoAso).toBe("Apto");
    expect(res.scoreConfiabilidade).toBeGreaterThanOrEqual(90);
  });
});
