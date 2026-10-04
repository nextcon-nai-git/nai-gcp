"use server";
/**
 * @fileOverview NAI Real-time Fiscal Engine.
 * Responsável por decompor documentos fiscais e calcular impostos instantaneamente.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const FiscalDocInputSchema = z.object({
  serviceDescription: z.string().describe("Descrição textual do serviço prestado na nota."),
  value: z.number().describe("Valor bruto da nota fiscal."),
  regime: z
    .enum(["MEI", "SIMPLES_NACIONAL", "LUCRO_PRESUMIDO"])
    .describe("Regime tributário do cliente."),
  location: z.string().describe("Município e Estado para cálculo de ISS."),
  isOmieSync: z.boolean().optional().describe("Flag indicando que o dado vem do Omie ERP."),
  origin: z.enum(["PORTAL_NACIONAL", "PREFEITURA", "OMIE_ERP", "UPLOAD"]).optional(),
});

const FiscalDocOutputSchema = z.object({
  annex: z.string().optional().describe("Anexo do Simples Nacional sugerido (I a V)."),
  taxBreakdown: z.object({
    iss: z.number().describe("Valor do ISS."),
    pis: z.number().optional(),
    cofins: z.number().optional(),
    csll: z.number().optional(),
    irpj: z.number().optional(),
    das: z.number().optional(),
    ibs: z.number().optional().describe("Novo imposto de 2026"),
    cbs: z.number().optional().describe("Novo imposto de 2026"),
    retentions: z.number().describe("Total de retenções na fonte."),
  }),
  accountingNote: z.string().describe("Memória de cálculo e fundamentação legal para auditoria."),
  netValue: z.number().describe("Valor líquido após impostos e retenções."),
  isAutoApproved: z.boolean().describe("Se a IA aprovou a escrituração automática sem revisão."),
});

export type FiscalDocOutput = z.infer<typeof FiscalDocOutputSchema>;

export async function processFiscalDocument(
  input: z.infer<typeof FiscalDocInputSchema>
): Promise<FiscalDocOutput> {
  const { output } = await fiscalPrompt(input);
  if (!output) throw new Error("Falha no motor de apuração fiscal.");
  return output;
}

const fiscalPrompt = ai.definePrompt({
  name: "realTimeFiscalPrompt",
  input: { schema: FiscalDocInputSchema },
  output: { schema: FiscalDocOutputSchema },
  prompt: `Você é a NAI, contadora especialista em tributação de serviços e Reforma Tributária 2026.
Sua missão é escriturar a seguinte operação fiscal e gerar a MEMÓRIA DE CÁLCULO detalhada:

SERVIÇO: {{{serviceDescription}}}
VALOR BRUTO: R$ {{{value}}}
REGIME: {{{regime}}}
LOCAL: {{{location}}}
ORIGEM: {{{origin}}}

INSTRUÇÕES 2026:
1. Se for SIMPLES NACIONAL, identifique o Anexo correto (geralmente Anexo III para SST ou V se houver fator R).
2. Se for LUCRO PRESUMIDO, calcule: ISS (conforme cidade), PIS (0,65%), COFINS (3%), CSLL (1,08% ou 2,88%) e IRPJ (1,2% ou 4,8% base presunção).
3. REFORMA TRIBUTÁRIA: Calcule IBS (0,1%) e CBS (0,9%) para provisão/crédito de 2026.
4. Verifique retenções na fonte (Lei 10.833).
5. Na 'accountingNote', escreva uma memória de cálculo detalhada: "Base de R$ X, Alíquota Y%, Resultando em R$ Z". Mencione a base legal.
6. Se a descrição do serviço for clara e o regime estiver correto, defina 'isAutoApproved' como true.

Retorne apenas o JSON estruturado para escrituração automática, REINF e DCTF Web.`,
});

ai.defineFlow(
  {
    name: "realTimeFiscalFlow",
    inputSchema: FiscalDocInputSchema,
    outputSchema: FiscalDocOutputSchema,
  },
  async (input) => {
    return processFiscalDocument(input);
  }
);
