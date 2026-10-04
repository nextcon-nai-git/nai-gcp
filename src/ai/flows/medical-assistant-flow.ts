"use server";
/**
 * @fileOverview Agente NAI Medical Assistant - Agente com Tool Calling para suporte clínico.
 *
 * - medicalAssistant - Função que processa dúvidas médicas consultando dados do sistema.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { initializeFirebase } from "@/firebase/init";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// --- FERRAMENTAS DO AGENTE ---

/**
 * Ferramenta para buscar códigos CID-10 baseados em sintomas.
 */
export const consultarCIDTool = ai.defineTool(
  {
    name: "consultarCID",
    description: "Busca o código CID-10 oficial baseado em sintomas ou diagnóstico descrito.",
    inputSchema: z.object({
      termo: z.string().describe("Descrição do sintoma ou doença (ex: dor lombar)."),
    }),
    outputSchema: z.object({
      codigo: z.string(),
      descricao: z.string(),
    }),
  },
  async ({ termo }) => {
    const busca = termo.toLowerCase();
    // Simulação de busca técnica (Em produção, conectaria a uma API de CID)
    if (busca.includes("lombar") || busca.includes("costas"))
      return { codigo: "M54.5", descricao: "Dor lombar baixa" };
    if (busca.includes("esforço") || busca.includes("repetitivo"))
      return { codigo: "M75.1", descricao: "Síndrome do manguito rotador" };
    if (busca.includes("tristeza") || busca.includes("ânimo"))
      return { codigo: "F33.2", descricao: "Transtorno depressivo recorrente" };

    return { codigo: "R68.8", descricao: "Outros sintomas e sinais gerais especificados" };
  }
);

/**
 * Ferramenta para buscar o histórico real do paciente no Firestore.
 */
export const buscarHistoricoPacienteTool = ai.defineTool(
  {
    name: "buscarHistoricoPaciente",
    description:
      "Busca o último Atestado de Saúde Ocupacional (ASO) e as restrições do paciente no banco de dados.",
    inputSchema: z.object({
      pacienteId: z.string().describe("O ID único do paciente no sistema."),
    }),
    outputSchema: z.object({
      encontrado: z.boolean(),
      ultimoAsoData: z.string().optional(),
      statusUltimoAso: z.string().optional(),
      restricoes: z.array(z.string()).optional(),
    }),
  },
  async ({ pacienteId }) => {
    const { firestore } = initializeFirebase();
    const asoRef = collection(firestore, "atendimentos_aso");
    const q = query(
      asoRef,
      where("employeeId", "==", pacienteId),
      orderBy("data_emissao", "desc"),
      limit(1)
    );

    try {
      const snap = await getDocs(q);
      if (snap.empty) {
        return { encontrado: false };
      }

      const data = snap.docs[0].data();
      return {
        encontrado: true,
        ultimoAsoData: data.data_emissao || "---",
        statusUltimoAso: data.resultado || "APTO",
        restricoes: data.restricoes || [],
      };
    } catch (error) {
      console.error("Erro ao buscar no Firestore:", error);
      return { encontrado: false };
    }
  }
);

// --- FLUXO DO AGENTE ---

const medicalAssistantFlow = ai.defineFlow(
  {
    name: "medicalAssistantFlow",
    inputSchema: z.object({
      mensagemMedico: z.string(),
      pacienteId: z.string(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await ai.generate({
      prompt: `Você é a NAI, assistente técnica de elite para médicos do trabalho da Nextcon.
      
      CONTEXTO DO PACIENTE:
      ID: ${input.pacienteId}
      
      SOLICITAÇÃO MÉDICA:
      "${input.mensagemMedico}"
      
      DIRETRIZES:
      1. Se o médico mencionar sintomas, use 'consultarCID' para sugerir o código.
      2. Antes de dar um parecer, use 'buscarHistoricoPaciente' para verificar se há inaptidões ou restrições prévias.
      3. Seja extremamente profissional, clínico e objetivo.
      4. Sempre mencione que seu parecer deve ser validado pelo médico examinador.`,
      tools: [consultarCIDTool, buscarHistoricoPacienteTool],
    });

    return text;
  }
);

export async function medicalAssistant(input: {
  mensagemMedico: string;
  pacienteId: string;
}): Promise<string> {
  return medicalAssistantFlow(input);
}
