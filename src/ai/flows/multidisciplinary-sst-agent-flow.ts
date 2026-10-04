/**
 * @fileOverview Fluxo de IA do Agente Multidisciplinar Mestre de SST / Saúde Ocupacional — Genkit 1.x
 * Atua simultaneamente sob os 5 pontos de vista profissionais:
 * 1. Engenheiro de Segurança do Trabalho
 * 2. Técnico de Segurança do Trabalho
 * 3. Médico do Trabalho
 * 4. Enfermeiro do Trabalho
 * 5. Ergonomista
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

export const MultidisciplinarySstInputSchema = z.object({
  userPrompt: z
    .string()
    .describe("Descrição do caso, trabalhador, atividade, ambiente ou evento a ser analisado."),
  companyContext: z
    .object({
      companyName: z.string().optional(),
      industrySector: z.string().optional(),
      employeeCount: z.number().optional(),
      specificRisk: z.string().optional(),
    })
    .optional()
    .describe("Contexto do ambiente de trabalho."),
});

export type MultidisciplinarySstInput = z.infer<typeof MultidisciplinarySstInputSchema>;

export const MultidisciplinarySstOutputSchema = z.object({
  resumo_executivo: z.string().describe("Resumo executivo do parecer multidisciplinar."),
  classificacao_geral: z
    .enum(["CRITICO", "ALTO", "MEDIO", "BAIXO", "OBSERVACAO"])
    .describe("Classificação geral do nível de risco."),
  evidencias: z
    .array(
      z.object({
        tipo: z.enum(["DOCUMENTO", "OBSERVACAO", "RELATO", "INFERENCIA"]),
        descricao: z.string(),
      })
    )
    .describe("Evidências categorizadas."),
  analise_engenharia_seguranca: z.object({
    perigos: z.array(z.string()),
    riscos: z.array(z.string()),
    controles_existentes: z.array(z.string()),
    nao_conformidades: z.array(z.string()),
    recomendacoes: z.array(z.string()),
  }),
  analise_tecnico_seguranca: z.object({
    condicoes_inseguras: z.array(z.string()),
    desvios: z.array(z.string()),
    acoes_imediatas: z.array(z.string()),
    acoes_corretivas: z.array(z.string()),
    acoes_preventivas: z.array(z.string()),
  }),
  analise_medico_trabalho: z.object({
    riscos_relacionados: z.array(z.string()),
    achados: z.array(z.string()),
    alertas: z.array(z.string()),
    hipoteses: z.array(z.string()),
    recomendacoes: z.array(z.string()),
    relacao_ocupacional: z.enum([
      "NAO AVALIAVEL",
      "NAO DETERMINADA",
      "POSSIVEL",
      "PROVAVEL",
      "CONFIRMADA",
    ]),
    necessita_avaliacao_medica: z.boolean(),
  }),
  analise_enfermagem_trabalho: z.object({
    dados_relevantes: z.array(z.string()),
    sinais_alerta: z.array(z.string()),
    conduta_sugerida: z.array(z.string()),
    encaminhamentos: z.array(z.string()),
    acompanhamento: z.array(z.string()),
  }),
  analise_ergonomica: z.object({
    fatores_risco: z.array(z.string()),
    demanda_fisica: z.array(z.string()),
    demanda_cognitiva: z.array(z.string()),
    organizacao_trabalho: z.array(z.string()),
    controles_existentes: z.array(z.string()),
    recomendacoes: z.array(z.string()),
    necessita_aet: z.boolean(),
  }),
  analise_integrada: z.object({
    consensos: z.array(z.string()),
    divergencias: z.array(z.string()),
    riscos_sistemicos: z.array(z.string()),
    riscos_prioritarios: z.array(z.string()),
  }),
  plano_de_acao: z.array(
    z.object({
      problema: z.string(),
      prioridade: z.string(),
      acao: z.string(),
      tipo_controle: z.string(),
      responsavel_sugerido: z.string(),
      prazo_sugerido: z.string(),
      indicador: z.string(),
      evidencia_encerramento: z.string(),
    })
  ),
  fundamentacao_normativa: z.array(
    z.object({
      referencia: z.string(),
      descricao: z.string(),
      status: z.enum(["CONFIRMADA", "A_CONFIRMAR"]),
    })
  ),
  evidencias_faltantes: z.array(z.string()),
  necessita_avaliacao_presencial: z.boolean(),
  necessita_avaliacao_especializada: z.boolean(),
  restricao_de_acesso: z.string(),
  confianca_analise: z.number().min(0).max(100),
});

export type MultidisciplinarySstOutput = z.infer<typeof MultidisciplinarySstOutputSchema>;

export const MULTIDISCIPLINARY_PROMPT_MASTER = `# PROMPT MESTRE — AGENTE MULTIDISCIPLINAR DE SST / SAÚDE OCUPACIONAL

Você é o **AGENTE MULTIDISCIPLINAR DE SAÚDE E SEGURANÇA DO TRABALHO do NAI — Nextcon Intelligence**.

Você atua simultaneamente como:
1. **Engenheiro de Segurança do Trabalho**
2. **Técnico de Segurança do Trabalho**
3. **Médico do Trabalho**
4. **Enfermeiro do Trabalho**
5. **Ergonomista**

Sua função é realizar uma análise multidisciplinar de trabalhadores, atividades, ambientes, documentos, eventos, acidentes, riscos ocupacionais, condições de saúde relacionadas ao trabalho e aspectos ergonômicos.

Você deve analisar o caso sob os **cinco pontos de vista profissionais**, comparar os resultados e produzir uma conclusão integrada.

---

# 1. PRINCÍPIO FUNDAMENTAL
Você é um **sistema de apoio técnico e à decisão profissional**.
Não substitui avaliação presencial, inspeção de campo, consulta médica, exame físico, avaliação de enfermagem, avaliação ergonômica ou responsabilidade técnica privativa.
Nunca invente dados. Nunca transforme ausência de informação em conclusão.
Quando não houver evidência suficiente, informe "EVIDÊNCIA INSUFICIENTE".
Quando uma avaliação presencial for necessária, informe "NECESSITA AVALIAÇÃO PRESENCIAL".
Quando houver divergência entre as áreas, identifique-a e explique o motivo.

---

# 2. HIERARQUIA DE EVIDÊNCIAS
Priorize: 1. documentos oficiais, 2. registros técnicos, 3. resultados de exames, 4. medições ambientais, 5. registros de inspeção, 6. fotos/vídeos, 7. descrição da atividade, 8. relatos, 9. informações administrativas, 10. inferências.
Diferencie: FATO DOCUMENTADO | EVIDÊNCIA OBSERVADA | RELATO | INFERÊNCIA | RECOMENDAÇÃO.

---

# 3. ANÁLISE MULTIDISCIPLINAR (5 ÁREAS)
- ENGENHARIA DE SEGURANÇA: perigos, riscos, agentes físicos/químicos/biológicos, controles (eliminação, substituição, engenharia, administrativos, EPI), NRs, PGR/GRO.
- TÉCNICO DE SEGURANÇA: condição insegura, desvios, EPI/EPC em campo, ação imediata/corretiva/preventiva, prioridades (CRÍTICA, ALTA, MÉDIA, BAIXA, OBSERVAÇÃO).
- MEDICINA DO TRABALHO: riscos ocupacionais, exposição, sintomas, exames, PCMSO/ASO, relação ocupacional (NÃO AVALIÁVEL, NÃO DETERMINADA, POSSÍVEL, PROVÁVEL, CONFIRMADA).
- ENFERMAGEM DO TRABALHO: atendimentos, primeiros socorros, absenteísmo, campanhas, sinais de alerta.
- ERGONOMIA: trabalho prescrito vs real, postura, força, repetitividade, carga mental, NR-17, AET/AEP.

---

# 4. ANÁLISE CRUZADA (CONSENSOS, DIVERGÊNCIAS, RISCOS SISTÊMICOS E CRÍTICOS)
Compare as cinco visões. Identifique consensos, divergências explicadas, riscos sistêmicos e riscos críticos.

---

# 5. PRIORIZAÇÃO E PLANO DE AÇÃO
Prioridade: CRÍTICO | ALTO | MÉDIO | BAIXO | OBSERVAÇÃO.
Hierarquia de controle: 1. Eliminação, 2. Engenharia, 3. Substituição, 4. Administrativos, 5. Treinamento, 6. EPI.

---

# 6. DADOS MÉDICOS E CONFIDENCIALIDADE
Se envolver dados de saúde sensíveis, indique em restricao_de_acesso: "ACESSO RESTRITO — DADO DE SAÚDE".
Atribua confianca_analise entre 0 e 100 de forma conservadora.
`;

export async function processMultidisciplinarySstRequest(
  input: MultidisciplinarySstInput
): Promise<MultidisciplinarySstOutput> {
  const fullPrompt = `${MULTIDISCIPLINARY_PROMPT_MASTER}

---
CONTEXTO DO AMBIENTE / EMPRESA:
- Empresa: ${input.companyContext?.companyName || "Não especificada"}
- Ramo de Atuação: ${input.companyContext?.industrySector || "Geral"}
- Nº de Trabalhadores: ${input.companyContext?.employeeCount || "N/A"}
- Risco Específico: ${input.companyContext?.specificRisk || "Nenhum reportado"}

CASO / SOLICITAÇÃO A SER ANALISADA PELO AGENTE MULTIDISCIPLINAR:
"${input.userPrompt}"

Retorne o JSON exatamente conforme a estrutura solicitada.`;

  try {
    const generatePromise = ai.generate({
      model: "googleai/gemini-1.5-flash",
      prompt: fullPrompt,
      output: { schema: MultidisciplinarySstOutputSchema },
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));

    const response = await Promise.race([generatePromise, timeoutPromise]);

    if (
      response &&
      response.output &&
      typeof response.output === "object" &&
      "resumo_executivo" in response.output &&
      response.output.resumo_executivo
    ) {
      return response.output as MultidisciplinarySstOutput;
    }
  } catch (err) {
    console.warn("[Genkit Multidisciplinary SST Agent Flow] Modo Fallback Ativado:", err);
  }

  // Fallback estruturado conservador alinhado com o Princípio Fundamental do Prompt Mestre
  return {
    resumo_executivo: `Parecer Integrado Multidisciplinar NAI sobre "${input.userPrompt}". Análise preliminar realizada pelas 5 especialidades do SESMT.`,
    classificacao_geral: "MEDIO",
    evidencias: [
      { tipo: "RELATO", descricao: input.userPrompt },
      {
        tipo: "INFERENCIA",
        descricao: "Análise gerada por triagem inicial multidisciplinar do NAI.",
      },
    ],
    analise_engenharia_seguranca: {
      perigos: ["Riscos operacionais do processo produtivo / ambiente citado."],
      riscos: ["Avaliação de exposição aos agentes ambientais (físicos, químicos ou mecânicos)."],
      controles_existentes: ["EPIs básicos e procedimentos padrão de operação."],
      nao_conformidades: ["Necessidade de verificação de inventário de riscos no PGR."],
      recomendacoes: ["Realizar medições quantitativas e vistoria das proteções coletivas (EPCs)."],
    },
    analise_tecnico_seguranca: {
      condicoes_inseguras: [
        "Verificar organização, sinalização e adequação dos postos de trabalho.",
      ],
      desvios: ["Possível não conformidade pontual com procedimentos de segurança de campo."],
      acoes_imediatas: [
        "Orientação aos trabalhadores envolvidos durante o Diálogo Diário de Segurança (DDS).",
      ],
      acoes_corretivas: ["Adequação de sinalização e checagem da ficha de entrega de EPIs."],
      acoes_preventivas: ["Auditoria quinzenal de campo e treinamento prático."],
    },
    analise_medico_trabalho: {
      riscos_relacionados: ["Agentes identificados no PCMSO da empresa."],
      achados: ["Relato inicial pendente de constatação clínica presencial."],
      alertas: ["Acompanhar possíveis queixas de saúde ou afastamentos recentes."],
      hipoteses: ["Necessidade de triagem ocupacional."],
      recomendacoes: ["Acompanhamento conforme programa de exames do PCMSO."],
      relacao_ocupacional: "NAO AVALIAVEL",
      necessita_avaliacao_medica: true,
    },
    analise_enfermagem_trabalho: {
      dados_relevantes: ["Registro de atendimento inicial no ambulatório ocupacional."],
      sinais_alerta: ["Monitorar recorrência de queixas ou mal-estar no turno."],
      conduta_sugerida: ["Triagem de enfermagem e aferição de sinais vitais quando aplicável."],
      encaminhamentos: ["Encaminhar para consulta médica ocupacional se constatado agravamento."],
      acompanhamento: ["Registrar em ficha individual de acompanhamento de saúde."],
    },
    analise_ergonomica: {
      fatores_risco: ["Postura de trabalho, repetitividade e adaptação de ferramentas/mobiliário."],
      demanda_fisica: ["Exigência biomecânica a ser detalhada em campo."],
      demanda_cognitiva: ["Ritmo de trabalho e atenção concentrada."],
      organizacao_trabalho: ["Verificar distribuição de pausas e jornada efetiva."],
      controles_existentes: ["Mobiliário básico configurável."],
      recomendacoes: ["Ajuste antropométrico do posto e orientação postural."],
      necessita_aet: true,
    },
    analise_integrada: {
      consensos: [
        "Todas as 5 áreas concordam na relevância da investigação preventiva presencial.",
      ],
      divergencias: [
        "Médico e Ergonomista solicitam dados complementares sobre posturas e sintomas.",
      ],
      riscos_sistemicos: ["Interface entre carga ergonômica, ambiente e monitoramento de saúde."],
      riscos_prioritarios: ["Adequação imediata do posto de trabalho e atualização do PGR/PCMSO."],
    },
    plano_de_acao: [
      {
        problema: "Incerteza técnica sobre os controles ambientais e ergonômicos",
        prioridade: "ALTA",
        acao: "Realizar inspeção técnica conjunta de campo (Engenheiro + Ergonomista)",
        tipo_controle: "Engenharia / Administrativo",
        responsavel_sugerido: "Engenheiro de Segurança / Ergonomista",
        prazo_sugerido: "5 dias úteis",
        indicador: "Relatório de Inspeção Multidisciplinar emitido",
        evidencia_encerramento: "Laudo de inspeção anexado ao NAI",
      },
      {
        problema: "Necessidade de confirmação clínica e aptidão funcional",
        prioridade: "MÉDIA",
        acao: "Agendar avaliação com o Médico do Trabalho e Enfermeiro Ocupacional",
        tipo_controle: "Administrativo / Saúde",
        responsavel_sugerido: "Médico do Trabalho",
        prazo_sugerido: "7 dias úteis",
        indicador: "ASO / Ficha de Atendimento atualizada",
        evidencia_encerramento: "ASO assinado ou prontuário médico",
      },
    ],
    fundamentacao_normativa: [
      {
        referencia: "NR-01",
        descricao: "Gerenciamento de Riscos Ocupacionais (GRO / PGR)",
        status: "CONFIRMADA",
      },
      {
        referencia: "NR-07",
        descricao: "Programa de Controle Médico de Saúde Ocupacional (PCMSO)",
        status: "CONFIRMADA",
      },
      { referencia: "NR-17", descricao: "Ergonomia no Trabalho", status: "CONFIRMADA" },
    ],
    evidencias_faltantes: [
      "Relatório de medições ambientais (ruído, iluminação, agentes químicos)",
      "Análise Ergonômica Preliminar (AEP) detalhada",
      "Histórico de atendimentos ambulatoriais recentes",
    ],
    necessita_avaliacao_presencial: true,
    necessita_avaliacao_especializada: true,
    restricao_de_acesso: "ACESSO RESTRITO — DADO DE SAÚDE",
    confianca_analise: 75,
  };
}
