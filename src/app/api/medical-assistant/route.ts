import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { consultarCIDTool, buscarHistoricoPacienteTool } from '@/ai/flows/medical-assistant-flow';
import { optionsCorsResponse, rejectIfCorsDenied, requireAuthFromBearer, resolveCorsHeaders } from '@/lib/api-security';

/**
 * @fileOverview API de Streaming para o Assistente Médico NAI.
 * Implementa resposta em fluxo (chunked) para melhor experiência de chat clínico.
 */

export async function POST(request: NextRequest) {
  const deniedResponse = rejectIfCorsDenied(request, 'POST, OPTIONS');
  if (deniedResponse) return deniedResponse;
  const cors = resolveCorsHeaders(request, 'POST, OPTIONS');

  const auth = await requireAuthFromBearer(request);
  if (!auth) {
    return NextResponse.json(
      { sucesso: false, mensagem: 'Não autenticado.' },
      { status: 401, headers: cors.headers }
    );
  }

  try {
    const body = await request.json();

    if (!body.mensagemMedico || !body.pacienteId) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Mensagem e ID do Paciente são obrigatórios." },
        { status: 400 }
      );
    }

    // Inicia geração em stream via Genkit 1.x
    const { stream } = ai.generateStream({
      prompt: `Você é a NAI, assistente técnica de elite para médicos do trabalho da Nextcon.
      
      CONTEXTO DO PACIENTE:
      ID: ${body.pacienteId}
      
      SOLICITAÇÃO MÉDICA:
      "${body.mensagemMedico}"
      
      DIRETRIZES:
      1. Se o médico mencionar sintomas, use 'consultarCID' para sugerir o código.
      2. Antes de dar um parecer, use 'buscarHistoricoPaciente' para verificar se há inaptidões ou restrições prévias.
      3. Seja extremamente profissional, clínico e objetivo.
      4. Sempre mencione que seu parecer deve ser validado pelo médico examinador.`,
      tools: [consultarCIDTool, buscarHistoricoPacienteTool],
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
        ...cors.headers,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("Erro no Agente Médico NAI (Stream):", message);
    return new Response("Erro interno no processamento do agente neural.", {
      status: 500,
      headers: cors.headers
    });
  }
}

// Handler para pre-flight requests do CORS
export async function OPTIONS(request: NextRequest) {
  return optionsCorsResponse(request, 'POST, OPTIONS');
}
