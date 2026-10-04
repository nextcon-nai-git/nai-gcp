"use server";
/**
 * @fileOverview Agente NAI Butler - Motor de interação autônoma com prestadores.
 * Responsável por gerar mensagens contextuais e interpretar respostas de progresso.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const MessageGeneratorInputSchema = z.object({
  providerName: z.string().describe("Nome do prestador/especialista."),
  taskTitle: z.string().describe("Título da tarefa no Kanban."),
  deadline: z.string().describe("Data de entrega."),
  pendingItems: z.array(z.string()).describe("Lista de itens pendentes no checklist."),
});

const MessageGeneratorOutputSchema = z.object({
  whatsappMessage: z.string().describe("Mensagem amigável para enviar via WhatsApp."),
});

const ResponseInterpreterInputSchema = z.object({
  providerResponse: z.string().describe("O texto que o prestador respondeu."),
  pendingItems: z.array(z.string()).describe("Itens que estavam pendentes."),
});

const ResponseInterpreterOutputSchema = z.object({
  completedItemsIndices: z
    .array(z.number())
    .describe("Índices dos itens que a IA entendeu que foram concluídos."),
  feedback: z.string().describe("Uma resposta de agradecimento ou esclarecimento."),
});

/**
 * Gera a mensagem de acompanhamento diário.
 */
export const generateButlerFollowUp = ai.defineFlow(
  {
    name: "generateButlerFollowUp",
    inputSchema: MessageGeneratorInputSchema,
    outputSchema: MessageGeneratorOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Você é a NAI, assistente técnica da Nextcon.
      Sua tarefa é enviar uma mensagem de acompanhamento (follow-up) para o especialista {{{providerName}}} 
      sobre a tarefa "{{{taskTitle}}}" que tem prazo para {{{deadline}}}.
      
      ITENS PENDENTES:
      {{#each pendingItems}}
      - {{this}}
      {{/each}}
      
      INSTRUÇÕES:
      1. Seja profissional, mas amigável e direta.
      2. Pergunte especificamente sobre os itens pendentes.
      3. Use um tom de suporte, não apenas cobrança.
      4. Mencione que ele pode responder por aqui para atualizar o sistema.`,
      output: { schema: MessageGeneratorOutputSchema },
    });

    if (!output) throw new Error("Falha ao gerar mensagem do Butler.");
    return output;
  }
);

/**
 * Interpreta a resposta do prestador.
 */
export const interpretProviderResponse = ai.defineFlow(
  {
    name: "interpretProviderResponse",
    inputSchema: ResponseInterpreterInputSchema,
    outputSchema: ResponseInterpreterOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Você é a NAI. Um prestador enviou a seguinte mensagem sobre suas tarefas:
      
      RESPOSTA DO PRESTADOR:
      "{{{providerResponse}}}"
      
      ITENS QUE ESTAVAM PENDENTES:
      {{#each pendingItems}}
      {{@index}}. {{this}}
      {{/each}}
      
      INSTRUÇÕES:
      1. Identifique se na resposta ele confirmou a conclusão de algum item.
      2. Retorne o índice (0, 1, 2...) do item no campo 'completedItemsIndices'.
      3. Se ele disse apenas "sim", assuma que todos os pendentes citados foram feitos.
      4. Gere um feedback de confirmação amigável.`,
      output: { schema: ResponseInterpreterOutputSchema },
    });

    if (!output) throw new Error("Falha ao interpretar resposta do prestador.");
    return output;
  }
);
