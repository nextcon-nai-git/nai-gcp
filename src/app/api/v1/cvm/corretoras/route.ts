import { NextResponse } from "next/server";
import { consultarCorretorasCvm } from "@/actions/cvm-brokers";

/**
 * @fileOverview API Pública REST de Corretoras Ativas na CVM v1.
 * Aceita parâmetro opcional de busca por estado: ?uf=SP
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uf = searchParams.get("uf") || undefined;

    const result = await consultarCorretorasCvm({ uf });

    if (!result.sucesso || !result.dados) {
      return NextResponse.json(
        { sucesso: false, mensagem: result.mensagem || "Erro ao consultar as corretoras na CVM." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        total: result.dados.total,
        uf_filtro: result.dados.ufFiltro,
        provedor: result.dados.provedor,
        corretoras: result.dados.corretoras,
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
        mensagem: "Erro interno no servidor de corretoras CVM.",
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
