"use server";
/**
 * @fileOverview NAI Data Architect - Especialista em extração de inteligência GRO/PGR (NR-01).
 * Converte entradas brutas em documentos NoSQL padronizados para o Cloud Firestore.
 *
 * - architectPgrData: Função principal de processamento.
 * - ArchitectInput: Texto ou descrição do ambiente/perigo.
 * - ArchitectOutput: JSON estruturado conforme matriz de risco NR-01.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ArchitectInputSchema = z.object({
  rawInput: z.string().describe("Descrição do perigo, ambiente de trabalho ou medida de controle."),
});
export type ArchitectInput = z.infer<typeof ArchitectInputSchema>;

const ArchitectOutputSchema = z.object({
  inventario: z.object({
    setor: z.string().describe("Setor ou GHE identificado."),
    perigo: z.string().describe("O perigo identificado."),
    risco_associado: z.string().describe("O risco resultante da exposição ao perigo."),
    categoria: z.enum(["Físico", "Químico", "Biológico", "Ergonômico", "Acidente"]),
    avaliacao: z.object({
      probabilidade: z.number().min(1).max(5).describe("Probabilidade (1 a 5)."),
      severidade: z.number().min(1).max(5).describe("Severidade (1 a 5)."),
      nivel_final: z.number().describe("Resultado de Probabilidade x Severidade."),
      prioridade: z.enum(["Crítico", "Substancial", "Moderado", "Tolerável"]),
    }),
  }),
  plano_acao_sugerido: z.array(
    z.object({
      medida: z.string().describe("Medida de controle sugerida."),
      tipo: z.enum(["EPC", "EPI", "Adm"]),
      prazo_sugerido_dias: z.number(),
    })
  ),
});
export type ArchitectOutput = z.infer<typeof ArchitectOutputSchema>;

/**
 * Wrapper para chamar o fluxo de arquitetura de dados PGR.
 */
export async function architectPgrData(input: ArchitectInput): Promise<ArchitectOutput> {
  return architectPgrDataFlow(input);
}

const prompt = ai.definePrompt({
  name: "pgrDataArchitectPrompt",
  input: { schema: ArchitectInputSchema },
  output: { schema: ArchitectOutputSchema },
  prompt: `Você é um Arquiteto de Dados SST sênior especializado em legislação brasileira (NR-01).
Sua missão é extrair inteligência do seguinte texto e convertê-lo em um formato JSON rigoroso para o Cloud Firestore.

TEXTO DE ENTRADA:
"""
{{{rawInput}}}
"""

REGRAS DE NEGÓCIO (NR-01):
1. IDENTIFICAÇÃO: Extraia o perigo, o risco e a categoria técnica correta.
2. MATRIZ DE RISCO:
   - Atribua Probabilidade (1-5) e Severidade (1-5) baseada na descrição.
   - Nível Final = Probabilidade * Severidade.
3. CLASSIFICAÇÃO:
   - Nível > 15: "Crítico"
   - Nível > 10: "Substancial"
   - Nível > 6: "Moderado"
   - Nível <= 6: "Tolerável"
4. PLANO DE AÇÃO:
   - Gere medidas baseadas na hierarquia: EPC primeiro, Adm depois, EPI por último.
   - Defina prazos realistas (ex: EPC 30-60 dias, EPI imediato).

Retorne estritamente o JSON conforme o esquema solicitado. Se a informação estiver incompleta, use sua expertise de engenharia para preencher com valores padrão seguros.`,
});

const architectPgrDataFlow = ai.defineFlow(
  {
    name: "pgrDataArchitectFlow",
    inputSchema: ArchitectInputSchema,
    outputSchema: ArchitectOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu arquitetar os dados deste registro.");
    return output;
  }
);
