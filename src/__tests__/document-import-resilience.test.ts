import { describe, it, expect } from "vitest";
import { analyzePgrPdf } from "@/ai/flows/pgr-analysis-flow";
import { analyzePcmsoPdf } from "@/ai/flows/pcmso-analysis-flow";
import { analyzeLtcatPdf } from "@/ai/flows/ltcat-analysis-flow";
import { extractDocumentAutofillData } from "@/ai/flows/document-ocr-autofill-flow";
import { extractMedicalCertificate } from "@/ai/flows/extract-medical-certificate-flow";
import { classifyDocument } from "@/ai/flows/document-classifier-flow";

describe("Suíte de Resiliência: Importação de PGR e Documentos Regulatórios NAI", () => {
  it("1. Deve auditar PGR via motor regulatório com extração de GHEs, CNAE e Ações NR-12/NR-35", async () => {
    const pgrInput = {
      pdfDataUri:
        "PROGRAMA DE GERENCIAMENTO DE RISCOS - PGR. NR-01. RAZÃO SOCIAL: GRUPO AVP ENGENHARIA LTDA. CNPJ: 05.474.924/0001-92. CNAE: 41.20-4-00 Construção de Edifícios. Grau de Risco: 3. Setor Operacional exposto a ruído de 87 dB(A) e trabalho em altura.",
      fileName: "PGR_2025_GRUPO_AVP.pdf",
    };

    const result = await analyzePgrPdf(pgrInput);

    expect(result).toBeDefined();
    expect(result.pgrCardDetalhado).toBeDefined();
    expect(result.pgrCardDetalhado.razaoSocial).toContain("AVP");
    expect(result.pgrCardDetalhado.cnpj).toBe("05.474.924/0001-92");
    expect(result.pgrCardDetalhado.grauDeRisco).toBe(3);
    expect(result.pgrCardDetalhado.ghesIdentificados.length).toBeGreaterThanOrEqual(1);
    expect(result.acoesCategorizadas.length).toBeGreaterThanOrEqual(1);
    expect(result.actionPlanTriggers.length).toBeGreaterThanOrEqual(1);
    expect(result.parecerTecnicoIA).toBeDefined();
  });

  it("2. Deve processar PCMSO mesmo com API offline, extraindo cronograma de exames NR-07 e vigência", async () => {
    const pcmsoInput = {
      pdfDataUri:
        "PROGRAMA DE CONTROLE MÉDICO DE SAÚDE OCUPACIONAL - PCMSO NR-07. EMPRESA: DW MONTEC MONTAGENS INDUSTRIAIS LTDA.",
      fileName: "PCMSO_DW_MONTEC_2025.pdf",
    };

    const result = await analyzePcmsoPdf(pcmsoInput);

    expect(result).toBeDefined();
    expect(result.companyInfo.name).toContain("MONTEC");
    expect(result.companyInfo.responsibleDoctor).toContain("CRM");
    expect(result.examProtocol.length).toBeGreaterThanOrEqual(3);
    expect(result.medicalGuidelines.length).toBeGreaterThanOrEqual(2);
    expect(result.aiInsight).toContain("PCMSO");
  });

  it("3. Deve processar LTCAT com enquadramento de agentes nocivos e aposentadoria especial (Decreto 3.048/99)", async () => {
    const ltcatInput = {
      pdfDataUri:
        "LAUDO TÉCNICO DAS CONDIÇÕES AMBIENTAIS DE TRABALHO - LTCAT. CETESB. Avaliação de Ruído: 88 dB(A).",
      fileName: "LTCAT_CETESB_2025.pdf",
    };

    const result = await analyzeLtcatPdf(ltcatInput);

    expect(result).toBeDefined();
    expect(result.companyInfo.name).toContain("CETESB");
    expect(result.hazards.length).toBeGreaterThanOrEqual(2);
    const noiseHazard = result.hazards.find((h) => h.agent.includes("Ruído"));
    expect(noiseHazard).toBeDefined();
    expect(noiseHazard?.specialRetirement).toBe(true);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  it("4. Deve extrair dados de CNH e Contrato para pré-cadastro automático via motor heurístico", async () => {
    const cnhText = `
      REPÚBLICA FEDERATIVA DO BRASIL - CARTEIRA NACIONAL DE HABILITAÇÃO
      NOME: CARLOS EDUARDO DA SILVA
      DOC IDENTIDADE: 45.890.123-4 SSP/SP
      CPF: 345.678.901-23
      DATA NASCIMENTO: 12/04/1988
      CATEGORIA: AB
      VALIDADE: 15/10/2028
    `;

    const result = await extractDocumentAutofillData(cnhText, "CNH");

    expect(result).toBeDefined();
    expect(result.nomeCompleto).toContain("CARLOS EDUARDO");
    expect(result.cpfCnpj).toBe("345.678.901-23");
    expect(result.categoriaCnh).toBe("AB");
    expect(result.scoreConfiabilidade).toBeGreaterThanOrEqual(90);
  });

  it("5. Deve extrair dados clínicos de atestados médicos para evento S-2230 do eSocial sem falhas", async () => {
    const atestadoText = `
      ATESTADO MÉDICO OCUPACIONAL
      Atesto que o paciente ROBERTO SOUZA SANTOS esteve sob cuidados médicos
      e necessita de 5 dias de repouso por motivo de doença.
      CID: M54.5 - Dorsalgia lombar.
      Data: 10/05/2025
    `;

    const result = await extractMedicalCertificate(atestadoText);

    expect(result).toBeDefined();
    expect(result.nomePaciente).toContain("ROBERTO SOUZA SANTOS");
    expect(result.cid).toBe("M54.5");
    expect(result.diasAfastamento).toBe(5);
    expect(result.dataAtestado).toBe("2025-05-10");
  });

  it("6. Deve classificar documentos instantaneamente pela triagem heurística", async () => {
    const docInput = {
      pdfDataUri: "dGVzdGU=",
      fileName: "PGR_BRITANIA_ELETRODOMESTICOS_2025.pdf",
    };

    const result = await classifyDocument(docInput);

    expect(result).toBeDefined();
    expect(result.docType).toBe("pgr");
    expect(result.companyName).toContain("BRITANIA");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });
});
