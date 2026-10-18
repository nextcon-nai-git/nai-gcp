"use server";

/**
 * @fileOverview NAI Economic & Financial Rates Engine (Taxas e Índices Oficiais do Brasil).
 * Retorna somente as taxas disponibilizadas pela BrasilAPI, sem complementação com valores fixos.
 */

import { ActionResult } from "@/types/schema";

export interface EconomicRateItem {
  nome: string; // Ex: "Selic", "CDI", "IPCA", "IGP-M", "TR", "Dólar PTAX"
  valor: number; // Valor numérico oficial
  unidade: string; // Ex: "% a.a.", "% a.m.", "R$"
  periodo: string; // Ex: "Anual", "Mensal", "Diário"
  descricao: string; // Descrição técnica e órgão responsável (BCB, IBGE, FGV, B3)
  fonte: string; // Ex: "Banco Central do Brasil", "IBGE", "FGV", "B3"
  dataAtualizacao: string;
}

export interface EconomicRatesResult {
  totalTaxas: number;
  dataConsulta: string;
  provedor: string;
  taxas: EconomicRateItem[];
}

/**
 * Consulta taxas de juros e índices econômicos oficiais do Brasil com resiliência.
 */
export async function consultarTaxasEIndicesOficiais(): Promise<ActionResult<EconomicRatesResult>> {
  try {
    let taxasList: EconomicRateItem[] = [];
    const provedorName = "Banco Central do Brasil / BrasilAPI";

    // 1. Consulta fonte primaria (BrasilAPI Taxas v1)
    try {
      const res = await fetch("https://brasilapi.com.br/api/taxas/v1", {
        next: { revalidate: 3600 },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          taxasList = json
            .filter(
              (item: any) =>
                typeof item?.nome === "string" &&
                item.nome.trim() &&
                (typeof item.valor === "number" ||
                  (typeof item.valor === "string" && item.valor.trim() !== "")) &&
                Number.isFinite(Number(item.valor))
            )
            .map((item: any) => ({
              nome: item.nome,
              valor: Number(item.valor),
              unidade: item.nome === "IPCA" ? "% a.a." : "% a.a.",
              periodo: "Anualizado",
              descricao:
                item.nome === "Selic"
                  ? "Taxa Básica de Juros da Economia (Copom / BCB)"
                  : item.nome === "CDI"
                    ? "Taxa Média dos Depósitos Interfinanceiros (B3)"
                    : item.nome === "IPCA"
                      ? "Índice Nacional de Preços ao Consumidor Amplo (IBGE)"
                      : "Índice Oficial Brasileiro",
              fonte:
                item.nome === "Selic"
                  ? "Banco Central do Brasil"
                  : item.nome === "CDI"
                    ? "B3 - Brasil, Bolsa, Balcão"
                    : "IBGE",
              dataAtualizacao: new Date().toISOString(),
            }));
        }
      }
    } catch (e) {
      // A ausência de dados será informada abaixo.
    }

    if (!taxasList.length) {
      return {
        sucesso: false,
        mensagem: "Índices indisponíveis na fonte consultada. Nenhum valor atual foi presumido.",
      };
    }

    return {
      sucesso: true,
      dados: {
        totalTaxas: taxasList.length,
        dataConsulta: new Date().toISOString(),
        provedor: provedorName,
        taxas: taxasList,
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao consultar as taxas e índices oficiais do Brasil.",
    };
  }
}
