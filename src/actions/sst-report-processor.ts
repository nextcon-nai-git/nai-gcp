"use server";
import { requireAiAction, DOCUMENT_AI_ROLES } from "@/lib/auth/ai-action";

/**
 * @fileOverview Server Action para processamento de relatórios SST via Genkit.
 * Versão v1.0: Tipagem rigorosa e tratamento de erros defensivo.
 */

import { z } from "zod";
import { ai } from "@/ai/genkit";
import { initializeFirebase } from "@/firebase/init";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { TechnicalReportData, ActionResult, TaskStatus } from "@/types/schema";

// 1. Definição do Esquema de Saída para garantir estabilidade na UI
const AnaliseRiscoSchema = z.object({
  nivel_risco_geral: z.enum(["Baixo", "Médio", "Alto", "Crítico"]),
  resumo_executivo: z.string().describe("Resumo em 2 frases sobre a situação da obra."),
  acoes_imediatas_recomendadas: z.array(z.string()).describe("Lista de até 3 ações cruciais."),
});

export type AnaliseRiscoOutput = z.infer<typeof AnaliseRiscoSchema>;

/**
 * Action principal disparada pelo botão de processamento.
 */
export async function processarRelatorioSST(
  dadosDoRelatorio: TechnicalReportData,
  idToken?: string
): Promise<ActionResult<AnaliseRiscoOutput>> {
  await requireAiAction(idToken, DOCUMENT_AI_ROLES, [dadosDoRelatorio]);

  try {
    // Validação básica de entrada
    if (!dadosDoRelatorio?.cabecalho?.empresa_atendida) {
      throw new Error("Dados do relatório incompletos para processamento.");
    }

    // Passo A: Análise via Genkit (IA)
    const { output } = await ai.generate({
      prompt: `Você é um Engenheiro de Segurança do Trabalho sênior da Nextcon. 
      Analise este relatório de visita técnica e extraia o nível de risco e as ações prioritárias: 
      ${JSON.stringify(dadosDoRelatorio)}`,
      output: {
        schema: AnaliseRiscoSchema,
      },
    });

    if (!output) {
      throw new Error("Falha na geração do parecer técnico pela IA.");
    }

    // Passo B: Persistência no Firestore
    const { firestore } = initializeFirebase();
    const statusDefault: TaskStatus = "review";

    const docRef = await addDoc(collection(firestore, "relatorios_sst"), {
      dados_originais: dadosDoRelatorio,
      analise_ia: output,
      status_resolucao: statusDefault,
      criado_em: serverTimestamp(),
      processado_por: "NAI Server Action v1.5",
    });

    // Passo C: Retorno para a UI
    return {
      sucesso: true,
      relatorioId: docRef.id,
      analise: output,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return {
      sucesso: false,
      erro: errorMessage || "Não foi possível processar e salvar o relatório.",
    };
  }
}
