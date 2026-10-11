import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import NaiImportaPage from "./page";
import {
  PGR_VERSION,
  type NaiDocumentType,
  type PgrAnalysisOutput,
  type PgrDraftView,
} from "@/lib/pgr-schema";

const state = vi.hoisted(() => ({
  user: { uid: "staff-a", getIdToken: vi.fn().mockResolvedValue("session-token") },
  activeClientId: "all",
  setActiveClientId: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/firebase", () => ({ useUser: () => ({ user: state.user }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => state }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/lib/pgr-request-headers", () => ({
  pgrRequestHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer session-token" }),
}));
vi.mock("@/components/pgr-agent-review", () => ({ PgrAgentReview: () => null }));

const company = { id: "company-a", name: "Empresa de Exemplo", cnpj: "11.222.333/0001-81" };
const source = { pagina: 1, trecho: "Empresa de Exemplo, CNPJ 11.222.333/0001-81" };

function analysisFor(tipo: NaiDocumentType = "PGR"): PgrAnalysisOutput {
  const role = ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(tipo)
    ? "medico_trabalho"
    : ["AEP", "AET", "DADOS_ERGONOMICOS"].includes(tipo)
      ? "ergonomista"
      : "engenheiro_seguranca";
  return {
    documento: {
      tipo,
      agenteResponsavel: role,
      statusClassificacao: "identificado",
      evidencias: [source],
      justificativa: "Tipo identificado no conteúdo do documento.",
      acesso: role === "medico_trabalho" ? "clinico_restrito" : "sst",
    },
    analiseAgente: {
      agente: role,
      status: "concluida",
      resumo: "Revisão do documento preparada com evidências.",
    },
    prestadoresIdentificados: [
      {
        id: "provider-a",
        nome: "Prestador de Exemplo",
        cnpj: "04.252.011/0001-10",
        registroProfissional: "",
        especialidade: "SST",
        papelNoDocumento: "Prestador responsável",
        evidencias: [
          {
            pagina: 2,
            trecho: "Prestador responsável: Prestador de Exemplo, CNPJ 04.252.011/0001-10.",
          },
        ],
        cidadeUf: "",
        endereco: "",
        email: "",
        telefone: "",
      },
    ],
    pgrCardDetalhado: {
      razaoSocial: company.name,
      cnpj: company.cnpj,
      cnae: "",
      grauDeRisco: null,
      enderecoCompleto: "",
      cidadeUf: "",
      dataEmissao: "2026-10-10",
      dataValidade: "",
      coordenadasGps: "",
      totalRiscosMapeados: 0,
      ghesIdentificados: [],
      esocialS2240Status: "",
    },
    identidade: { status: "identificada", evidencias: [source], aviso: "Confira a unidade." },
    riscosIdentificados: [],
    acoesCategorizadas: [
      {
        id: "action-a",
        tipoAcao: "Verificação",
        titulo: "Conferir responsáveis e cronograma",
        descricaoDetalhada: "Conferir o cronograma com a equipe responsável pelo documento.",
        prioridade: "medium",
        colunaKanban: "todo",
        referenciaLegal: "",
        responsavelSugerido: "Equipe SST",
        agenteSugerido: role,
        riscosRelacionados: [],
        evidencia: source,
        checklist: ["Conferir o documento original", "Definir o responsável pelo acompanhamento"],
        fundamento: "sugestao",
        prazoDocumentado: "",
      },
    ],
    parecerTecnicoIA: "Revisão do documento preparada com evidências.",
    leitura: {
      modo: "ia_com_evidencias",
      paginas: 2,
      paginasComTexto: 2,
      avisos: [],
      versao: PGR_VERSION,
    },
  };
}

function draftFor(analysis = analysisFor()): PgrDraftView {
  return {
    draftId: "draft-a",
    sourceHash: "file-hash-a",
    fileName: "documento.pdf",
    analysis,
    companies: [company],
    suggestedCompanyId: company.id,
    canCreateCompany: false,
    canRegisterProviders: true,
  };
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let container: HTMLDivElement;
let root: Root;
let currentDraft: PgrDraftView;
let history: unknown[];
let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.user = { uid: "staff-a", getIdToken: vi.fn().mockResolvedValue("session-token") };
  state.activeClientId = "all";
  state.setActiveClientId.mockClear();
  state.toast.mockClear();
  currentDraft = draftFor();
  history = [];
  fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/nai-importa/companies") return json({ companies: [company] });
    if (url.startsWith("/api/nai-importa/history?")) return json({ records: history });
    if (url === "/api/nai-importa/analyze") return json(currentDraft);
    if (url === "/api/nai-importa/save")
      return json({
        companyId: company.id,
        cardId: "document-a",
        analysis: currentDraft.analysis,
        taskCount: 3,
        checklistCount: 7,
        providerCount: 1,
        providerIds: ["provider-a"],
        restricted: false,
      });
    throw new Error("Unexpected request: " + url);
  });
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => root.render(<NaiImportaPage />));
}

async function upload() {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["%PDF-1.7\nexample"], "documento.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

function saveButton() {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Organizar no sistema"
  )!;
}

async function confirm() {
  await act(async () => container.querySelector<HTMLButtonElement>("#nai-confirmed")!.click());
}

describe("NAI importa review workflow", () => {
  it.each([
    ["PGR", "Engenheiro de Segurança"],
    ["LTCAT", "Engenheiro de Segurança"],
    ["PCMSO", "Médico do Trabalho"],
    ["ASO", "Médico do Trabalho"],
    ["PERICIA_MEDICA", "Médico do Trabalho"],
    ["AEP", "Ergonomista"],
    ["AET", "Ergonomista"],
    ["DADOS_ERGONOMICOS", "Ergonomista"],
  ] as const)("shows the assigned agent for %s before registration", async (type, agent) => {
    currentDraft = draftFor(analysisFor(type));
    await render();
    await upload();
    expect(container.querySelector("h1")?.textContent).toBe("NAI importa");
    expect(
      Array.from(container.querySelectorAll("h2")).map((heading) => heading.textContent)
    ).toContain(agent);
    expect(saveButton().disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/nai-importa/save")).toBe(false);
  });

  it("requires completed specialist analysis even after the client was confirmed", async () => {
    currentDraft.analysis.analiseAgente!.status = "indisponivel";
    await render();
    await upload();
    await confirm();
    expect(container.textContent).toContain("A análise do agente ainda não foi concluída");
    expect(saveButton().disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/nai-importa/save")).toBe(false);
  });

  it("saves confirmed links and reports the actual server counts and destination", async () => {
    await render();
    await upload();
    await confirm();
    expect(saveButton().disabled).toBe(false);
    await act(async () => saveButton().click());
    const request = fetchMock.mock.calls.find(([url]) => url === "/api/nai-importa/save");
    const body = (request?.[1] as RequestInit).body as FormData;
    expect(body.get("draftId")).toBe("draft-a");
    expect(body.get("companyId")).toBe(company.id);
    expect(body.get("includeProviders")).toBe("true");
    const summary = container.querySelector('[aria-label="Resultado da organização"]');
    expect(summary?.textContent).toContain(
      "3 cards vinculados ao cliente · 7 itens de checklist · 1 prestador vinculado"
    );
    expect(summary?.querySelector("a")?.getAttribute("href")).toBe(
      "/action-plans?company=company-a&source=pgr"
    );
    expect(state.setActiveClientId).toHaveBeenCalledWith(company.id);
  });

  it("keeps provider registration disabled without the specific permission", async () => {
    currentDraft.canRegisterProviders = false;
    await render();
    await upload();
    expect(container.querySelector<HTMLButtonElement>("#nai-include-providers")?.disabled).toBe(
      true
    );
    await confirm();
    await act(async () => saveButton().click());
    const request = fetchMock.mock.calls.find(([url]) => url === "/api/nai-importa/save");
    expect(((request?.[1] as RequestInit).body as FormData).get("includeProviders")).toBe("false");
  });

  it("does not reveal filenames or allow opening redacted clinical history", async () => {
    state.activeClientId = company.id;
    history = [
      {
        id: "clinical-a",
        companyId: company.id,
        fileName: "ASO_NOME_SIGILOSO.pdf",
        analysis: null,
        restricted: true,
        taskCount: 2,
      },
    ];
    await render();
    expect(container.textContent).toContain("Documento de saúde ocupacional");
    expect(container.textContent).toContain("Acesso clínico restrito");
    expect(container.textContent).not.toContain("NOME_SIGILOSO");
    const record = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Documento de saúde ocupacional")
    );
    expect(record?.disabled).toBe(true);
  });

  it("clears the document and clinical analysis when the signed-in user changes", async () => {
    currentDraft = draftFor(analysisFor("ASO"));
    currentDraft.analysis.analiseAgente!.resumo = "Conteúdo clínico restrito da primeira sessão.";
    await render();
    await upload();
    expect(container.textContent).toContain("Conteúdo clínico restrito da primeira sessão");
    state.user = { uid: "staff-b", getIdToken: vi.fn().mockResolvedValue("another-session") };
    await render();
    expect(container.textContent).not.toContain("Conteúdo clínico restrito da primeira sessão");
    expect(container.textContent).not.toContain("Conferir e organizar");
    expect(container.textContent).not.toContain("documento.pdf");
  });

  it("discards a late analysis response after the user interrupts the reading", async () => {
    let finish: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/nai-importa/analyze" ? pending : normalFetch(url, init)
    );
    await render();
    await upload();
    const cancel = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Interromper leitura"
    );
    await act(async () => cancel!.click());
    await act(async () => {
      finish(json(currentDraft));
    });
    expect(container.textContent).toContain("Leitura interrompida");
    expect(container.textContent).not.toContain("Conferir e organizar");
    expect(container.querySelector('[aria-label="Resultado da organização"]')).toBeNull();
  });
});
