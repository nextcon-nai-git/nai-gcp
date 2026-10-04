import { NextResponse } from "next/server";
import { consultarTaxasEIndicesOficiais } from "@/actions/economic-rates";

/**
 * @fileOverview API Pública REST de Taxas de Juros e Índices Oficiais do Brasil v1.
 * Retorna Selic, CDI, IPCA, INPC, IGP-M, TR, TJLP, Dólar PTAX e Euro PTAX.
 */

export async function GET() {
  try {
    const result = await consultarTaxasEIndicesOficiais();

    if (!result.sucesso || !result.dados) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: result.mensagem || "Erro ao consultar as taxas e índices oficiais.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        total_taxas: result.dados.totalTaxas,
        data_consulta: result.dados.dataConsulta,
        provedor: result.dados.provedor,
        taxas: result.dados.taxas,
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
      {
        sucesso: false,
        mensagem: "Erro interno no servidor de taxas e índices.",
        detalhe: error.message,
      },
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
