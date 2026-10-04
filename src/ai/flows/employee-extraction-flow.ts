"use server";
/**
 * @fileOverview Fluxo NAI para extração de dados de funcionários a partir de texto bruto.
 * Permite importar dados de clientes sem necessidade de integração direta com eSocial/Certificado.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const EmployeeExtractionInputSchema = z.object({
  rawText: z.string().describe("O texto bruto copiado de um PDF, Excel ou documento de RH."),
});

const EmployeeExtractionOutputSchema = z.object({
  employees: z.array(
    z.object({
      name: z.string().describe("Nome completo do colaborador."),
      cpf: z.string().describe("CPF formatado (000.000.000-00)."),
      jobTitle: z.string().describe("Cargo ou função identificada."),
    })
  ),
  count: z.number().describe("Quantidade de registros localizados."),
  qualityScore: z.number().describe("Score de confiança da extração (0-100)."),
});

export type EmployeeExtractionOutput = z.infer<typeof EmployeeExtractionOutputSchema>;

export async function extractEmployeesFromText(input: {
  rawText: string;
}): Promise<EmployeeExtractionOutput> {
  return employeeExtractionFlow(input);
}

const prompt = ai.definePrompt({
  name: "employeeExtractionPrompt",
  input: { schema: EmployeeExtractionInputSchema },
  output: { schema: EmployeeExtractionOutputSchema },
  prompt: `Você é a NAI, assistente de inteligência da Nextcon especializada em processamento de dados de RH.
Sua missão é extrair uma lista de funcionários do texto abaixo.

TEXTO BRUTO:
{{{rawText}}}

INSTRUÇÕES:
1. Identifique Nomes, CPFs e Cargos.
2. Formate o CPF sempre com pontos e traço (XXX.XXX.XXX-XX).
3. Se o CPF estiver incompleto ou ausente, tente inferir pelo contexto ou deixe o campo vazio.
4. Normalize os nomes para CAIXA ALTA.
5. Ignore cabeçalhos, rodapés ou textos que não sejam dados de colaboradores.`,
});

const employeeExtractionFlow = ai.defineFlow(
  {
    name: "employeeExtractionFlow",
    inputSchema: EmployeeExtractionInputSchema,
    outputSchema: EmployeeExtractionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu localizar dados válidos neste texto.");
    return output;
  }
);
