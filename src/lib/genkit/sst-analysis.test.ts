// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v3";
import { jsPDF } from "jspdf";
import { processAsoPdfAction } from "@/app/actions/ocr-aso";
import { runSstAnalysis } from "@/app/actions/sst-analysis";
import { calculateFapReview as fapNtepAuditFlow } from "./flows/fap-ntep-audit";
import { calculateNr28 as aftNr28SimulatorFlow } from "./flows/aft-nr28-simulator";
import {
  mapLegacyRecords as legacyEtlMigrationFlow,
  legacyEtlMigrationFlow as suggestLegacy,
} from "./flows/legacy-etl-migration";
import { scoreErgonomics } from "./flows/ergonomic-assessment";
import { reviewTraining } from "./flows/training-compliance";
import { accidentInvestigationFlow } from "./flows/accident-investigation";
import { privateVertexFlow, readMedia } from "./private-vertex";
import { applyAsoDraft, type AsoDraft } from "./aso-draft";
import { parseSstFields } from "./sst-modules";
const { request, observed } = vi.hoisted(() => ({ request: vi.fn(), observed: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/sst-analysis-access", () => ({
  authorizeSst: vi.fn((token: string) => {
    if (token !== "TESTE") throw new Error("Sessão de teste inválida.");
  }),
  healthRoles: ["DOCTOR"],
  technicalRoles: ["ENGINEER"],
}));
function testPdf(lines: string[]) {
  const pdf = new jsPDF();
  pdf.text(lines, 12, 20);
  return new File([pdf.output("arraybuffer")], "TESTE-sintetico.pdf", { type: "application/pdf" });
}
vi.mock("googleapis/build/src/apis/aiplatform", () => ({
  auth: {
    GoogleAuth: class {
      getClient() {
        return Promise.resolve({ request });
      }
      getProjectId() {
        return Promise.resolve("teste-nai");
      }
    },
  },
}));
vi.mock("./router", () => ({
  ai: {
    defineFlow:
      (name: string, fn: () => Promise<boolean>) =>
      (...args: unknown[]) => {
        observed(name, args);
        return fn();
      },
  },
}));
const vertex = (obj: unknown) => ({
  data: {
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(obj) }] } }],
  },
});
describe("TESTE NAI – análises SST", () => {
  const fap = {
    cnpjEmpresa: "11222333000181",
    cnaePrincipal: "0810",
    cid10: "A15.0",
    especie: "B91",
    numeroBeneficio: "TESTE-000",
    dataInicio: "2026-01-01",
    cat: "Não",
    exposicao: "Desconhecida",
    folhaAnual: 1000000,
    rat: 2,
    fapAtual: 1.5,
    fapSimulado: 1,
  };
  it("cruza classe e categoria e calcula o cenário em centavos", () => {
    const r = fapNtepAuditFlow(fap);
    expect(r.nexoTecnicoEpidemiologico.parNaListaC).toBe(true);
    expect(r.impactoFinanceiroEstimado.diferencaAnualReais).toBe(10000);
  });
  it("preserva a espécie sem CAT e permite cenário de aumento", () => {
    const r = fapNtepAuditFlow({ ...fap, cnaePrincipal: "0000", fapSimulado: 2 });
    expect(r.nexoTecnicoEpidemiologico.parNaListaC).toBe(false);
    expect(r.evidencias.especie).toBe("B91");
    expect(r.impactoFinanceiroEstimado.diferencaAnualReais).toBe(-10000);
  });
  it("recusa datas inexistentes e fim anterior ao início", () => {
    for (const dataFim of ["2026-02-31", "2025-12-20"])
      expect(() => fapNtepAuditFlow({ ...fap, dataFim })).toThrow();
  });
  const nr28 = {
    numeroColaboradores: 10,
    grauRiscoEmpresa: 2,
    regime: "Geral",
    asosVencidos: 5,
    treinamentosPendentes: 0,
    itens: ["107128-9", "107128-9"],
  };
  it("gradua medicina I3 sem duplicar o código ou extrapolar a contagem de ASOs", () => {
    const r = aftNr28SimulatorFlow(nr28);
    expect(r.achados).toHaveLength(1);
    expect(r.estimativa).toMatchObject({ minimoBtn: 1015, maximoBtn: 1254, minimoReais: null });
  });
  it("usa outra faixa a partir de 11 empregados e exige referência de conversão", () => {
    expect(
      aftNr28SimulatorFlow({
        ...nr28,
        numeroColaboradores: 11,
        valorUnidade: 2,
        referenciaConversao: "TESTE simulado",
      }).estimativa.minimoReais
    ).toBe(2510);
  });
  it("omite total parcial ou regime sem suporte", () => {
    for (const p of [{ itens: [] }, { itens: ["107128-9", "999999-9"] }, { regime: "Rural" }])
      expect(aftNr28SimulatorFlow({ ...nr28, ...p }).estimativa.minimoBtn).toBeNull();
  });
  const ergo = { postoTrabalho: "TESTE", atividadeExecutada: "TESTE" };
  it("mantém escalas distintas e não pontua ficha incompleta", () => {
    expect(scoreErgonomics({ ...ergo, metodo: "RULA", grupoA: 8, grupoB: 7 }).pontuacaoRisco).toBe(
      7
    );
    expect(
      scoreErgonomics({ ...ergo, metodo: "REBA", grupoA: 12, grupoB: 12, atividade: 3 })
        .pontuacaoRisco
    ).toBe(15);
    expect(scoreErgonomics({ ...ergo, metodo: "REBA", grupoA: 12, grupoB: 12 })).toHaveProperty(
      "pendencia"
    );
  });
  it("calcula LI somente com aplicabilidade conferida", () => {
    const i = {
      ...ergo,
      metodo: "NIOSH" as const,
      cargaKg: 23,
      multiplicadores: [1, 1, 1, 1, 1, 0.5],
    };
    expect(scoreErgonomics(i)).toHaveProperty("pendencia");
    expect(scoreErgonomics({ ...i, aplicabilidadeConfirmada: true })).toMatchObject({
      limiteRecomendadoKg: 11.5,
      indiceLevantamento: 2,
    });
  });
  const etl = {
    sistemaOrigem: "SOC",
    dataReferencia: "2026-10-26",
    registros: [
      { idOriginal: "TESTE-1", descricaoAgenteNocivo: "01.01.001" },
      { idOriginal: "TESTE-2", descricaoAgenteNocivo: "DESCONHECIDO" },
    ],
  };
  it("preserva pendências e calcula a taxa pelo total original", () => {
    const r = legacyEtlMigrationFlow(etl);
    expect(r.taxaSucessoMapeamentoPercent).toBe(50);
    expect(r.registrosMapeados[1].codigoEsocialTabela24).toBeNull();
    expect(() =>
      legacyEtlMigrationFlow({ ...etl, registros: [etl.registros[0], etl.registros[0]] })
    ).toThrow();
  });
  it("aceita colunas coladas e não converte campo obrigatório vazio em zero", () => {
    const f = new FormData();
    f.set("sistemaOrigem", "SOC");
    f.set("dataReferencia", "2026-10-26");
    f.set("registros", "TESTE-1\t01.01.001\t85 dB\tProteção");
    expect(parseSstFields("migracao", f).registros).toMatchObject([
      { idOriginal: "TESTE-1", equipamentoProtecao: "Proteção" },
    ]);
    expect(() => parseSstFields("fiscalizacao", new FormData())).toThrow();
  });
  const cert = {
    nomeAluno: null,
    cpfImpresso: null,
    normaImpressa: "NR-33",
    modalidadeImpressa: null,
    cargaHoraria: 16,
    dataConclusao: "2024-02-29",
    dataValidadeExpressa: null,
    instrutor: null,
    registroImpresso: null,
    conteudoProgramatico: [],
    pendencias: [],
  };
  const trabalhador = {
    cpf: "52998224725",
    funcao: "TESTE",
    norma: "NR-33",
    modalidade: "Inicial",
    perfil: "Supervisor de entrada",
    dataReferencia: "2025-03-01",
  } as const;
  it("separa supervisor e vigia com data bissexta e identidade ausente", () => {
    const r = reviewTraining(trabalhador, cert);
    expect(r.conferencia).toMatchObject({
      titularConfere: null,
      cargaHorariaMinima: 40,
      cargaHorariaAtingida: false,
      limiteDocumental: "2025-02-28",
      prazoUltrapassado: true,
    });
    expect(
      reviewTraining({ ...trabalhador, perfil: "Vigia ou trabalhador autorizado" }, cert)
        .conferencia.cargaHorariaMinima
    ).toBe(16);
  });
  it("evita duração universal da NR-12 e autorização automática", () => {
    const r = reviewTraining({ ...trabalhador, norma: "NR-12" }, cert);
    expect(r.conferencia.cargaHorariaMinima).toBeNull();
    expect(r.statusControleAcesso).toContain("conferência");
  });
  const draft: AsoDraft = {
    documento: "ASO_INDIVIDUAL",
    cpfTrabalhador: "52998224725",
    tipoExame: "9",
    dataAso: null,
    resultadoAso: null,
    medicoEmitente: { nome: null, crm: null, ufCrm: null },
    exames: [],
    agentesNocivosRelacionados: [],
    pendencias: [],
  };
  it("leva o PDF do formulário ao Vertex e devolve todos os exames no rascunho do ASO", async () => {
    const exames = ["EXAME TESTE A", "EXAME TESTE B", "EXAME TESTE C", "EXAME TESTE D"].map(
      (descricao) => ({
        descricao,
        codigoProcedimento: null,
        dataExame: null,
        ordemExame: null,
        resultado: null,
      })
    );
    const form = new FormData();
    const file = testPdf(["ASO TESTE", ...exames.map((e) => e.descricao)]);
    form.set("asoFile", file);
    request.mockResolvedValueOnce(vertex({ ...draft, exames }));
    const r = await processAsoPdfAction("TESTE", "empresa-teste", form);
    expect(r).toMatchObject({ success: true, data: { exames } });
    const body = request.mock.lastCall?.[0]?.data;
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: "application/pdf",
      data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
    expect(body.systemInstruction.parts[0].text).toContain("Preserve todos os itens legíveis");
    expect(observed).toHaveBeenCalledWith("ocrIngestFlow", []);
  });
  it("conclui a avaliação do formulário de ergonomia com um PNG sintético e a ficha RULA", async () => {
    const encoded =
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNMyatgYGBgYmBgYGBgAAAPjgFORhi0IgAAAABJRU5ErkJggg==";
    const form = new FormData();
    for (const [key, value] of Object.entries({
      postoTrabalho: "TESTE",
      atividadeExecutada: "TESTE",
      metodo: "RULA",
      grupoA: "1",
      grupoB: "1",
    }))
      form.set(key, value);
    form.set(
      "arquivo",
      new File([Buffer.from(encoded, "base64")], "TESTE.png", { type: "image/png" })
    );
    request.mockResolvedValueOnce(
      vertex({
        desviosPosturaisDetectados: [],
        aspectosBiomecanicos: [],
        organizacaoTrabalho: [],
        condicoesAmbientais: [],
        limitacoes: ["Imagem sintética"],
        planoAdequacaoAEP: [],
      })
    );
    expect(await runSstAnalysis("TESTE", "empresa-teste", "ergonomia", form)).toMatchObject({
      success: true,
      result: { metodo: "RULA", pontuacaoRisco: 1, limitacoes: ["Imagem sintética"] },
    });
    expect(request.mock.lastCall?.[0].data.contents[0].parts[1].inlineData).toEqual({
      mimeType: "image/png",
      data: encoded,
    });
  });
  it("confere certificado PDF, preserva lacunas e exige revisão antes de liberação", async () => {
    const file = testPdf(["CERTIFICADO TESTE", "NR-33", "16 horas"]);
    const form = new FormData();
    for (const [key, value] of Object.entries(trabalhador)) form.set(key, value);
    form.set("arquivo", file);
    request.mockResolvedValueOnce(vertex(cert));
    expect(await runSstAnalysis("TESTE", "empresa-teste", "capacitacao", form)).toMatchObject({
      success: true,
      result: {
        dadosExtraidos: { cargaHoraria: 16 },
        conferencia: { titularConfere: null, cargaHorariaAtingida: false },
        statusControleAcesso: "Aguardando conferência do responsável",
      },
    });
    expect(request.mock.lastCall?.[0].data.contents[0].parts[1].inlineData).toEqual({
      mimeType: "application/pdf",
      data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
  });
  it("recusa a mídia antes da chamada ao Vertex quando o acesso é negado", async () => {
    const before = request.mock.calls.length;
    const form = new FormData();
    form.set("asoFile", testPdf(["TESTE"]));
    expect(await processAsoPdfAction("", "empresa-teste", form)).toMatchObject({ success: false });
    for (const mod of ["ergonomia", "capacitacao"] as const) {
      expect(await runSstAnalysis("", "empresa-teste", mod, form)).toMatchObject({
        success: false,
      });
    }
    expect(request).toHaveBeenCalledTimes(before);
  });
  it("impede troca de vínculo e documento múltiplo; não reaproveita matrícula nem consentimento", () => {
    const orig = {
      ideVinculo: { cpfTrab: "000", matricula: "TESTE" },
      aso: { resultDisclosureAuthorized: true },
    };
    expect(() => applyAsoDraft(orig, draft, true)).toThrow();
    expect(() =>
      applyAsoDraft(orig, { ...draft, documento: "MULTIPLOS_TRABALHADORES" }, false)
    ).toThrow();
    const r = applyAsoDraft(orig, draft, false);
    expect(r.ideVinculo).not.toHaveProperty("matricula");
    expect(r.aso).toMatchObject({ tpAso: 9, resAso: "", resultDisclosureAuthorized: false });
  });
  it("rejeita tipos disfarçados e arquivo vazio", async () => {
    for (const content of ["", "TESTE"])
      await expect(
        readMedia(new Blob([content], { type: "image/png" }), ["image/png"])
      ).rejects.toThrow();
  });
  it("isola resultados simultâneos e mantém conteúdo fora dos argumentos do Genkit", async () => {
    const call = privateVertexFlow("TESTE-concorrencia", z.object({ valor: z.string() }));
    request.mockImplementation(async (req) => {
      const valor = req.data.contents[0].parts[0].text;
      await Promise.resolve();
      return vertex({ valor });
    });
    const [a, b] = await Promise.all([call("TESTE-A"), call("TESTE-B")]);
    expect([a.valor, b.valor]).toEqual(["TESTE-A", "TESTE-B"]);
    expect(observed).toHaveBeenCalledWith("TESTE-concorrencia", []);
  });
  it("descarta citação de testemunha inexistente", async () => {
    request.mockResolvedValueOnce(
      vertex({
        itens: [
          { tipo: "trecho", texto: "TESTE queda" },
          { tipo: "trecho", texto: "outro texto" },
          { tipo: "pergunta", texto: "O que antecedeu a queda?" },
          { tipo: "acao", texto: "Conferir o registro do local" },
        ],
      })
    );
    const r = await accidentInvestigationFlow({
      dataAcidente: "2026-01-01",
      setor: "TESTE",
      relato: "TESTE queda",
    });
    expect(r.fatosRelatados).toEqual([{ fato: "TESTE queda", trechoLiteral: "TESTE queda" }]);
    expect(r.cincoPorques[0].respostaProvisoria).toBeNull();
    expect(r.plano5W2H[0]).toMatchObject({
      onde: "TESTE",
      custo: null,
      oQue: "Conferir o registro do local",
    });
  });
  it("filtra sugestões fora do catálogo e preserva a taxa de correspondências exatas", async () => {
    request.mockResolvedValueOnce(
      vertex({ sugestoes: [{ linha: 0, codigos: ["99.99.999", "02.01.001"] }] })
    );
    const r = await suggestLegacy({
      ...etl,
      registros: [{ idOriginal: "TESTE-1", descricaoAgenteNocivo: "Barulho alto no setor" }],
    });
    expect(r.registrosMapeados[0].candidatos.map((c) => c.codigo)).toContain("02.01.001");
    expect(r.registrosMapeados[0].candidatos.map((c) => c.codigo)).not.toContain("99.99.999");
    expect(r.taxaSucessoMapeamentoPercent).toBe(0);
  });
  it("usa uma saída compacta e não atribui causas quando o provedor falha", async () => {
    request.mockRejectedValueOnce({ response: { status: 503 } });
    const r = await accidentInvestigationFlow({
      dataAcidente: "2026-11-10",
      setor: "TESTE",
      relato: "Relato TESTE",
    });
    const body = request.mock.lastCall?.[0]?.data;
    expect(body.generationConfig.responseJsonSchema.properties).toHaveProperty("itens");
    expect(body.generationConfig.maxOutputTokens).toBe(2048);
    expect(r.assistenciaIa).toContain("não foi concluída");
    expect(r.hipotesesImediatas).toEqual([]);
  });
});
