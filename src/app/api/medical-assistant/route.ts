import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/ai/genkit";

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
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

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
      1. Não atribua diagnóstico ou CID automaticamente a sintomas. Não há consulta integrada a uma tabela oficial de CID; informe essa limitação e peça validação médica.
      2. Use apenas o histórico fornecido. Se estiver indisponível ou sem registros, informe a limitação e não conclua aptidão, normalidade ou ausência de restrições.
      3. Seja extremamente profissional, clínico e objetivo.
      4. Sempre mencione que seu parecer deve ser validado pelo médico examinador.`,
    });

    // Converte para ReadableStream do navegador
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          for await (const chunk of stream) {
            if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          }
          controller.close();
        } catch {
          controller.error(new Error("A resposta foi interrompida. Tente novamente."));
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return handleAuthError(error);
    console.error("Erro no Agente Médico NAI: geração indisponível.");
    return new Response("Erro interno no processamento do agente neural.", { status: 500 });
  }
}
