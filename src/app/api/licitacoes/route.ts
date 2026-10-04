import { NextResponse } from "next/server";
import { fetchJson } from "@/lib/http-client";

interface PncpResponse {
  data?: unknown[];
  items?: unknown[];
  totalRegistros?: number;
}

/**
 * @fileOverview API de integração com o Portal Nacional de Contratações Públicas (PNCP).
 * Utiliza connection pooling, cache e retry automático para otimizar performance.
 */

export async function GET() {
  try {
    // Palavras-chave estratégicas para filtragem técnica
    const keywords = 'Segurança do Trabalho OR PCMSO OR PGR OR LTCAT OR "Medicina do Trabalho"';

    // Endpoint de busca da API pública do PNCP
    const apiUrl = `https://pncp.gov.br/api/pncp/v1/contratacoes?q=${encodeURIComponent(
      keywords
    )}&pagina=1&tamanhoPagina=15`;

    // Cache de 30 minutos e até 3 tentativas com conexões reutilizadas pelo fetch.
    const rawData = await fetchJson<PncpResponse | unknown[]>(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NAI-Healthcare-Platform/1.0",
      },
      cacheTtlMs: 30 * 60 * 1000,
      retries: 2,
      retryDelayMs: 1000,
    });

    // A estrutura do PNCP pode variar
    const opportunities = Array.isArray(rawData) ? rawData : rawData.data || rawData.items || [];
    const total = Array.isArray(rawData)
      ? rawData.length
      : (rawData.totalRegistros ?? opportunities.length);

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
