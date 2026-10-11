import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzePgrDocument } from "./pgr-document-analysis";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), readPages: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mocks.generate } }));
vi.mock("./pgr-pdf-text", () => ({ readPgrPdfPages: mocks.readPages }));
const text =
  "RAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70\nRECONHECIMENTO DE RISCOS AMBIENTAIS\nMANUTENÇÃO\nTrabalhador exposto a ruído contínuo de motores.";
beforeEach(() => {
  mocks.generate.mockReset();
  mocks.readPages.mockReset();
  vi.stubEnv("GOOGLE_GENAI_API_KEY", "test-key");
});
afterEach(() => vi.unstubAllEnvs());
describe("IA PGR com limites", () => {
  it("não aceita AVP retornado pela IA contra a identificação do PDF", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.pgrCardDetalhado.razaoSocial = "AVP";
    output.pgrCardDetalhado.cnpj = "44.337.647/0001-89";
    mocks.generate.mockResolvedValue({ output });
    const a = await analyzePgrDocument({ pdfDataUri: text, fileName: "PGR_AVP.pdf" });
    expect(a.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(a.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
  });
  it("descarta risco sem trecho existente na página citada", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.riscosIdentificados = [
      {
        id: "fake",
        agente: "Benzeno",
        categoria: "quimico",
        setorGhe: "laboratório",
        evidencia: { pagina: 1, trecho: "Exposição a benzeno 90 ppm" },
        controlesDocumentados: [],
        classificacaoOriginal: "",
      },
    ];
    mocks.generate.mockResolvedValue({ output });
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.riscosIdentificados.some((r) => r.agente === "Benzeno")).toBe(false);
  });
  it("falha da IA preserva cliente e marca somente extração documental", async () => {
    mocks.generate.mockRejectedValue(new Error("Unavailable"));
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(a.leitura.modo).toBe("extracao_documental");
    expect(a.leitura.avisos.join(" ")).toContain("não concluiu");
    expect(a.pgrCardDetalhado.dataEmissao).toBe("");
  });
  it("resultado inválido não cria conclusão técnica fictícia", async () => {
    mocks.generate.mockResolvedValue({ output: {} });
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.leitura.modo).toBe("extracao_documental");
    expect(a.parecerTecnicoIA).not.toContain("auditado com sucesso");
  });
  it("não transforma conceitos ou ausência de exposição em risco documentado", async () => {
    const source =
      "RAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70\nCONCEITOS DE RISCOS AMBIENTAIS\nExposição a ruído é um exemplo de perigo físico.";
    const output = parsePgrDocumentPages([{ numero: 1, texto: source }]);
    output.riscosIdentificados = [
      {
        id: "glossary",
        agente: "Ruído",
        categoria: "fisico",
        setorGhe: "",
        evidencia: { pagina: 1, trecho: "Exposição a ruído é um exemplo de perigo físico." },
        controlesDocumentados: [],
        classificacaoOriginal: "",
      },
    ];
    mocks.generate.mockResolvedValue({ output });
    expect((await analyzePgrDocument({ pdfDataUri: source })).riscosIdentificados).toHaveLength(0);
  });
  it("preserva evidência documental quando a IA omite riscos e recusa controles inventados", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.riscosIdentificados[0].controlesDocumentados = ["EPC certificado instalado"];
    output.riscosIdentificados[0].classificacaoOriginal = "Risco crítico validado";
    mocks.generate.mockResolvedValue({ output });
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.riscosIdentificados[0].controlesDocumentados).toEqual([]);
    expect(a.riscosIdentificados[0].classificacaoOriginal).toBe("");
    output.riscosIdentificados = [];
    mocks.generate.mockResolvedValue({ output });
    expect(
      (await analyzePgrDocument({ pdfDataUri: text })).riscosIdentificados.length
    ).toBeGreaterThan(0);
  });
});

describe("NAI importa: análise real do especialista e controle clínico", () => {
  it.each([
    ["PGR", "Engenheiro de Segurança", "engenheiro_seguranca", false],
    ["PCMSO", "Médico do Trabalho", "medico_trabalho", true],
    ["ASO", "Médico do Trabalho", "medico_trabalho", true],
    ["Laudo de Perícia Médica", "Médico do Trabalho", "medico_trabalho", true],
    ["AEP", "Ergonomista", "ergonomista", false],
    ["AET", "Ergonomista", "ergonomista", false],
  ] as const)(
    "envia %s ao prompt especialista antes de concluir a análise",
    async (title, name, role, allowClinical) => {
      const source = `${title}\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70`;
      const output = parsePgrDocumentPages([{ numero: 1, texto: source }]);
      output.parecerTecnicoIA =
        "Conferência documental do especialista; pendências para revisão profissional.";
      mocks.generate.mockResolvedValue({ output });
      const result = await analyzePgrDocument({
        pdfDataUri: source,
        fileName: "PGR_nome_enganoso.pdf",
        allowClinical,
      });
      expect(mocks.generate).toHaveBeenCalledTimes(1);
      expect(mocks.generate.mock.calls[0][0].prompt[0].text).toContain(
        `Você é o Agente IA ${name}`
      );
      expect(result.documento?.agenteResponsavel).toBe(role);
      expect(result.analiseAgente).toMatchObject({
        agente: role,
        status: "concluida",
        resumo: output.parecerTecnicoIA,
      });
    }
  );

  it.each(["PCMSO", "ASO", "Laudo de Perícia Médica"])(
    "bloqueia %s antes da IA e não retorna extração para perfil sem acesso",
    async (title) => {
      await expect(
        analyzePgrDocument({
          pdfDataUri: `${title}\nPaciente: PESSOA RESTRITA\nExame: dado privado`,
        })
      ).rejects.toMatchObject({ status: 403 });
      expect(mocks.generate).not.toHaveBeenCalled();
    }
  );

  it("não entrega anamnese anexada a um PGR ao agente engenheiro", async () => {
    const result = await analyzePgrDocument({
      pdfDataUri: "PGR\nPrograma de Gerenciamento de Riscos\fAnamnese: informações individuais.",
      allowClinical: true,
    });
    expect(result.documento?.acesso).toBe("clinico_restrito");
    expect(result.analiseAgente?.status).toBe("pendente");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("triagem visual exige autorização clínica antes da chamada médica", async () => {
    mocks.generate.mockResolvedValueOnce({
      output: {
        tipo: "ASO",
        statusClassificacao: "identificado",
        contemDadosClinicosIndividuais: true,
      },
    });
    await expect(
      analyzePgrDocument({ pdfDataUri: "data:image/png;base64,aGVsbG8=" })
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0][0].prompt[0].text).toContain(
      "somente a triagem documental"
    );
  });

  it("visual autorizado faz triagem e depois análise médica, sem inventar leitura textual", async () => {
    const output = parsePgrDocumentPages([
      { numero: 1, texto: "ASO\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70" },
    ]);
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "ASO",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: true,
        },
      })
      .mockResolvedValueOnce({ output });
    const result = await analyzePgrDocument({
      pdfDataUri: "data:image/png;base64,aGVsbG8=",
      allowClinical: true,
    });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[1][0].prompt[0].text).toContain(
      "Você é o Agente IA Médico do Trabalho"
    );
    expect(result.leitura.modo).toBe("leitura_visual_ia");
    expect(result.analiseAgente?.status).toBe("concluida");
  });

  it("não chama especialista quando o conteúdo não permite classificação", async () => {
    const result = await analyzePgrDocument({
      pdfDataUri: "Documento de compra de equipamentos",
      fileName: "PCMSO.pdf",
    });
    expect(result.documento?.tipo).toBe("OUTRO");
    expect(result.analiseAgente?.status).toBe("pendente");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("preserva ação específica com evidência e descarta ação documental inventada", async () => {
    const source =
      "AET\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70\nAção documentada: ajustar a altura da bancada de trabalho.";
    const output = parsePgrDocumentPages([{ numero: 1, texto: source }]);
    const action = {
      ...output.acoesCategorizadas[0],
      id: "documented",
      titulo: "Ajustar altura da bancada",
      agenteSugerido: "ergonomista" as const,
      fundamento: "documento" as const,
      evidencia: {
        pagina: 1,
        trecho: "Ação documentada: ajustar a altura da bancada de trabalho.",
      },
    };
    output.acoesCategorizadas = [
      action,
      {
        ...action,
        id: "fake",
        titulo: "Comprar equipamento não descrito",
        evidencia: { pagina: 1, trecho: "Comprar equipamento importado no próximo mês." },
      },
    ];
    mocks.generate.mockResolvedValue({ output });
    const result = await analyzePgrDocument({ pdfDataUri: source });
    expect(result.acoesCategorizadas.some((item) => item.titulo === action.titulo)).toBe(true);
    expect(
      result.acoesCategorizadas.some((item) => item.titulo === "Comprar equipamento não descrito")
    ).toBe(false);
    expect(result.acoesCategorizadas.every((item) => !item.id.startsWith("agent_"))).toBe(true);
  });

  it("falha do especialista deixa rascunho indisponível sem concluir análise", async () => {
    mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
    const result = await analyzePgrDocument({
      pdfDataUri: "AET\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70",
    });
    expect(result.analiseAgente).toMatchObject({ agente: "ergonomista", status: "indisponivel" });
    expect(result.leitura.modo).toBe("extracao_documental");
  });
  it("não marca como concluída uma resposta estruturada com síntese vazia", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: "AET" }]);
    output.parecerTecnicoIA = "";
    mocks.generate.mockResolvedValue({ output });
    const result = await analyzePgrDocument({ pdfDataUri: "AET\nAnálise Ergonômica do Trabalho" });
    expect(result.analiseAgente?.status).toBe("indisponivel");
    expect(result.leitura.modo).toBe("extracao_documental");
  });
  it("triagem de PDF misto detecta anexo clínico antes do agente técnico", async () => {
    mocks.readPages.mockResolvedValue([
      {
        numero: 1,
        texto:
          "PGR\nPrograma de Gerenciamento de Riscos\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70",
      },
      { numero: 2, texto: "" },
    ]);
    mocks.generate.mockResolvedValueOnce({
      output: {
        tipo: "PGR",
        statusClassificacao: "identificado",
        contemDadosClinicosIndividuais: true,
      },
    });
    await expect(
      analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" })
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("falha da triagem de anexo escaneado não envia PDF ao especialista pelo título da capa", async () => {
    mocks.readPages.mockResolvedValue([
      {
        numero: 1,
        texto:
          "PGR\nPrograma de Gerenciamento de Riscos\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70",
      },
      { numero: 2, texto: "" },
    ]);
    mocks.generate.mockRejectedValueOnce(new Error("Triage unavailable"));
    const result = await analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" });
    expect(result.analiseAgente?.status).toBe("indisponivel");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("não permite à triagem visual rebaixar acesso clínico reconhecido no texto", async () => {
    mocks.readPages.mockResolvedValue([
      {
        numero: 1,
        texto:
          "PCMSO\nPrograma de Controle Médico de Saúde Ocupacional\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70",
      },
      { numero: 2, texto: "" },
    ]);
    mocks.generate.mockResolvedValueOnce({
      output: {
        tipo: "PGR",
        statusClassificacao: "identificado",
        contemDadosClinicosIndividuais: false,
      },
    });
    await expect(
      analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" })
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("mantém empregador textual confiável quando a leitura visual tenta substituir pelo emissor", async () => {
    const pages = [
      {
        numero: 1,
        texto:
          "PGR\nPrograma de Gerenciamento de Riscos\nRAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70",
      },
      { numero: 2, texto: "" },
    ];
    mocks.readPages.mockResolvedValue(pages);
    const output = parsePgrDocumentPages(pages);
    output.pgrCardDetalhado.razaoSocial = "CLÍNICA EMISSORA";
    output.pgrCardDetalhado.cnpj = "44.337.647/0001-89";
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
        },
      })
      .mockResolvedValueOnce({ output });
    const result = await analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" });
    expect(result.analiseAgente?.status).toBe("concluida");
    expect(result.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(result.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
  });
});
