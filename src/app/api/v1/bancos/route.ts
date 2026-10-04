import { NextResponse } from "next/server";
import { consultarBancosBrasil } from "@/actions/banks";

/**
 * @fileOverview API Pública REST do Sistema Bancário do Brasil v1.
 * Retorna todos os bancos e instituições financeiras autorizadas pelo Banco Central (BCB/ISPB).
 * Parâmetros de busca opcionais: code, ispb, name, limit, offset.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code") || undefined;
    const ispb = searchParams.get("ispb") || undefined;
    const name = searchParams.get("name") || undefined;
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");

    const limit = limitRaw ? parseInt(limitRaw, 10) : 100;
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

    const result = await consultarBancosBrasil({ code, ispb, name, limit, offset });

    if (!result.sucesso || !result.dados) {
      return NextResponse.json(
        {
          sucesso: false,
          mensagem: result.mensagem || "Erro ao listar as instituições do sistema bancário.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        total: result.dados.total,
        limit: result.dados.limit,
        offset: result.dados.offset,
        provedor: result.dados.provedor,
        bancos: result.dados.bancos,
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
      { sucesso: false, mensagem: "Erro interno no servidor de bancos.", detalhe: error.message },
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
