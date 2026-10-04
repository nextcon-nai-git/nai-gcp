import { NextResponse } from "next/server";
import { listarTermosTuss } from "@/actions/tuss";

/**
 * @fileOverview API Pública REST para Consulta de Termos e Códigos TUSS v1.
 * Aceita parâmetros de busca: name, tuss, limit e offset.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const name = searchParams.get("name") || undefined;
    const tuss = searchParams.get("tuss") || undefined;
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");

    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { sucesso: false, mensagem: "O parâmetro 'limit' deve ser um inteiro maior ou igual a 1." },
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

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: "O parâmetro 'offset' deve ser um inteiro maior ou igual a 0.",
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

    const result = await listarTermosTuss({ name, tuss, limit, offset });

    if (!result.sucesso || !result.dados) {
      return NextResponse.json(
        { sucesso: false, mensagem: result.mensagem || "Erro ao listar os termos TUSS." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        total: result.dados.total,
        limit: result.dados.limit,
        offset: result.dados.offset,
        items: result.dados.items,
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
      { sucesso: false, mensagem: "Erro interno no servidor TUSS.", detalhe: error.message },
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
