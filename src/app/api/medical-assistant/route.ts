import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/ai/genkit";
import { consultarCIDTool } from "@/ai/flows/medical-assistant-flow";

import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { getAuthorizedMedicalHistory } from "@/services/medical-history";

/**
 * @fileOverview API de Streaming para o Assistente Médico NAI.
 * Implementa resposta em fluxo (chunked) para melhor experiência de chat clínico.
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const text = await request.text();
    if (Buffer.byteLength(text) > 16000)
      return NextResponse.json({ error: "Mensagem acima do limite." }, { status: 413 });
    const body = JSON.parse(text);

    if (
      typeof body.mensagemMedico !== "string" ||
      !body.mensagemMedico.trim() ||
      body.mensagemMedico.length > 5000 ||
      typeof body.pacienteId !== "string" ||
      typeof body.companyId !== "string"
    ) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Mensagem e ID do Paciente são obrigatórios." },
        { status: 400 }
      );
    }

    const history = await getAuthorizedMedicalHistory(user, body.companyId, body.pacienteId);

    // Inicia geração em stream via Genkit 1.x
    const { stream } = ai.generateStream({
      prompt: `Você é a NAI, assistente técnica de elite para médicos do trabalho da Nextcon.
      
      CONTEXTO DO PACIENTE:
      Empresa autorizada: ${body.companyId}
      ID: ${body.pacienteId}
      Histórico consultado pelo servidor: ${JSON.stringify(history)}
      
      SOLICITAÇÃO MÉDICA:
      "${body.mensagemMedico}"
      
      DIRETRIZES:
      1. Se o médico mencionar sintomas, use 'consultarCID' para sugerir o código.
      2. Use apenas o histórico fornecido. Se estiver indisponível ou sem registros, informe a limitação e não conclua aptidão, normalidade ou ausência de restrições.
      3. Seja extremamente profissional, clínico e objetivo.
      4. Sempre mencione que seu parecer deve ser validado pelo médico examinador.`,
      tools: [consultarCIDTool],
    });

    // Converte para ReadableStream do navegador
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.text) {
            controller.enqueue(new TextEncoder().encode(chunk.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return handleAuthError(error);
    console.error("Erro no Agente Médico NAI (Stream):", error);
    return new Response("Erro interno no processamento do agente neural.", { status: 500 });
  }
}
