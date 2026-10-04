"use server";
/**
 * @fileOverview NAI Storage Manager - Inteligência para organização de arquivos conforme a nova hierarquia.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const StorageManagerInputSchema = z
  .string()
  .describe(
    "Comando para criação de pasta ou organização de arquivos. Ex: 'Crie a pasta do PGR para o cliente Britânia, CNPJ 76.492.701/0011-29'"
  );

const StorageManagerOutputSchema = z.object({
  idEmpresa: z.string().describe("O CNPJ limpo ou ID da empresa."),
  nomeEmpresa: z.string().describe("Nome amigável da empresa."),
  docType: z
    .enum([
      "nr01_pgr",
      "nr04_sesmt",
      "nr05_cipa",
      "nr06_epis",
      "nr07_pcmso",
      "nr17_ergo",
      "docs_legais",
      "afastados",
      "fap",
      "pericias",
    ])
    .describe("O tipo de pasta técnica."),
  caminhoStorage: z.string().describe("O caminho completo seguindo a hierarquia oficial."),
  placeholderContent: z.string().describe("Conteúdo inicial para o arquivo de metadados."),
});

export type StorageManagerOutput = z.infer<typeof StorageManagerOutputSchema>;

const prompt = ai.definePrompt({
  name: "storageManagerPrompt",
  input: { schema: z.object({ query: z.string() }) },
  output: { schema: StorageManagerOutputSchema },
  prompt: `Você é a NAI, arquivista digital de elite da Nextcon. Sua tarefa é organizar o Storage seguindo a hierarquia oficial.

HIERARQUIA:
- PGR -> clientes/{{idEmpresa}}/sst_nrs/nr01_pgr/
- PCMSO -> clientes/{{idEmpresa}}/sst_nrs/nr07_pcmso/
- EPIs -> clientes/{{idEmpresa}}/sst_nrs/nr06_epis/
- Atestados/Afastados -> clientes/{{idEmpresa}}/saude_gestao/afastados/
- Contratos/CNPJ -> clientes/{{idEmpresa}}/docs_legais/

SOLICITAÇÃO: {{{query}}}

INSTRUÇÕES:
1. Extraia o CNPJ e limpe-o (mantenha apenas números). Use-o como 'idEmpresa'.
2. Identifique o nome da empresa.
3. Determine o 'docType' correto com base na solicitação.
4. Construa o 'caminhoStorage' usando o padrão solicitado (ex: clientes/ID/subpasta/_readme.txt).
5. No 'placeholderContent', crie uma nota técnica em português informando que a pasta foi provisionada pela NAI para auditoria SESMT.`,
});

export async function extractStorageData(query: string): Promise<StorageManagerOutput> {
  const { output } = await prompt({ query });
  if (!output) throw new Error("A NAI não conseguiu interpretar os dados para a nova hierarquia.");
  return output;
}

ai.defineFlow(
  {
    name: "storageManagerFlow",
    inputSchema: StorageManagerInputSchema,
    outputSchema: StorageManagerOutputSchema,
  },
  async (input) => {
    return extractStorageData(input);
  }
);
