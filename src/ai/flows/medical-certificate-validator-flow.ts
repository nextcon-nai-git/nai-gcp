"use server";

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ValidatorInputSchema = z.object({
  fileDataUri: z.string().describe("O arquivo (PDF ou Imagem) codificado em Base64."),
  fileName: z.string().optional(),
});
export type ValidatorInput = z.infer<typeof ValidatorInputSchema>;

const ValidatorOutputSchema = z.object({
  authenticity: z
    .enum(["legitimate", "suspicious", "forged"])
    .describe("Classificação de autenticidade."),
  confidence: z.number().describe("Nível de confiança (0-100)."),
  extractedData: z.object({
    patientName: z.string().optional(),
    doctorName: z.string().optional(),
    crm: z.string().optional(),
    date: z.string().optional(),
    cid: z.string().optional(),
    clinicName: z.string().optional(),
  }),
  redFlags: z
    .array(z.string())
    .describe("Lista de pontos suspeitos encontrados. Se nenhum for encontrado, retorne []."),
  reasoning: z.string().describe("Explicação detalhada da análise forense."),
});
export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

export async function validateMedicalCertificate(input: ValidatorInput): Promise<ValidatorOutput> {
  return validatorFlow(input);
}

const prompt = ai.definePrompt({
  name: "medicalCertificateValidatorPrompt",
  input: { schema: ValidatorInputSchema },
  output: { schema: ValidatorOutputSchema },
  prompt: `Você é a NAI, perita forense digital da NextCon Saúde Empresarial.
Sua missão é analisar o atestado médico em anexo e identificar sinais de fraude ou inconsistência técnica.

ANALISE OS SEGUINTES PONTOS CRÍTICOS:
1. Fontes e Alinhamento: Verifique se existem letras com fontes diferentes no mesmo campo ou texto desalinhado.
2. Carimbos e Assinaturas: Identifique se o carimbo parece recortado ou se a assinatura apresenta pixels suspeitos (artefatos digitais).
3. Dados Médicos: O CRM informado deve ser compatível com o nome do médico. O CID deve fazer sentido para o tempo de afastamento.
4. Estrutura Visual: Procure por bordas ou sombras que indiquem montagem digital (copy-paste).

REGRAS DE CLASSIFICAÇÃO:
- Legitimate: Sem sinais óbvios de adulteração.
- Suspicious: Pequenas inconsistências ou dados que não cruzam 100%.
- Forged: Sinais claros de fraude (fontes diferentes, montagem visual óbvia, CRM inexistente).

IMPORTANTE:
- Retorne SEMPRE o objeto JSON completo.
- Se não encontrar pontos suspeitos, o campo 'redFlags' DEVE ser um array vazio [].
- No campo 'reasoning', forneça uma análise técnica e objetiva.
- Limpe os textos extraídos removendo quebras de linha excessivas ou espaços duplos.

Documento: {{media url=fileDataUri}}`,
});

const validatorFlow = ai.defineFlow(
  {
    name: "medicalCertificateValidatorFlow",
    inputSchema: ValidatorInputSchema,
    outputSchema: ValidatorOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu processar este documento agora.");

    // Sanitização de saída para evitar erros de validação de esquema
    return {
      ...output,
      redFlags: output.redFlags || [],
      reasoning: output.reasoning || "Análise concluída sem observações adicionais.",
      extractedData: {
        ...output.extractedData,
        patientName:
          output.extractedData?.patientName?.replace(/\n+/g, " ").trim() || "Não identificado",
        doctorName:
          output.extractedData?.doctorName?.replace(/\n+/g, " ").trim() || "Não identificado",
        clinicName:
          output.extractedData?.clinicName?.replace(/\n+/g, " ").trim() || "Não identificado",
      },
    } as ValidatorOutput;
  }
);
