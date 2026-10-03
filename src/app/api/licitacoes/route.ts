import { NextResponse } from "next/server";
import { fetchWithPooling } from "@/lib/http-client";

/**
 * @fileOverview API de integração com o Portal Nacional de Contratações Públicas (PNCP).
 * Utiliza connection pooling, cache e retry automático para otimizar performance.
 */

export async function GET() {
  try {
    // Palavras-chave estratégicas para filtragem técnica
    const keywords =
      'Segurança do Trabalho OR PCMSO OR PGR OR LTCAT OR "Medicina do Trabalho"';

    // Endpoint de busca da API pública do PNCP
    const apiUrl = `https://pncp.gov.br/api/pncp/v1/contratacoes?q=${encodeURIComponent(
      keywords
    )}&pagina=1&tamanhoPagina=15`;

    // Fetch com pooling, cache de 30 minutos e 3 retries
    const rawData = await fetchWithPooling(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "NAI-Healthcare-Platform/1.0",
      },
      cacheTTL: 30 * 60 * 1000, // 30 minutos
      retries: 3,
      retryDelay: 1000,
    });

    // A estrutura do PNCP pode variar
    const opportunities =
      rawData.data || rawData.items || (Array.isArray(rawData) ? rawData : []);
    const total = rawData.totalRegistros || opportunities.length || 0;

    return NextResponse.json(
      {
        sucesso: true,
        total: total,
        oportunidades: opportunities,
        cache: true,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar licitações:", error);
    return NextResponse.json(
      {
        sucesso: false,
        erro: "O Portal do Governo (PNCP) está temporariamente indisponível. Tente novamente em instantes.",
        detalhes: error?.message,
      },
      { status: 503 }
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
