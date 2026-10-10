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
      1. Não atribua diagnóstico ou CID automaticamente a sintomas. Não há consulta integrada a uma tabela oficial de CID; informe essa limitação e peça validação médica.
      2. Use apenas o histórico fornecido; consulta indisponível ou sem registros não confirma aptidão nem ausência de restrições.
      3. Seja extremamente profissional, clínico e objetivo.
      4. Sempre mencione que seu parecer deve ser validado pelo médico examinador.`,
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
