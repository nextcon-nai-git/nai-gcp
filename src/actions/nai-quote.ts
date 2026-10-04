"use server";

/**
 * @fileOverview Server Action para processamento de orçamentos via IA NAI.
 */

import { generateNaiQuote, DadosEmpresaInput, OrcamentoOutput } from "@/ai/flows/nai-quote-flow";
import { ActionResult } from "@/types/schema";

export async function gerarOrcamentoComNai(
  dados: DadosEmpresaInput
): Promise<ActionResult<OrcamentoOutput>> {
  try {
    // Chama o fluxo do Genkit passando os dados do formulário
    const resposta = await generateNaiQuote(dados);

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
