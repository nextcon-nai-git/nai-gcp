"use server";
/**
 * @fileOverview Agente NAI Medical Assistant - Agente com Tool Calling para suporte clínico.
 *
 * - medicalAssistant - Função que processa dúvidas médicas consultando dados do sistema.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getAuthorizedMedicalHistory } from "@/services/medical-history";

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

// --- FLUXO DO AGENTE ---

const medicalAssistantFlow = ai.defineFlow(
  {
    name: "medicalAssistantFlow",
    inputSchema: z.object({
      mensagemMedico: z.string(),
      pacienteId: z.string(),
      companyId: z.string(),
      history: z.string(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await ai.generate({
      prompt: `Você é a NAI, assistente técnica de elite para médicos do trabalho da Nextcon.
      
      CONTEXTO DO PACIENTE:
      Empresa autorizada: ${input.companyId}
      ID: ${input.pacienteId}
      Histórico consultado pelo servidor: ${input.history}
      
      SOLICITAÇÃO MÉDICA:
      "${input.mensagemMedico}"
      
      DIRETRIZES:
      1. Se o médico mencionar sintomas, use 'consultarCID' para sugerir o código.
      2. Use apenas o histórico fornecido; consulta indisponível ou sem registros não confirma aptidão nem ausência de restrições.
      3. Seja extremamente profissional, clínico e objetivo.
      4. Sempre mencione que seu parecer deve ser validado pelo médico examinador.`,
      tools: [consultarCIDTool],
    });

    return text;
  }
);

export async function medicalAssistant(input: {
  mensagemMedico: string;
  pacienteId: string;
  companyId: string;
  idToken?: string;
}): Promise<string> {
  const user = await requireAuth(
    new NextRequest("https://nai.local/action", {
      headers: { authorization: `Bearer ${input.idToken || ""}` },
    })
  );
  if (!input.mensagemMedico?.trim() || input.mensagemMedico.length > 5000)
    throw new Error("Mensagem inválida ou acima do limite.");
  const history = await getAuthorizedMedicalHistory(user, input.companyId, input.pacienteId);
  return medicalAssistantFlow({
    mensagemMedico: input.mensagemMedico,
    pacienteId: input.pacienteId,
    companyId: input.companyId,
    history: JSON.stringify(history),
  });
}
