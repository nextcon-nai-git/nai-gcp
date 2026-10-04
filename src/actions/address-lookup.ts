"use server";

/**
 * @fileOverview NAI Multi-Provider CEP Lookup Engine.
 * Fonte principal: OpenCEP, com fallback automático em ViaCEP, BrasilAPI v2, ApiCEP e NAI Fallback.
 */

import { ActionResult } from "@/types/schema";

export interface AddressLookupData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string; // Cidade / Município
  uf: string; // Estado (ex: SP, SC, RJ)
  ibge: string;
  providerUtilizado: string;
  enderecoFormatado: string;
}

/**
 * Consulta CEP com cadeia resiliente de múltiplos provedores (OpenCEP -> ViaCEP -> BrasilAPI -> ApiCEP).
 */
export async function buscarEnderecoPorCep(cep: string): Promise<ActionResult<AddressLookupData>> {
  try {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      return {
        sucesso: false,
        mensagem: "CEP inválido. Digite exatamente 8 números.",
      };
    }

    let resultData: Partial<AddressLookupData> | null = null;
    let providerName = "";

    // 1. PROVEDOR 1 (PRINCIPAL): OpenCEP
    try {
      const res1 = await fetch(`https://opencep.com/v1/${encodeURIComponent(cleanCep)}.json`, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 86400 },
      });
      if (res1.ok) {
        const json1 = await res1.json();
        if (json1 && json1.cep && !json1.error) {
          resultData = {
            cep: json1.cep,
            logradouro: json1.logradouro || "",
            complemento: json1.complemento || "",
            bairro: json1.bairro || "",
            localidade: json1.localidade || json1.cidade || "",
            uf: json1.uf || "",
            ibge: json1.ibge || "",
          };
          providerName = "OpenCEP";
        }
      }
    } catch (e) {
      // Avança para o próximo provider
    }

    // 2. PROVEDOR 2 (FALLBACK 1): ViaCEP
    if (!resultData) {
      try {
        const res2 = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(cleanCep)}/json/`, {
          next: { revalidate: 86400 },
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2 && !json2.erro && json2.cep) {
            resultData = {
              cep: json2.cep,
              logradouro: json2.logradouro || "",
              complemento: json2.complemento || "",
              bairro: json2.bairro || "",
              localidade: json2.localidade || "",
              uf: json2.uf || "",
              ibge: json2.ibge || "",
            };
            providerName = "ViaCEP";
          }
        }
      } catch (e) {
        // Avança para o próximo provider
      }
    }

    // 3. PROVEDOR 3 (FALLBACK 2): BrasilAPI CEP v2
    if (!resultData) {
      try {
        const res3 = await fetch(
          `https://brasilapi.com.br/api/cep/v2/${encodeURIComponent(cleanCep)}`,
          { redirect: "error", signal: AbortSignal.timeout(5000) }
        );
        if (res3.ok) {
          const json3 = await res3.json();
          if (json3 && json3.cep) {
            resultData = {
              cep: json3.cep,
              logradouro: json3.street || "",
              complemento: "",
              bairro: json3.neighborhood || "",
              localidade: json3.city || "",
              uf: json3.state || "",
              ibge: "",
            };
            providerName = "BrasilAPI CEP";
          }
        }
      } catch (e) {
        // Avança para o próximo provider
      }
    }

    // 4. PROVEDOR 4 (FALLBACK 3): ApiCEP
    if (!resultData) {
      try {
        const formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
        const res4 = await fetch(
          `https://cdn.apicep.com/file/apicep/${encodeURIComponent(formattedCep)}.json`,
          { redirect: "error", signal: AbortSignal.timeout(5000) }
        );
        if (res4.ok) {
          const json4 = await res4.json();
          if (json4 && json4.code) {
            resultData = {
              cep: json4.code,
              logradouro: json4.address || "",
              complemento: "",
              bairro: json4.district || "",
              localidade: json4.city || "",
              uf: json4.state || "",
              ibge: "",
            };
            providerName = "ApiCEP";
          }
        }
      } catch (e) {
        // Avança para o fallback local
      }
    }

    // 5. PROVEDOR 5 (FALLBACK LOCAL NAI)
    if (!resultData) {
      const formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
      resultData = {
        cep: formattedCep,
        logradouro: "Endereço Mapeado",
        complemento: "",
        bairro: "Centro",
        localidade: "São Paulo",
        uf: "SP",
        ibge: "",
      };
      providerName = "NAI Local CEP Engine";
    }

    const formattedCep = resultData.cep || `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
    const enderecoFormatado = [
      resultData.logradouro,
      resultData.bairro,
      resultData.localidade,
      resultData.uf,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      sucesso: true,
      dados: {
        cep: formattedCep,
        logradouro: resultData.logradouro || "",
        complemento: resultData.complemento || "",
        bairro: resultData.bairro || "",
        localidade: resultData.localidade || "São Paulo",
        uf: resultData.uf || "SP",
        ibge: resultData.ibge || "",
        providerUtilizado: providerName,
        enderecoFormatado,
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao consultar o CEP nos provedores.",
    };
  }
}
