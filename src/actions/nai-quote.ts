"use server";

/**
 * @fileOverview Server Action para processamento de orçamentos via IA NAI.
 */

import { generateNaiQuote, type DadosEmpresaInput } from "@/ai/flows/nai-quote-flow";

export async function gerarOrcamentoComNai(dados: DadosEmpresaInput) {
  try {
    // Chama o fluxo do Genkit passando os dados do formulário
    const resposta = await generateNaiQuote(dados);

    return {
      sucesso: true,
      orcamento: resposta,
    };
  } catch (error: any) {
    console.error("Erro na NAI:", error);
    return {
      sucesso: false,
      mensagem:
        "A NAI teve um problema ao processar o orçamento. Tente novamente ou verifique os dados informados.",
    };
  }
}
