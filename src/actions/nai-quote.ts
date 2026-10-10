"use server";
import { requireAiAction, FINANCIAL_AI_ROLES } from "@/lib/auth/ai-action";

/**
 * @fileOverview Server Action para processamento de orçamentos via IA NAI.
 */

import { generateNaiQuote, DadosEmpresaInput, OrcamentoOutput } from "@/ai/flows/nai-quote-flow";
import { ActionResult } from "@/types/schema";

export async function gerarOrcamentoComNai(
  dados: DadosEmpresaInput,
  idToken?: string
): Promise<ActionResult<OrcamentoOutput>> {
  await requireAiAction(idToken, FINANCIAL_AI_ROLES, [dados]);

  try {
    // Chama o fluxo do Genkit passando os dados do formulário
    const resposta = await generateNaiQuote(dados, idToken);

    return {
      sucesso: true,
      orcamento: resposta,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro na NAI:", errorMessage);
    return {
      sucesso: false,
      mensagem:
        "A NAI teve um problema ao processar o orçamento. Tente novamente ou verifique os dados informados.",
    };
  }
}
