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
  it.each(["identificado", "nao_identificado"] as const)(
    "preserva ambiguidade textual quando a triagem retorna %s",
    async (statusClassificacao) => {
      mocks.readPages.mockResolvedValue([
        {
          numero: 1,
          texto: "PROGRAMA DE GERENCIAMENTO DE RISCOS\nANÁLISE ERGONÔMICA\nDO TRABALHO",
        },
      ]);
      mocks.generate.mockResolvedValue({
        output: {
          tipo: statusClassificacao === "identificado" ? "PGR" : "OUTRO",
          statusClassificacao,
          contemDadosClinicosIndividuais: false,
          evidencias: [{ pagina: 1, trecho: "PROGRAMA DE GERENCIAMENTO DE RISCOS" }],
        },
      });
      const result = await analyzePgrDocument({
        pdfDataUri: "data:application/pdf;base64,aGVsbG8=",
      });
      expect(result.documento).toMatchObject({
        tipo: "OUTRO",
        statusClassificacao: "ambiguo",
        agenteResponsavel: null,
      });
      expect(result.documento?.evidencias).toHaveLength(2);
      expect(result.analiseAgente?.status).toBe("pendente");
      expect(mocks.generate).toHaveBeenCalledTimes(1);
    }
  );

  it("não bloqueia PGR por menção clínica em frase quebrada entre linhas", async () => {
    const source =
      "PROGRAMA DE GERENCIAMENTO DE RISCOS\nO Programa de Controle Médico de Saúde\nOcupacional (PCMSO) deve estar articulado ao PGR\n" +
      text;
    mocks.readPages.mockResolvedValue([{ numero: 1, texto: source }]);
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
        },
      })
      .mockResolvedValueOnce({ output: parsePgrDocumentPages([{ numero: 1, texto: source }]) });
    const result = await analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" });
    expect(result.documento).toMatchObject({ tipo: "PGR", acesso: "sst" });
    expect(result.analiseAgente?.status).toBe("concluida");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "preserva acesso clínico em documento misto (autorizado: %s)",
    async (allowClinical) => {
      mocks.readPages.mockResolvedValue([
        {
          numero: 1,
          texto: "PROGRAMA DE GERENCIAMENTO DE RISCOS\nATESTADO DE SAÚDE\nOCUPACIONAL",
        },
      ]);
      mocks.generate.mockResolvedValue({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
          evidencias: [{ pagina: 1, trecho: "PROGRAMA DE GERENCIAMENTO DE RISCOS" }],
        },
      });
      const pending = analyzePgrDocument({
        pdfDataUri: "data:application/pdf;base64,aGVsbG8=",
        allowClinical,
      });
      if (allowClinical) {
        const result = await pending;
        expect(result.documento).toMatchObject({
          tipo: "OUTRO",
          statusClassificacao: "ambiguo",
          acesso: "clinico_restrito",
          agenteResponsavel: null,
        });
        expect(result.analiseAgente?.status).toBe("pendente");
      } else {
        await expect(pending).rejects.toMatchObject({ status: 403 });
      }
      expect(mocks.generate).toHaveBeenCalledTimes(1);
    }
  );

  it("envia texto com páginas físicas junto ao PDF e repete triagem inconclusiva", async () => {
    const source = "PROGRAMA DE\nGERENCIAMENTO DE\nRISCOS\n" + text;
    mocks.readPages.mockResolvedValue([{ numero: 1, texto: source }]);
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "OUTRO",
          statusClassificacao: "nao_identificado",
          contemDadosClinicosIndividuais: false,
        },
      })
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
          evidencias: [{ pagina: 1, trecho: "PROGRAMA DE GERENCIAMENTO DE RISCOS" }],
        },
      })
      .mockResolvedValueOnce({ output: parsePgrDocumentPages([{ numero: 1, texto: source }]) });
    const result = await analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" });
    const prompt = mocks.generate.mock.calls[0][0].prompt;
    expect(prompt).toContainEqual({ media: { url: "data:application/pdf;base64,aGVsbG8=" } });
    expect(
      prompt.some((part: { text?: string }) => part.text?.includes(`[PÁGINA PDF 1]\n${source}`))
    ).toBe(true);
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(result.documento?.tipo).toBe("PGR");
    expect(result.analiseAgente?.status).toBe("concluida");
  });

  it("não rebaixa acesso clínico encontrado na primeira triagem inconclusiva", async () => {
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "OUTRO",
          statusClassificacao: "nao_identificado",
          contemDadosClinicosIndividuais: true,
        },
      })
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
        },
      });
    await expect(
      analyzePgrDocument({ pdfDataUri: "data:image/png;base64,aGVsbG8=" })
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("não resolve documento misto por repetição nem chama especialista", async () => {
    mocks.readPages.mockResolvedValue([
      { numero: 1, texto: "PGR\nPrograma de Gerenciamento de Riscos" },
    ]);
    mocks.generate.mockResolvedValueOnce({
      output: {
        tipo: "OUTRO",
        statusClassificacao: "ambiguo",
        contemDadosClinicosIndividuais: false,
      },
    });
    const result = await analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" });
    expect(result.documento?.statusClassificacao).toBe("ambiguo");
    expect(result.analiseAgente?.status).toBe("pendente");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("preserva agentes distintos da mesma categoria e GHE quando a IA omite um deles", async () => {
    const source =
      "PGR\nRazão Social: EMPRESA SINTÉTICA\nCNPJ: 43.776.491/0001-70\nGHE: 01 - Produção\nTrabalhadores expostos a ruído e calor no processo industrial.";
    const output = parsePgrDocumentPages([{ numero: 1, texto: source }]);
    expect(output.riscosIdentificados.map((risk) => risk.agente)).toEqual(["Ruído", "Calor"]);
    output.riscosIdentificados = output.riscosIdentificados.filter(
      (risk) => risk.agente === "Ruído"
    );
    output.acoesCategorizadas = [];
    mocks.generate.mockResolvedValue({ output });

    const result = await analyzePgrDocument({ pdfDataUri: source });

    expect(result.riscosIdentificados.map((risk) => risk.agente)).toEqual(["Ruído", "Calor"]);
    expect(result.pgrCardDetalhado.totalRiscosMapeados).toBe(2);
    const heat = result.riscosIdentificados.find((risk) => risk.agente === "Calor")!;
    expect(
      result.acoesCategorizadas.some((action) => action.riscosRelacionados.includes(heat.id))
    ).toBe(true);
  });
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
  it("não aceita espaços em branco como evidência documental", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.riscosIdentificados = [
      {
        ...output.riscosIdentificados[0],
        id: "fake",
        agente: "Benzeno",
        categoria: "quimico",
        evidencia: { pagina: 1, trecho: "   " },
      },
    ];
    mocks.generate.mockResolvedValueOnce({ output });
    const result = await analyzePgrDocument({ pdfDataUri: text });
    expect(result.riscosIdentificados.some((risk) => risk.agente === "Benzeno")).toBe(false);
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
  it("anexo escaneado não autoriza riscos e ações com citações falsas em páginas textuais ou inexistentes", async () => {
    const pages = [
      { numero: 1, texto: text },
      { numero: 2, texto: "" },
    ];
    mocks.readPages.mockResolvedValue(pages);
    const output = parsePgrDocumentPages(pages);
    const fakeRisk = {
      ...output.riscosIdentificados[0],
      agente: "Benzeno",
      categoria: "quimico" as const,
      evidencia: { pagina: 1, trecho: "Exposição a benzeno não presente nesta página." },
    };
    output.riscosIdentificados = [
      fakeRisk,
      {
        ...fakeRisk,
        id: "missing-page",
        evidencia: { pagina: 3, trecho: "Trecho em página inexistente" },
      },
    ];
    output.acoesCategorizadas = [
      {
        ...output.acoesCategorizadas[0],
        id: "fake-action",
        fundamento: "documento",
        titulo: "Ação com evidência falsa",
        evidencia: { pagina: 1, trecho: "Trocar todos os equipamentos amanhã." },
      },
    ];
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
    expect(result.riscosIdentificados.some((risk) => risk.agente === "Benzeno")).toBe(false);
    expect(
      result.acoesCategorizadas.some((action) => action.titulo === "Ação com evidência falsa")
    ).toBe(false);
    expect(result.riscosIdentificados.some((risk) => risk.agente === "Ruído")).toBe(true);
  });
  it("envia também o PDF textual original para a IA conferir tabelas e colunas", async () => {
    mocks.readPages.mockResolvedValue([{ numero: 1, texto: text }]);
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
        },
      })
      .mockResolvedValueOnce({
        output: parsePgrDocumentPages([{ numero: 1, texto: text }]),
      });
    const pdfDataUri = "data:application/pdf;base64,aGVsbG8=";
    const result = await analyzePgrDocument({ pdfDataUri });
    expect(mocks.generate.mock.calls[1][0].prompt).toContainEqual({ media: { url: pdfDataUri } });
    expect(mocks.generate.mock.calls[1][0].output).toMatchObject({
      constrained: false,
      instructions: true,
    });
    expect(mocks.generate.mock.calls[1][0].output.schema.safeParse({}).success).toBe(false);
    expect(result.analiseAgente?.status).toBe("concluida");
    expect(result.leitura.modo).toBe("ia_com_evidencias");
  });

  it("triagem do original detecta dados clínicos em PDF que possui texto em todas as páginas", async () => {
    mocks.readPages.mockResolvedValue([{ numero: 1, texto: text }]);
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

  it("classifica um título em várias linhas pela IA e verifica a evidência antes do especialista", async () => {
    const source =
      "PROGRAMA DE\nGERENCIAMENTO DE\nRISCOS\nRazão Social: EMPRESA TESTE\nCNPJ: 44.337.647/0001-89";
    mocks.readPages.mockResolvedValue([{ numero: 1, texto: source }]);
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
          evidencias: [{ pagina: 1, trecho: "PROGRAMA DE GERENCIAMENTO DE RISCOS" }],
        },
      })
      .mockResolvedValueOnce({ output: parsePgrDocumentPages([{ numero: 1, texto: source }]) });
    const result = await analyzePgrDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" });
    expect(result.documento?.tipo).toBe("PGR");
    expect(result.analiseAgente?.status).toBe("concluida");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("rejeita classificação textual sem título verificável", async () => {
    mocks.generate.mockResolvedValue({
      output: {
        tipo: "PGR",
        statusClassificacao: "identificado",
        contemDadosClinicosIndividuais: false,
        evidencias: [{ pagina: 1, trecho: "Título inventado sem fonte" }],
      },
    });
    const result = await analyzePgrDocument({
      pdfDataUri: "Documento genérico de aquisição de materiais sem título de SST.",
    });
    expect(result.analiseAgente?.status).toBe("pendente");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("reconhece título visual quando o PDF extrai apenas rodapé ou marca d'água", async () => {
    const pages = [
      { numero: 1, texto: "Cópia digitalizada para arquivo. Documento de uso interno da empresa." },
    ];
    mocks.readPages.mockResolvedValue(pages);
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "ASO",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: true,
          evidencias: [{ pagina: 1, trecho: "ATESTADO DE SAÚDE OCUPACIONAL" }],
        },
      })
      .mockResolvedValueOnce({ output: parsePgrDocumentPages(pages) });
    const result = await analyzePgrDocument({
      pdfDataUri: "data:application/pdf;base64,aGVsbG8=",
      allowClinical: true,
    });
    expect(result.documento).toMatchObject({ tipo: "ASO", acesso: "clinico_restrito" });
    expect(result.documento?.evidencias).toHaveLength(1);
    expect(result.analiseAgente?.status).toBe("concluida");
    expect(result.identidade.status).toBe("nao_identificada");
  });

  it("não aceita título visual em página inexistente nem elimina a restrição clínica", async () => {
    mocks.readPages.mockResolvedValue([
      { numero: 1, texto: "Cópia digitalizada para arquivo. Documento de uso interno da empresa." },
    ]);
    mocks.generate.mockResolvedValue({
      output: {
        tipo: "ASO",
        statusClassificacao: "identificado",
        contemDadosClinicosIndividuais: false,
        evidencias: [{ pagina: 3, trecho: "ATESTADO DE SAÚDE OCUPACIONAL" }],
      },
    });
    const result = await analyzePgrDocument({
      pdfDataUri: "data:application/pdf;base64,aGVsbG8=",
      allowClinical: true,
    });
    expect(result.documento).toMatchObject({ tipo: "OUTRO", acesso: "clinico_restrito" });
    expect(result.analiseAgente?.status).toBe("pendente");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("limita a repetição inconclusiva ao orçamento total de 45 segundos", async () => {
    vi.useFakeTimers();
    try {
      mocks.generate
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    output: {
                      tipo: "OUTRO",
                      statusClassificacao: "nao_identificado",
                      contemDadosClinicosIndividuais: false,
                    },
                  }),
                30000
              )
            )
        )
        .mockImplementationOnce(() => new Promise(() => {}));
      const pending = analyzePgrDocument({ pdfDataUri: "data:image/png;base64,aGVsbG8=" });
      await vi.advanceTimersByTimeAsync(45000);
      const result = await pending;
      expect(mocks.generate).toHaveBeenCalledTimes(2);
      expect(result.analiseAgente?.status).toBe("indisponivel");
      expect(result.analiseAgente?.resumo).toContain("TIMEOUT");
      expect(mocks.generate.mock.calls[1][0].abortSignal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("informa limite do provedor sem divulgar a mensagem original", async () => {
    mocks.generate.mockRejectedValue(
      Object.assign(new Error("conteúdo confidencial do provedor"), { status: 429 })
    );
    const result = await analyzePgrDocument({ pdfDataUri: text });
    expect(result.analiseAgente?.resumo).toContain("Código: QUOTA");
    expect(JSON.stringify(result)).not.toContain("conteúdo confidencial");
  });
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

it("mantém linhas tabulares e datas documentadas quando a IA omite o inventário", async () => {
  const pages = [
    {
      numero: 1,
      texto:
        "PGR\nRazão Social: CLIENTE SINTÉTICO\nCNPJ: 43.776.491/0001-70\nEmissão: 01/09/2026\nRevisão: 01/09/2028\nGHE: 01 - Escritório\nErgonômico Postura sentada prolongada Trabalho sentado 2 3 6",
      riscosTabela: [
        {
          agente: "Postura sentada prolongada",
          categoria: "ergonomico" as const,
          setorGhe: "GHE: 01 - Escritório",
          trecho: "Ergonômico Postura sentada prolongada Trabalho sentado 2 3 6",
          controlesDocumentados: [],
          classificacaoOriginal: "S=2; P=3; Nível=6",
        },
      ],
    },
  ];
  mocks.readPages.mockResolvedValue(pages);
  const output = parsePgrDocumentPages(pages);
  output.riscosIdentificados = [];
  output.pgrCardDetalhado.dataEmissao = "";
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
  expect(result.riscosIdentificados).toHaveLength(1);
  expect(result.riscosIdentificados[0].classificacaoOriginal).toBe("S=2; P=3; Nível=6");
  expect(result.pgrCardDetalhado.dataEmissao).toBe("01/09/2026");
  expect(result.pgrCardDetalhado.dataRevisao).toBe("01/09/2028");
  expect(result.pgrCardDetalhado.dataValidade).toBe("");
});

it("classifica falha do especialista sem expor o documento na mensagem", async () => {
  mocks.generate.mockRejectedValue(
    new Error("Schema validation failed: private document contents")
  );
  const result = await analyzePgrDocument({
    pdfDataUri: "PGR\nPrograma de Gerenciamento de Riscos\n" + text,
  });
  expect(result.analiseAgente?.status).toBe("indisponivel");
  expect(result.analiseAgente?.resumo).toContain("Código: FORMAT");
  expect(result.analiseAgente?.resumo).not.toContain("private document contents");
});
