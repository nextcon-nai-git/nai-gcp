import { NextResponse } from "next/server";
import { fetchJson } from "@/lib/http-client";

/**
 * @fileOverview API de integração com o Portal Nacional de Contratações Públicas (PNCP).
 * Filtra oportunidades governamentais específicas para o setor de SST.
 */

export async function GET() {
  try {
    // Palavras-chave estratégicas para filtragem técnica
    const keywords = 'Segurança do Trabalho OR PCMSO OR PGR OR LTCAT OR "Medicina do Trabalho"';

    // Endpoint de busca da API pública do PNCP (Portal Nacional de Contratações Públicas)
    // Utilizamos o endpoint de contratações que é o mais estável para busca textual
    const apiUrl = `https://pncp.gov.br/api/pncp/v1/contratacoes?q=${encodeURIComponent(keywords)}&pagina=1&tamanhoPagina=15`;

    const rawData = await fetchJson<
      | {
          data?: unknown[];
          items?: unknown[];
          totalRegistros?: number;
        }
      | unknown[]
    >(apiUrl, {
      cacheTtlMs: 60_000,
      headers: { Accept: "application/json" },
      revalidate: 3600,
    });

    // A estrutura do PNCP pode variar. Tentamos capturar de 'data', 'items' ou da raiz
    const result = Array.isArray(rawData) ? null : rawData;
    const opportunities = result?.data || result?.items || (Array.isArray(rawData) ? rawData : []);
    const total = result?.totalRegistros || opportunities.length || 0;

    return NextResponse.json({
      sucesso: true,
      total: total,
      oportunidades: opportunities,
    });
  } catch (error: unknown) {
    console.error("Erro ao consultar licitações:", error);
    return NextResponse.json(
      {
        sucesso: false,
        erro: "O Portal do Governo (PNCP) está temporariamente indisponível ou recusou a conexão. Tente novamente em instantes.",
        detalhes: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
