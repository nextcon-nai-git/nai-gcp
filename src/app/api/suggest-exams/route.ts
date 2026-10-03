import { NextResponse } from "next/server";
import { suggestExams } from "@/ai/flows/suggest-exams-flow";

/**
 * @fileOverview API Pública para Recomendação de Exames via IA.
 * Recebe cargo e riscos para retornar protocolos PCMSO dinâmicos.
 */

export async function POST(request: Request) {
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
      age: body.age || 30, // Fallback de idade
    });

    return NextResponse.json(
      {
        sucesso: true,
        recommendedExams: result.recommendedExams,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error: any) {
    console.error("Erro na API de Sugestão de Exames:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Erro interno no processamento da NAI Medical." },
      { status: 500 }
    );
  }
}

// Handler para pre-flight requests do CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
