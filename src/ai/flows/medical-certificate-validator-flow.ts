"use server";

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { forbidden } from "@/lib/auth/errors";

const ValidatorInputSchema = z.object({
  fileDataUri: z.string().describe("O arquivo (PDF ou Imagem) codificado em Base64."),
  fileName: z.string().optional(),
});
export type ValidatorInput = z.infer<typeof ValidatorInputSchema>;

const ValidatorOutputSchema = z.object({
  authenticity: z
    .enum(["legitimate", "suspicious", "forged", "inconclusive"])
    .describe("Classificação de autenticidade."),
  confidence: z.number().min(0).max(100).describe("Nível de confiança (0-100)."),
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

export async function validateMedicalCertificate(
  input: ValidatorInput & { idToken?: string }
): Promise<ValidatorOutput> {
  const user = await requireAuth(
    new NextRequest("https://nai.local/action", {
      headers: { authorization: `Bearer ${input.idToken || ""}` },
    })
  );
  if (
    !["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "PROVIDER"].includes(
      user.role
    )
  )
    throw forbidden("Seu perfil não pode analisar documentos clínicos.");
  const payload = ValidatorInputSchema.parse(input);
  if (
    payload.fileDataUri.length > 14_000_000 ||
    !/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/.test(payload.fileDataUri)
  )
    throw new Error("Envie PDF ou imagem de até 10 MB.");
  return validatorFlow(payload);
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
- Forged: Sinais visuais de adulteração que exigem confirmação humana.
- Inconclusive: Documento ilegível, análise incompleta ou evidência insuficiente.
Não invente nomes, CRM, datas, CID ou clínicas. Não afirme ter consultado registros externos. Uma análise visual não confirma autenticidade nem substitui a revisão humana.

IMPORTANTE:
- Retorne SEMPRE o objeto JSON completo.
- Se não encontrar pontos suspeitos, o campo 'redFlags' DEVE ser um array vazio [].
- No campo 'reasoning', forneça uma análise técnica e objetiva.
- Limpe os textos extraídos removendo quebras de linha excessivas ou espaços duplos.

Documento: {{media url=fileDataUri}}`,
});

function inconclusiveCertificate(): ValidatorOutput {
  return {
    authenticity: "inconclusive",
    confidence: 0,
    extractedData: {},
    redFlags: [],
    reasoning:
      "A análise automática não pôde ser concluída. Encaminhe o documento para revisão humana; a autenticidade e os dados médicos não foram confirmados.",
  };
}

const validatorFlow = ai.defineFlow(
  {
    name: "medicalCertificateValidatorFlow",
    inputSchema: ValidatorInputSchema,
    outputSchema: ValidatorOutputSchema,
  },
  async (input) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const promptPromise = prompt(input);
      const timeoutPromise = new Promise<{ output: null }>((resolve) => {
        timeout = setTimeout(() => resolve({ output: null }), 30_000);
      });

      const { output } = await Promise.race([promptPromise, timeoutPromise]);
      const parsed = ValidatorOutputSchema.safeParse(output);
      if (parsed.success) {
        const output = parsed.data;
        return {
          ...output,
          extractedData: {
            ...output.extractedData,
            patientName: output.extractedData.patientName?.replace(/\n+/g, " ").trim(),
            doctorName: output.extractedData.doctorName?.replace(/\n+/g, " ").trim(),
            clinicName: output.extractedData.clinicName?.replace(/\n+/g, " ").trim(),
          },
        };
      }
    } catch (err: unknown) {
      console.warn(
        "[NAI Medical Certificate Validator] Análise indisponível; revisão humana necessária.",
        { kind: err instanceof Error ? err.name : "ProviderError" }
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    return inconclusiveCertificate();
  }
);
