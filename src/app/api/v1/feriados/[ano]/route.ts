import { NextResponse } from "next/server";
import { consultarFeriadosNacionais } from "@/actions/holidays";

/**
 * @fileOverview API Pública REST de Feriados Nacionais Brasileiros (1900 - 2199).
 * Calcula automaticamente feriados móveis (Páscoa, Carnaval, Sexta-feira Santa, Corpus Christi)
 * e feriados fixos estabelecidos pela legislação federal (incluindo Lei 14.759/2023).
 */

export async function GET(request: Request, { params }: { params: Promise<{ ano: string }> }) {
  try {
    const { ano } = await params;
    const anoNum = parseInt(ano, 10);

    if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2199) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem:
            "O parâmetro 'ano' deve ser um número inteiro compreendido no intervalo [ 1900 .. 2199 ].",
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    const result = await consultarFeriadosNacionais(anoNum);

    if (!result.sucesso || !result.dados) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: result.mensagem || "Não foi possível calcular os feriados para este ano.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        ano: result.dados.ano,
        total_feriados: result.dados.totalFeriados,
        provedor: result.dados.provedor,
        feriados: result.dados.feriados,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, mensagem: "Erro interno no servidor de feriados.", detalhe: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
