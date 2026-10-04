"use server";
/**
 * @fileOverview NAI Provider Intelligence - Analisador de Contratos de Credenciamento.
 * Extrai dados do prestador (Clínica/Profissional) para automação de cadastro.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const ProviderContractInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe("O arquivo do contrato em formato PDF codificado em Data URI base64."),
  fileName: z.string().optional(),
});

const ProviderContractOutputSchema = z.object({
  name: z.string().describe("Razão Social ou Nome do Profissional."),
  cnpj: z.string().describe("CNPJ ou CPF identificado (apenas números)."),
  type: z
    .enum(["CLINIC", "LAB", "DOCTOR", "HOSPITAL", "NURSE", "ENGINEER", "TECH_NURSE"])
    .describe("Tipo de prestador identificado."),
  specialty: z
    .string()
    .describe("Especialidade ou escopo principal (ex: Medicina do Trabalho, NR-10)."),
  city: z.string().describe("Cidade da sede."),
  state: z.string().describe("UF (2 letras)."),
  address: z.string().describe("Endereço completo."),
  email: z.string().optional().describe("E-mail de contato corporativo."),
  phone: z.string().optional().describe("Telefone de contato."),
  summary: z.string().describe("Resumo do acordo comercial."),
});

export type ProviderContractOutput = z.infer<typeof ProviderContractOutputSchema>;

/**
 * Função principal para análise de contrato via prompt especializado.
 */
export async function analyzeProviderContract(input: { pdfDataUri: string }) {
  const { output } = await providerPrompt(input);
  if (!output)
    throw new Error(
      "A NAI falhou ao estruturar os dados do contrato. O documento pode estar ilegível ou protegido."
    );

  // Limpeza final de CNPJ para garantir que apenas números cheguem ao sistema
  return {
    ...output,
    cnpj: output.cnpj.replace(/\D/g, ""),
  };
}

const providerPrompt = ai.definePrompt({
  name: "providerContractAnalysisPrompt",
  input: { schema: ProviderContractInputSchema },
  output: { schema: ProviderContractOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `Você é a NAI, a assistente de inteligência artificial da Nextcon, especializada em credenciamento e auditoria de contratos de saúde e segurança do trabalho.

Sua tarefa é analisar o contrato de prestação de serviços anexado e extrair os dados cadastrais do prestador (Contratada) para o nosso sistema.

INSTRUÇÕES:
1. IDENTIFICAÇÃO: Localize a Razão Social ou Nome do Profissional contratado no campo 'name'.
2. DOCUMENTO: Extraia o CNPJ ou CPF. Retorne APENAS os números (sem pontos, traços ou barras) no campo 'cnpj'.
3. CATEGORIA (type): Determine o tipo exato do prestador com base no objeto social ou conselho de classe citado:
   - 'CLINIC': Clínicas médicas, centros de exames ou empresas de medicina ocupacional.
   - 'LAB': Laboratórios de análises clínicas.
   - 'DOCTOR': Médicos pessoa física ou consultórios individuais.
   - 'ENGINEER': Engenheiros de segurança ou consultorias de engenharia de segurança.
   - 'NURSE' ou 'TECH_NURSE': Profissionais ou serviços de enfermagem.
   - 'HOSPITAL': Hospitais ou unidades de pronto atendimento.
4. LOCALIZAÇÃO: Extraia a Cidade, a UF (exatamente 2 letras) e o Endereço completo da sede.
5. CONTATO: Localize o e-mail e telefone de contato corporativo.
6. RESUMO: No campo 'summary', descreva em uma frase curta o objeto do contrato (ex: Prestação de serviços de exames complementares e emissão de ASOs).

IMPORTANTE: O retorno deve ser um JSON válido e estritamente preenchido. Se um dado opcional não for encontrado, deixe o campo como string vazia.

CONTRATO: {{media url=pdfDataUri}}`,
});

ai.defineFlow(
  {
    name: "providerContractAnalysisFlow",
    inputSchema: ProviderContractInputSchema,
    outputSchema: ProviderContractOutputSchema,
  },
  async (input) => {
    return analyzeProviderContract(input);
  }
);
