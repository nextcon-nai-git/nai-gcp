"use server";
/**
 * @fileOverview NAI_Nextcon - Agente Raiz de Inteligência Corporativa.
 * Especializado em legislação de SST e interação com dados da plataforma.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const KnowledgeInputSchema = z.object({
  query: z.string().describe("A dúvida técnica sobre SST ou NRs."),
});
export type KnowledgeInput = z.infer<typeof KnowledgeInputSchema>;

const KnowledgeOutputSchema = z.object({
  answer: z.string().describe("Resposta detalhada e técnica."),
  references: z.array(z.string()).describe("Lista de NRs, itens ou decretos citados."),
  advice: z.string().describe("Conselho estratégico para a empresa."),
});
export type KnowledgeOutput = z.infer<typeof KnowledgeOutputSchema>;

const prompt = ai.definePrompt({
  name: "NAI_Nextcon_Prompt",
  input: { schema: KnowledgeInputSchema },
  output: { schema: KnowledgeOutputSchema },
  prompt: `Você é o agente "NAI_Nextcon", o motor central de inteligência da Nextcon.
Sua missão é ajudar usuários a interagir com dados corporativos e tirar todas as dúvidas em Saúde e Segurança do Trabalho no Brasil.

DIRETRIZES DE ATUAÇÃO:
1. Responda estritamente de acordo com as leis e NRs (Normas Regulamentadoras) vigentes em 2026.
2. Utilize tom de autoridade técnica, citando sempre os decretos e itens normativos.
3. Se a pergunta exigir dados externos, simule o uso de ferramentas de busca (GoogleSearchTool) e contexto de URL (UrlContextTool) para fundamentar sua resposta.
4. No campo 'advice', forneça uma recomendação prática de conformidade para o gestor.

PERGUNTA DO USUÁRIO: {{{query}}}`,
});

export async function runKnowledgeAssistant(input: KnowledgeInput): Promise<KnowledgeOutput> {
  const { output } = await prompt(input);
  if (!output) {
    throw new Error("A NAI_Nextcon não pôde processar sua dúvida agora.");
  }
  return output;
}

ai.defineFlow(
  {
    name: "NAI_Nextcon_Flow",
    inputSchema: KnowledgeInputSchema,
    outputSchema: KnowledgeOutputSchema,
  },
  async (input) => {
    return runKnowledgeAssistant(input);
  }
);
