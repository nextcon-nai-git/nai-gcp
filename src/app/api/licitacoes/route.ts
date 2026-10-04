import { NextResponse } from "next/server";

/**
 * @fileOverview API de integração com o Portal Nacional de Contratações Públicas (PNCP).
 * Filtra oportunidades governamentais específicas para o setor de SST.
 * Implementa resiliência total contra falhas do portal oficial.
 */

export async function GET() {
  try {
    const keywords = 'Segurança do Trabalho OR PCMSO OR PGR OR LTCAT OR "Medicina do Trabalho"';
    const apiUrl = `https://pncp.gov.br/api/pncp/v1/contratacoes?q=${encodeURIComponent(keywords)}&pagina=1&tamanhoPagina=15`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "NextconIntelligence/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: `O Portal do Governo (PNCP) retornou status ${response.status}.`,
          detalhes: "Serviço temporariamente indisponível no Portal Nacional.",
        },
        { status: 200 }
      );
    }

    const rawData = await response.json();
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
        erro: "Falha na conexão com a base governamental.",
        detalhes: error.message,
      },
      { status: 200 }
    );
  }
}
