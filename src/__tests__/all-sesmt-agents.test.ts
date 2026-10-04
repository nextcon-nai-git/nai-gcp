import { describe, it, expect } from "vitest";
import { processSesmtAgentRequest } from "@/ai/flows/sesmt-agents-flow";
import { processMultidisciplinarySstRequest } from "@/ai/flows/multidisciplinary-sst-agent-flow";
import { processAsoSchedulerKitRequest } from "@/ai/flows/aso-scheduler-kit-agent-flow";
import { SESMT_AGENTS_CONFIG, AgentRole } from "@/ai/sesmt-agents-config";

describe("Suíte Completa de Testes dos 7 Agentes IA do SESMT", () => {
  it("1. Deve testar o Agente Multidisciplinar Mestre (Prompt Mestre 5 em 1)", async () => {
    const res = await processMultidisciplinarySstRequest({
      userPrompt:
        "Operador de centro de usinagem relatando fadiga muscular nos ombros e exposição a neblina de óleo solúvel.",
      companyContext: { companyName: "Metalúrgica NAI", industrySector: "Industrial" },
    });

    expect(res).toBeDefined();
    expect(res.resumo_executivo).toBeTruthy();
    expect(res.analise_engenharia_seguranca.perigos.length).toBeGreaterThan(0);
    expect(res.analise_tecnico_seguranca.acoes_imediatas.length).toBeGreaterThan(0);
    expect(res.analise_medico_trabalho.relacao_ocupacional).toBeDefined();
    expect(res.analise_enfermagem_trabalho.conduta_sugerida.length).toBeGreaterThan(0);
    expect(res.analise_ergonomica.recomendacoes.length).toBeGreaterThan(0);
    expect(res.analise_integrada.consensos.length).toBeGreaterThan(0);
    expect(res.plano_de_acao.length).toBeGreaterThan(0);
  });

  it("2. Deve testar o Agente Agendador de ASO & Kit para Clínicas Parceiras", async () => {
    const res = await processAsoSchedulerKitRequest({
      userPrompt:
        "Agendamento de exame admissional para Soldador com exposição a ruído e fumos metálicos.",
      workerData: {
        name: "João Silva",
        cpf: "111.222.333-44",
        roleTitle: "Soldador",
        examType: "ADMISSIONAL",
      },
    });

    expect(res).toBeDefined();
    expect(res.resumo_agendamento).toBeTruthy();
    expect(res.tipo_aso).toBe("ADMISSIONAL");
    expect(res.exames_complementares.length).toBeGreaterThan(0);
    expect(res.kit_clinica.numero_guia).toBeTruthy();
  });

  it("3. Deve testar o Agente Engenheiro de Segurança do Trabalho", async () => {
    const res = await processSesmtAgentRequest({
      agentRole: "engenheiro_seguranca",
      userPrompt:
        "Como dimensionar EPCs e exaustão localizada para cabine de pintura industrial segundo a NR-09 e NR-15?",
    });

    expect(res).toBeDefined();
    expect(res.agentRole).toBe("engenheiro_seguranca");
    expect(res.agentTitle).toContain("Engenheiro");
    expect(res.analysis).toBeTruthy();
    expect(res.actionItems.length).toBeGreaterThan(0);
  });

  it("4. Deve testar o Agente Técnico em Segurança do Trabalho", async () => {
    const res = await processSesmtAgentRequest({
      agentRole: "tecnico_seguranca",
      userPrompt: "Quais os itens de checagem diária para andaimes tubulares fachadeiros na NR-18?",
    });

    expect(res).toBeDefined();
    expect(res.agentRole).toBe("tecnico_seguranca");
    expect(res.agentTitle).toContain("Técnico");
    expect(res.analysis).toBeTruthy();
    expect(res.actionItems.length).toBeGreaterThan(0);
  });

  it("5. Deve testar o Agente Enfermeiro do Trabalho", async () => {
    const res = await processSesmtAgentRequest({
      agentRole: "enfermeiro_trabalho",
      userPrompt:
        "Qual o protocolo de triagem para trabalhador com sintomas febris e desidratação no canteiro de obras?",
    });

    expect(res).toBeDefined();
    expect(res.agentRole).toBe("enfermeiro_trabalho");
    expect(res.agentTitle).toContain("Enfermeiro");
    expect(res.analysis).toBeTruthy();
    expect(res.actionItems.length).toBeGreaterThan(0);
  });

  it("6. Deve testar o Agente Ergonomista", async () => {
    const res = await processSesmtAgentRequest({
      agentRole: "ergonomista",
      userPrompt:
        "Quais os requisitos de altura da mesa, regulagem da cadeira e descanso de pé para operadores de suporte técnico (NR-17)?",
    });

    expect(res).toBeDefined();
    expect(res.agentRole).toBe("ergonomista");
    expect(res.agentTitle).toContain("Ergonomista");
    expect(res.analysis).toBeTruthy();
    expect(res.actionItems.length).toBeGreaterThan(0);
  });

  it("7. Deve testar o Agente Médico do Trabalho", async () => {
    const res = await processSesmtAgentRequest({
      agentRole: "medico_trabalho",
      userPrompt:
        "Quais os exames auditivos e peridiocidade recomendada no PCMSO para exposição a ruído contínuo de 87 dBA?",
    });

    expect(res).toBeDefined();
    expect(res.agentRole).toBe("medico_trabalho");
    expect(res.agentTitle).toContain("Médico");
    expect(res.analysis).toBeTruthy();
    expect(res.actionItems.length).toBeGreaterThan(0);
  });

  it("8. Deve validar se os agentes estão devidamente configurados no mapa de metadados", () => {
    const roles: AgentRole[] = [
      "engenheiro_seguranca",
      "tecnico_seguranca",
      "enfermeiro_trabalho",
      "ergonomista",
      "medico_trabalho",
      "junta_sesmt",
    ];

    roles.forEach((role) => {
      const config = SESMT_AGENTS_CONFIG[role];
      expect(config).toBeDefined();
      expect(config.title).toBeTruthy();
      expect(config.avatar).toBeTruthy();
      expect(config.badge).toBeTruthy();
    });
  });
});
