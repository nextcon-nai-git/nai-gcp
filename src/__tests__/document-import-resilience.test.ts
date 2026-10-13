import { describe, it, expect, vi } from "vitest";
import { analyzePgrDocument as analyzePgrPdf } from "@/services/pgr-document-analysis";
vi.mock("server-only", () => ({}));
vi.mock("@/ai/genkit", () => ({
  ai: {
    generate: vi.fn(async () => {
      throw new Error("Provider unavailable in resilience test");
    }),
    definePrompt: () => async () => {
      throw new Error("Provider unavailable in resilience test");
    },
    defineFlow: (_config: unknown, handler: unknown) => handler,
  },
}));
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
    // The excerpt has no explicit GHE identifier; do not invent a group.
    expect(result.pgrCardDetalhado.ghesIdentificados).toEqual([]);
    expect(result.acoesCategorizadas.length).toBeGreaterThanOrEqual(1);
    expect(result.riscosIdentificados.length).toBeGreaterThanOrEqual(1);
    expect(result.riscosIdentificados[0].evidencia.trecho).toContain("ruído");
    expect(result.parecerTecnicoIA).toBeDefined();
  });

  it("2. PCMSO indisponível não inventa protocolo, vigência ou médico responsável", async () => {
    const pcmsoInput = {
      pdfDataUri:
        "PROGRAMA DE CONTROLE MÉDICO DE SAÚDE OCUPACIONAL - PCMSO NR-07. EMPRESA: DW MONTEC MONTAGENS INDUSTRIAIS LTDA.",
      fileName: "PCMSO_DW_MONTEC_2025.pdf",
    };

    await expect(analyzePcmsoPdf(pcmsoInput)).rejects.toThrow("nenhum protocolo médico");
  });

  it("3. LTCAT indisponível não inventa medição ou enquadramento previdenciário", async () => {
    const ltcatInput = {
      pdfDataUri:
        "LAUDO TÉCNICO DAS CONDIÇÕES AMBIENTAIS DE TRABALHO - LTCAT. CETESB. Avaliação de Ruído: 88 dB(A).",
      fileName: "LTCAT_CETESB_2025.pdf",
    };

    await expect(analyzeLtcatPdf(ltcatInput)).rejects.toThrow("nenhuma medição");
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
    expect(result.scoreConfiabilidade).toBe(0);
    expect(result.dataNascimentoOuEmissao).toBe("1988-04-12");
    expect(result.dataValidade).toBe("2028-10-15");
    expect(result.cidade).toBe("");
    expect(result.cargoOuServico).toBe("");
  });

  it("5. Atestado indisponível não presume data ou dias de afastamento", async () => {
    const atestadoText = `
      ATESTADO MÉDICO OCUPACIONAL
      Atesto que o paciente ROBERTO SOUZA SANTOS esteve sob cuidados médicos
      e necessita de 5 dias de repouso por motivo de doença.
      CID: M54.5 - Dorsalgia lombar.
      Data: 10/05/2025
    `;

    await expect(extractMedicalCertificate(atestadoText)).rejects.toThrow("não foram presumidos");
  });

  it("6. não classifica nem identifica uma empresa apenas pelo nome do arquivo", async () => {
    const docInput = {
      pdfDataUri: "dGVzdGU=",
      fileName: "PGR_BRITANIA_ELETRODOMESTICOS_2025.pdf",
    };

    await expect(classifyDocument(docInput)).rejects.toThrow("não foram presumidos");
  });
});

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(async () => ({
    uid: "test",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
    permissions: [],
  })),
}));
