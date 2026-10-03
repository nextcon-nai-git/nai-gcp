"use server";

/**
 * @fileOverview Server Action para processamento de relatórios SST via Genkit.
 * - Analisa o relatório usando Gemini 2.0 Flash.
 * - Salva os dados e a análise no Firestore.
 * - Retorna o resultado estruturado para a UI.
 */

import { z } from "genkit";
import { ai } from "@/ai/genkit";
import { initializeFirebase } from "@/firebase/init";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

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
export async function processarRelatorioSST(dadosDoRelatorio: any) {
  try {
    console.log("NAI Engine: Iniciando processamento neural e persistência...");

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
    const docRef = await addDoc(collection(firestore, "relatorios_sst"), {
      dados_originais: dadosDoRelatorio.relatorio_visita_tecnica || dadosDoRelatorio,
      analise_ia: output,
      status_resolucao: "Pendente",
      criado_em: serverTimestamp(),
      processado_por: "NAI Server Action v1.3",
    });

    // Passo C: Retorno para a UI
    return {
      sucesso: true,
      relatorioId: docRef.id,
      analise: output,
    };
  } catch (error: any) {
    console.error("❌ Erro fatal na Server Action NAI:", error);
    return {
      sucesso: false,
      erro: error.message || "Não foi possível processar e salvar o relatório.",
    };
  }
}
