"use server";
/**
 * @fileOverview Fluxo NAI para extração de dados estruturados de atestados médicos.
 *
 * - extractMedicalCertificate - Função que analisa o texto e extrai entidades para o eSocial.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const ExtractCertificateInputSchema = z
  .string()
  .describe("O texto bruto extraído do atestado médico (via OCR ou cópia).");

const ExtractCertificateOutputSchema = z.object({
  nomePaciente: z
    .string()
    .describe("Nome completo do paciente localizado no documento em CAIXA ALTA."),
  cid: z.string().optional().describe("Código CID-10 identificado (Ex: M54.5)."),
  diasAfastamento: z.number().describe("Quantidade de dias de repouso/afastamento recomendados."),
  dataAtestado: z.string().describe("Data de emissão do atestado no formato ISO (YYYY-MM-DD)."),
});

export type ExtractCertificateOutput = z.infer<typeof ExtractCertificateOutputSchema>;

/**
 * Função wrapper para chamar o fluxo de extração de atestados.
 */
export async function extractMedicalCertificate(
  rawText: string
): Promise<ExtractCertificateOutput> {
  return extractMedicalCertificateFlow(rawText);
}

function parseMedicalCertificateWithHeuristics(rawText: string): ExtractCertificateOutput {
  const text = rawText || "";

  // 1. Extração do Nome do Paciente
  let nomePaciente = "COLABORADOR NÃO IDENTIFICADO";
  const nameMatch = text.match(
    /(?:PACIENTE|NOME|ATESTO QUE O SR|ATESTO QUE A SRA)[:\s]+([A-ZÀ-Ú\s]{4,50})/i
  );
  if (nameMatch && nameMatch[1].trim()) {
    nomePaciente = nameMatch[1].trim().toUpperCase();
  } else {
    const lines = text.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /^[A-ZÀ-Ú]{2,}(?:\s+[A-ZÀ-Ú]{2,})+$/.test(trimmed) &&
        trimmed.length > 5 &&
        trimmed.length < 50
      ) {
        nomePaciente = trimmed;
        break;
      }
    }
  }

  // 2. Extração do CID-10
  let cid: string | undefined = undefined;
  const cidMatch = text.match(/\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/i);
  if (cidMatch) {
    cid = cidMatch[1].toUpperCase();
  }

  // 3. Dias de Afastamento
  let diasAfastamento = 1;
  const diasMatch =
    text.match(/(\d{1,3})\s*(?:dias|dia)\b/i) ||
    text.match(/(?:repouso|afastamento)\s*(?:de)?\s*(\d{1,3})/i);
  if (diasMatch && diasMatch[1]) {
    diasAfastamento = parseInt(diasMatch[1], 10);
  }

  // 4. Data do Atestado
  let dataAtestado = new Date().toISOString().split("T")[0];
  const dateMatch = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  if (dateMatch) {
    dataAtestado = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  return {
    nomePaciente,
    cid,
    diasAfastamento,
    dataAtestado,
  };
}

/**
 * Definição do fluxo Genkit para processamento de atestados médicos.
 */
const extractMedicalCertificateFlow = ai.defineFlow(
  {
    name: "extractMedicalCertificateFlow",
    inputSchema: ExtractCertificateInputSchema,
    outputSchema: ExtractCertificateOutputSchema,
  },
  async (rawText) => {
    try {
      const promptPromise = ai.generate({
        prompt: `Você é a NAI, a assistente de IA da NextCon especializada em auditoria de documentos médicos.
        Sua missão é ler o seguinte texto de um atestado médico e extrair os dados necessários para lançamento no eSocial.

        TEXTO DO ATESTADO:
        """
        ${rawText}
        """

        REGRAS:
        1. Normalize o Nome do Paciente para MAIÚSCULAS.
        2. Se o CID não estiver explícito, deixe o campo em branco (null).
        3. Extraia apenas o valor numérico dos dias de afastamento.
        4. Formate a data como YYYY-MM-DD.
        5. Seja extremamente preciso, este dado alimenta o firewall do governo.`,
        output: { schema: ExtractCertificateOutputSchema },
      });

      const timeoutPromise = new Promise<{ output: null }>((resolve) =>
        setTimeout(() => resolve({ output: null }), 2500)
      );

      const { output } = await Promise.race([promptPromise, timeoutPromise]);
      if (output && output.nomePaciente) {
        return output;
      }
    } catch (err: any) {
      console.warn(
        "⚠️ [NAI Medical Certificate Flow] API restrita ou timeout. Ativando contingência heurística:",
        err?.message || err
      );
    }

    return parseMedicalCertificateWithHeuristics(rawText);
  }
);
