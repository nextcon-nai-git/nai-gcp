import { NextResponse } from "next/server";
import { buscarEnderecoPorCep } from "@/actions/address-lookup";

/**
 * @fileOverview API Pública REST para Consulta de CEP NAI v1.
 * Aceita CEP com ou sem traço na URL (Ex: /api/v1/cep/01310100 ou /api/v1/cep/01310-100).
 */

export async function GET(request: Request, { params }: { params: Promise<{ cep: string }> }) {
  try {
    const { cep } = await params;
    const cleanCep = cep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      return NextResponse.json(
        { sucesso: false, mensagem: "O CEP deve possuir exatamente 8 dígitos numéricos." },
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

    const result = await buscarEnderecoPorCep(cleanCep);

    if (!result.sucesso || !result.dados) {
      return NextResponse.json(
        { sucesso: false, mensagem: result.mensagem || "CEP não localizado nos provedores." },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        provedor: result.dados.providerUtilizado,
        dados: result.dados,
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
      { sucesso: false, mensagem: "Erro interno no servidor CEP.", detalhe: error.message },
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
