import { NextResponse } from "next/server";

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

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 3600 }, // Cache de 1 hora
    });

    if (!response.ok) {
      throw new Error(`Erro na API do PNCP: ${response.status}`);
    }

    const rawData = await response.json();

    // A estrutura do PNCP pode variar. Tentamos capturar de 'data', 'items' ou da raiz
    const opportunities = rawData.data || rawData.items || (Array.isArray(rawData) ? rawData : []);
    const total = rawData.totalRegistros || opportunities.length || 0;

    return NextResponse.json({
      sucesso: true,
      total: total,
      oportunidades: opportunities,
    });
  } catch (error: any) {
    console.error("Erro ao consultar licitações:", error);
    return NextResponse.json(
      {
        sucesso: false,
        erro: "O Portal do Governo (PNCP) está temporariamente indisponível ou recusou a conexão. Tente novamente em instantes.",
        detalhes: error.message,
      },
      { status: 500 }
    );
  }
}
