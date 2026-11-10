// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v3";
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
        fatosRelatados: [
          { fato: "Relato", trechoLiteral: "TESTE queda" },
          { fato: "Hipótese", trechoLiteral: "outro texto" },
        ],
        hipotesesImediatas: [],
        hipotesesOrganizacionais: [],
        cincoPorques: [],
        bowTie: { barreirasPreventivasAConferir: [], barreirasMitigadorasAConferir: [] },
        revisaoInventarioPgr: "Revisar",
        plano5W2H: [],
      })
    );
    const r = await accidentInvestigationFlow({
      dataAcidente: "2026-01-01",
      setor: "TESTE",
      relato: "TESTE queda",
    });
    expect(r.fatosRelatados).toHaveLength(1);
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
});
