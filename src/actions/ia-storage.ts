"use server";

/**
 * @fileOverview Server Action para processamento de comandos de Storage via IA.
 */

import { extractStorageData } from "@/ai/flows/storage-manager-flow";

export async function executarComandoStorage(comando: string) {
  try {
    // Chama o fluxo do Genkit para extrair metadados do prompt do usuário
    const metadata = await extractStorageData(comando);

    return {
      sucesso: true,
      dados: metadata,
    };
  } catch (error: any) {
    console.error("Erro na NAI Storage:", error);
    return {
      sucesso: false,
      mensagem:
        "A NAI não conseguiu interpretar o comando. Tente incluir o nome da empresa e o CNPJ.",
    };
  }
}
