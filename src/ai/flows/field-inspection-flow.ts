"use server";
import { requireAiAction, DOCUMENT_AI_ROLES } from "@/lib/auth/ai-action";

/**
 * @fileOverview NAI Field Inspection Flow - Powered by Gemini 3.8 Flash
 * Analisa fotografias ou vídeos do canteiro de obras / chão de fábrica tiradas pelo iPhone.
 * Identifica não-conformidades de EPIs (NR-06), Trabalho em Altura (NR-35),
 * Instalações Provisórias e Andaimes (NR-18) e Riscos Elétricos (NR-10).
 * Gera relatório fotográfico com classificação de severidade e Plano de Ação 5W2H imediato.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

export const ActionItem5W2HSchema = z.object({
  what: z.string().describe("O que deve ser feito (ação corretiva imediata)."),
  why: z.string().describe("Por que deve ser feito (embasamento na NR e eliminação do perigo)."),
  who: z
    .string()
    .describe("Quem é o responsável (ex: Encarregado da Obra, Técnico de Segurança, Eletricista)."),
  where: z.string().describe("Onde deve ser executado no local da foto."),
  when: z.string().describe("Prazo recomendado (ex: Imediato, 24 horas, 48 horas)."),
  how: z.string().describe("Como deve ser executado tecnicamente."),
});

export const InspectionFindingSchema = z.object({
  id: z.string(),
  category: z.enum([
    "NR_06_EPI",
    "NR_35_ALTURA",
    "NR_18_CANTEIRO",
    "NR_10_ELETRICA",
    "NR_12_MAQUINAS",
    "OUTROS",
  ]),
  title: z.string(),
  description: z.string().describe("Detalhamento do que foi visualizado na imagem."),
  severity: z.enum(["LEVE", "GRAVE", "RISCO_IMINENTE"]),
  applicableStandard: z
    .string()
    .describe("Norma Regulamentadora e item específico (ex: NR-35 item 35.5.1)."),
  status: z.enum(["NAO_CONFORME", "CONFORME", "OBSERVACAO"]),
  actionPlan: ActionItem5W2HSchema,
});

export const FieldInspectionReportSchema = z.object({
  inspectionTitle: z.string(),
  inspectionDate: z.string(),
  locationDetected: z
    .string()
    .describe(
      "Ambiente identificado na foto (ex: Fachada do Edifício, Canteiro de Obras, Galpão de Solda)."
    ),
  overallSafetyStatus: z.enum(["SEGURO", "ATENCAO", "INTERDICAO_RECOMENDADA"]),
  safetyIndex: z.number().describe("Índice de segurança de 0 a 100."),
  detectedWorkersCount: z.number().describe("Quantidade aproximada de trabalhadores visualizados."),
  findings: z.array(InspectionFindingSchema),
  executiveSummary: z.string().describe("Síntese pericial da imagem pelo Gemini 3.8."),
  gpsLocation: z
    .string()
    .optional()
    .describe("Coordenadas GPS ou endereço georreferenciado da vistoria."),
  deviceSource: z.string().optional().describe("Dispositivo de captura (Android, iPhone ou Web)."),
});

export type FieldInspectionReport = z.infer<typeof FieldInspectionReportSchema>;

export async function analyzeFieldInspectionPhoto(
  input: {
    imageBase64?: string;
    notes?: string;
    companyName?: string;
    location?: string;
    gpsCoordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    devicePlatform?: "Android" | "iOS" | "Desktop";
  },
  idToken?: string
): Promise<FieldInspectionReport> {
  await requireAiAction(idToken, DOCUMENT_AI_ROLES, [input]);

  const promptText = `Você é o Engenheiro Perito de Segurança do Trabalho com Visão Computacional da plataforma NAI (NextCon Intelligence).
Você analisa imagens tiradas por técnicos de segurança em canteiros de obras ou indústrias através de smartphones (Android ou iPhone).

SEUS PARÂMETROS DE AVALIAÇÃO:
1. NR-06 (EPI): Trabalhadores usando capacete de segurança (com jugular ajustada), óculos de proteção contra impactos/radiação, protetor auditivo, calçado de segurança com bico e luvas compatíveis.
2. NR-35 (Trabalho em Altura): Trabalhadores a mais de 2 metros sem ponto de ancoragem, sem cinto tipo paraquedista ou com talabarte desconectado da linha de vida. Risco de queda é sempre classificado como RISCO_IMINENTE.
3. NR-18 (Construção Civil): Proteção periférica de lajes, guarda-corpos, tela de proteção, organização, entulho em vias de circulação e andaimes travados.
4. NR-10 (Segurança em Eletricidade): Cabos elétricos no chão empoçado, quadros de distribuição abertos ou fiações desprotegidas.

Gere para CADA não-conformidade identificada um PLANO DE AÇÃO 5W2H completo e objetivo.`;

  try {
    const contents: any[] = [{ text: promptText }];

    if (input.imageBase64) {
      contents.push({
        media: { url: input.imageBase64 },
      });
    }

    const contextParts: string[] = [
      `Empresa: "${input.companyName || "Construfam"}".`,
      `Local informado: "${input.location || "Canteiro de Obras"}".`,
    ];

    if (input.notes) {
      contextParts.push(`Observações adicionais do técnico: "${input.notes}".`);
    }

    if (input.devicePlatform) {
      contextParts.push(`Dispositivo de campo: "${input.devicePlatform}".`);
    }

    if (input.gpsCoordinates) {
      contextParts.push(
        `Coordenadas GPS capturadas: Latitude ${input.gpsCoordinates.latitude.toFixed(6)}, Longitude ${input.gpsCoordinates.longitude.toFixed(6)} (Precisão: ${input.gpsCoordinates.accuracy || 10}m).`
      );
    }

    contents.push({
      text: contextParts.join(" "),
    });

    const { output } = await ai.generate({
      prompt: contents,
      output: { schema: FieldInspectionReportSchema },
    });

    if (output && output.inspectionTitle) {
      const res = output as FieldInspectionReport;
      if (input.gpsCoordinates && !res.gpsLocation) {
        res.gpsLocation = `${input.gpsCoordinates.latitude.toFixed(5)}, ${input.gpsCoordinates.longitude.toFixed(5)} (±${input.gpsCoordinates.accuracy || 5}m)`;
      }
      if (input.devicePlatform && !res.deviceSource) {
        res.deviceSource = input.devicePlatform;
      }
      return res;
    }
  } catch (err) {
    // Provider errors must never manufacture findings or expose document data.
  }
  throw new Error(
    "A inspeção não foi concluída pela IA. Nenhum achado foi gerado; tente novamente."
  );
}
