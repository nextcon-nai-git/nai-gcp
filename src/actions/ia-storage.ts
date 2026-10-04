"use server";

/**
 * @fileOverview Server Action para processamento de comandos de Storage via IA.
 */

import { extractStorageData, StorageManagerOutput } from "@/ai/flows/storage-manager-flow";
import { ActionResult } from "@/types/schema";

export async function executarComandoStorage(
  comando: string
): Promise<ActionResult<StorageManagerOutput>> {
  try {
    // Chama o fluxo do Genkit para extrair metadados do prompt do usuário
    const metadata = await extractStorageData(comando);

    return {
      sucesso: true,
      dados: metadata,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro na NAI Storage:", errorMessage);
    return {
      sucesso: false,
      mensagem:
        "A NAI não conseguiu interpretar o comando. Tente incluir o nome da empresa e o CNPJ.",
    };
  }
}
