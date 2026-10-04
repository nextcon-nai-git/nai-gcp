"use server";

/**
 * @fileOverview Server Actions e Gestão de Credenciais para Prestadores de Serviço.
 */

import {
  analyzeProviderContract,
  ProviderContractOutput,
} from "@/ai/flows/provider-contract-analysis-flow";
import { ActionResult } from "@/types/schema";

export async function processarContratoPrestador(
  pdfBase64: string
): Promise<ActionResult<ProviderContractOutput>> {
  try {
    const analysis = await analyzeProviderContract({ pdfDataUri: pdfBase64 });

    return {
      sucesso: true,
      dados: analysis,
    };
  } catch (error: any) {
    console.error("Erro na análise de contrato de prestador:", error);
    return {
      sucesso: false,
      mensagem: "A NAI não conseguiu interpretar este contrato. Verifique se o PDF está legível.",
    };
  }
}
