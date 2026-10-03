"use client";

/**
 * @fileOverview Serviço de Gestão de Relatórios SST com Inteligência Artificial.
 * Utiliza o motor de persistência não-bloqueante da plataforma NAI.
 */

import { collection, serverTimestamp, Firestore } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

/**
 * Salva um relatório técnico processado pela NAI no Firestore.
 *
 * @param db Instância do Firestore inicializada.
 * @param relatorioJson Dados brutos da visita técnica.
 * @param resumoIA Texto gerado pela inteligência artificial.
 * @returns Promessa com o resultado da operação.
 */
export async function salvarRelatorioComIA(db: Firestore, relatorioJson: any, resumoIA: string) {
  try {
    const relatoriosRef = collection(db, "relatorios_sst");

    // Prepara o objeto seguindo o schema TechnicalReport
    const novoRelatorio = {
      dados_visita: relatorioJson.relatorio_visita_tecnica || relatorioJson,
      analise_inteligente: resumoIA,
      status: "Aguardando Correções",
      criado_em: serverTimestamp(),
    };

    // Utiliza o utilitário do projeto para escrita otimizada e offline-first
    const docRefPromise = addDocumentNonBlocking(relatoriosRef, novoRelatorio);

    // Embora a função seja não-bloqueante para a UI, retornamos o sucesso da chamada da SDK
    return {
      sucesso: true,
      mensagem: "Relatório protocolado na NAI Cloud. O processamento continuará em segundo plano.",
    };
  } catch (error: any) {
    console.error("NAI Report Error:", error);
    return {
      sucesso: false,
      erro: error.message || "Falha ao protocolar relatório.",
    };
  }
}
