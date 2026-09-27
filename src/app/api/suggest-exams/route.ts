import { NextResponse } from 'next/server';
import { suggestExams } from '@/ai/flows/suggest-exams-flow';
import { optionsCorsResponse, rejectIfCorsDenied, requireAuthFromBearer, resolveCorsHeaders } from '@/lib/api-security';

/**
 * @fileOverview API Pública para Recomendação de Exames via IA.
 * Recebe cargo e riscos para retornar protocolos PCMSO dinâmicos.
 */

export async function POST(request: Request) {
  const deniedResponse = rejectIfCorsDenied(request, 'POST, OPTIONS');
  if (deniedResponse) return deniedResponse;
  const cors = resolveCorsHeaders(request, 'POST, OPTIONS');

  const auth = await requireAuthFromBearer(request);
  if (!auth) {
    return NextResponse.json(
      { sucesso: false, mensagem: "Não autenticado." },
      { status: 401, headers: cors.headers }
    );
  }

  try {
    const body = await request.json();
    
    // Validação básica de entrada
    if (!body.jobTitle || !body.companyRisks) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Cargo e Lista de Riscos são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await suggestExams({
      jobTitle: body.jobTitle,
      companyRisks: body.companyRisks,
      age: body.age || 30 // Fallback de idade
    });

    return NextResponse.json({
      sucesso: true,
      recommendedExams: result.recommendedExams
    }, {
      status: 200,
      headers: cors.headers
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("Erro na API de Sugestão de Exames:", message);
    return NextResponse.json(
      { sucesso: false, mensagem: "Erro interno no processamento da NAI Medical." },
      { status: 500 }
    );
  }
}

// Handler para pre-flight requests do CORS
export async function OPTIONS(request: Request) {
  return optionsCorsResponse(request, 'POST, OPTIONS');
}
