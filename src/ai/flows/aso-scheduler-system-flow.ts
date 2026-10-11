/**
 * @fileOverview Motor Integrado de IA dos 7 Agentes do Sistema Agendador de ASO + Montador de Kits (NAI)
 * Módulos: Triagem, Protocolos, Agendamento, Montagem de Kit, Comunicação, Follow-up e Supervisor.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

export const AsoSystemOrchestratorInputSchema = z.object({
  userPrompt: z.string().describe("Instrução ou descrição da solicitação de ASO/Exames."),
  companyName: z.string().optional(),
  cnpj: z.string().optional(),
  employeeName: z.string().optional(),
  cpf: z.string().optional(),
  roleTitle: z.string().optional(),
  department: z.string().optional(),
  examType: z
    .enum(["admissional", "periodico", "demissional", "retorno_trabalho", "mudanca_funcao"])
    .optional(),
  declaredRisks: z.array(z.string()).optional(),
  selectedClinicId: z.string().optional(),
});

export type AsoSystemOrchestratorInput = z.infer<typeof AsoSystemOrchestratorInputSchema>;

export const AsoSystemOrchestratorOutputSchema = z.object({
  triagem: z.object({
    valido: z.boolean(),
    dados_faltantes: z.array(z.string()),
    observacoes_triagem: z.string(),
  }),
  protocolos: z.object({
    tipo_aso_confirmado: z.string(),
    exames_obrigatorios: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        mandatory: z.enum(["OBRIGATORIO", "RECOMENDADO", "CONDICIONAL"]),
        pcmsoJustification: z.string(),
        patientPreparo: z.string(),
      })
    ),
    justificativa_normativa: z.string(),
  }),
  agendamento_matching: z.object({
    clinica_recomendada_id: z.string(),
    clinica_recomendada_nome: z.string(),
    score_compatibilidade: z.number().min(0).max(100),
    motivo_escolha: z.string(),
    horarios_sugeridos: z.array(z.string()),
  }),
  kit_digital: z.object({
    guia_numero: z.string(),
    instrucoes_paciente: z.array(z.string()),
    instrucoes_clinica: z.array(z.string()),
    prazo_devolucao_dias: z.number(),
    preparacao_impressao_pronta: z.boolean(),
  }),
  comunicacao: z.object({
    mensagem_trabalhador_whatsapp: z.string(),
    email_clinica_parceira: z.string(),
  }),
  followup: z.object({
    status_inicial_pipeline: z.string(),
    proxima_acao_automática: z.string(),
  }),
  supervisor: z.object({
    requer_intervencao_humana: z.boolean(),
    severidade_alerta: z.enum(["NONE", "INFO", "WARNING", "CRITICAL"]),
    mensagem_alerta: z.string(),
    acao_recomendada: z.string(),
  }),
});

export type AsoSystemOrchestratorOutput = z.infer<typeof AsoSystemOrchestratorOutputSchema>;

export async function processAsoSystemOrchestration(
  input: AsoSystemOrchestratorInput
): Promise<AsoSystemOrchestratorOutput> {
  const prompt = `Você é o Orquestrador Mestre de IA do Sistema Agendador de ASO e Montador de Kits de Clínicas (NAI).
Analise a solicitação sob a atuação dos 7 Agentes Especializados:
1. Triagem (validação de dados).
2. Protocolos PCMSO (exames para a função/riscos).
3. Agendamento (Scoring da melhor clínica).
4. Montador de Kit (Guia e instruções).
5. Comunicação (Notificações).
6. Follow-up (Pipeline).
7. Supervisor (Alertas e Exceções).

DADOS DA SOLICITAÇÃO:
- Empresa: ${input.companyName || "Empresa Cliente NAI"} (CNPJ: ${input.cnpj || "Não informado"})
- Trabalhador: ${input.employeeName || "Trabalhador Indicado"} (CPF: ${input.cpf || "Não informado"})
- Cargo: ${input.roleTitle || "Não informado"} (Setor: ${input.department || "Não informado"})
- Tipo ASO: ${input.examType || "admissional"}
- Riscos Declarados: ${input.declaredRisks?.join(", ") || "Não informados"}
- Instrução Adicional: "${input.userPrompt}"

Não invente clínicas, horários, riscos, identificadores ou protocolos. Sem PCMSO documentado, sinalize dados faltantes. Não afirme que agendou, enviou mensagens, validou aptidão ou confirmou exames. Produza apenas sugestões para revisão profissional. Retorne a análise estruturada no JSON Schema.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await ai.generate({
      prompt,
      output: { schema: AsoSystemOrchestratorOutputSchema },
      abortSignal: controller.signal,
    });
    const result = AsoSystemOrchestratorOutputSchema.parse(response.output);
    return {
      ...result,
      kit_digital: { ...result.kit_digital, preparacao_impressao_pronta: false },
      followup: {
        ...result.followup,
        status_inicial_pipeline: "pendente_revisao",
        proxima_acao_automática: "Conferir PCMSO e confirmar disponibilidade com a clínica.",
      },
      supervisor: {
        ...result.supervisor,
        requer_intervencao_humana: true,
        severidade_alerta: "WARNING",
        mensagem_alerta:
          "Sugestão de IA: requer conferência profissional e confirmação da clínica.",
      },
    };
  } catch {
    throw new Error(
      "A IA de agendamento não concluiu a análise. Nenhum agendamento ou protocolo foi confirmado."
    );
  } finally {
    clearTimeout(timeout);
  }
}
