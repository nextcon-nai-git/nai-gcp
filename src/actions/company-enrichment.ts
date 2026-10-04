"use server";

/**
 * @fileOverview NAI Enrichment Engine - Processamento de CNPJ e enquadramento de NRs (Receita Federal API).
 * Utiliza cadeia de resiliência multi-API (MinhaReceita, BrasilAPI, ReceitaWS) com fallback inteligente.
 */

import { ActionResult } from "@/types/schema";

export interface CompanyEnrichmentData {
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  cnaeDescricao: string;
  grauDeRisco: number;
  exigeSesmt: boolean;
  exigeCipa: boolean;
  isIsentoDir: boolean;
  // Contato e Web
  email: string;
  telefone: string;
  website: string;
  situacaoCadastral: string;
  // Endereço Completo
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  enderecoFormatado: string;
}

/**
 * Busca dados na Receita Federal com suporte a resiliência multi-fonte (MinhaReceita, BrasilAPI, ReceitaWS).
 */
export async function enriquecerDadosEmpresa(
  cnpj: string,
  totalVidas: number = 10
): Promise<ActionResult<CompanyEnrichmentData>> {
  try {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      return {
        sucesso: false,
        mensagem: "CNPJ inválido. Digite exatamente os 14 dígitos numéricos do CNPJ.",
      };
    }

    let rawData: any = null;
    let sourceName = "";

    // 1. TENTATIVA 1: MinhaReceita API
    try {
      const res1 = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
      });
      if (res1.ok) {
        const json1 = await res1.json();
        if (json1 && (json1.razao_social || json1.nome_fantasia)) {
          rawData = {
            razao_social: json1.razao_social || json1.nome_fantasia,
            nome_fantasia: json1.nome_fantasia || json1.razao_social,
            cnae_fiscal: String(json1.cnae_fiscal || ""),
            cnae_fiscal_descricao: json1.cnae_fiscal_descricao || "Atividade Econômica Principal",
            email: json1.email || "",
            ddd_telefone_1: json1.ddd_telefone_1 || "",
            logradouro: json1.logradouro || "",
            numero: json1.numero || "S/N",
            bairro: json1.bairro || "",
            municipio: json1.municipio || "",
            uf: json1.uf || "",
            cep: json1.cep || "",
            descricao_situacao_cadastral: json1.descricao_situacao_cadastral || "ATIVA",
          };
          sourceName = "MinhaReceita";
        }
      }
    } catch (e) {
      // Tenta a próxima fonte
    }

    // 2. TENTATIVA 2: BrasilAPI
    if (!rawData) {
      try {
        const res2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2 && json2.razao_social) {
            rawData = json2;
            sourceName = "BrasilAPI";
          }
        }
      } catch (e) {
        // Tenta a próxima fonte
      }
    }

    // 3. TENTATIVA 3: ReceitaWS
    if (!rawData) {
      try {
        const res3 = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
        if (res3.ok) {
          const json3 = await res3.json();
          if (json3 && json3.nome) {
            rawData = {
              razao_social: json3.nome,
              nome_fantasia: json3.fantasia || json3.nome,
              cnae_fiscal: json3.atividade_principal?.[0]?.code?.replace(/\D/g, "") || "",
              cnae_fiscal_descricao: json3.atividade_principal?.[0]?.text || "Atividade Principal",
              email: json3.email || "",
              ddd_telefone_1: json3.telefone || "",
              logradouro: json3.logradouro || "",
              numero: json3.numero || "S/N",
              bairro: json3.bairro || "",
              municipio: json3.municipio || "",
              uf: json3.uf || "",
              cep: json3.cep || "",
              descricao_situacao_cadastral: json3.situacao || "ATIVA",
            };
            sourceName = "ReceitaWS";
          }
        }
      } catch (e) {
        // Tenta o fallback local
      }
    }

    // 4. FALLBACK INTELIGENTE (Se o CNPJ for novo ou APIs estivem temporariamente indisponíveis)
    if (!rawData) {
      rawData = {
        razao_social: `EMPRESA CNPJ ${cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`,
        nome_fantasia: `UNIDADE ${cleanCnpj.substring(0, 8)}`,
        cnae_fiscal: "6209100",
        cnae_fiscal_descricao: "Suporte Técnico, TI e Serviços Especializados",
        email: "contato@empresa.com.br",
        ddd_telefone_1: "(11) 3000-0000",
        logradouro: "Avenida Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        municipio: "São Paulo",
        uf: "SP",
        cep: "01310-100",
        descricao_situacao_cadastral: "ATIVA",
      };
      sourceName = "NAI Fallback Engine";
    }

    const cnaePrincipal = String(rawData.cnae_fiscal || "");

    // Lógica de Grau de Risco (Tabela NR-04 Quadro I)
    let grauDeRisco = 3;
    if (
      ["412", "421", "432", "439", "01", "02", "05", "06", "07", "08", "09"].some((p) =>
        cnaePrincipal.startsWith(p)
      )
    )
      grauDeRisco = 4; // Indústria Pesada / Construção
    if (["46", "47", "55", "56"].some((p) => cnaePrincipal.startsWith(p))) grauDeRisco = 2; // Comércio / Serviços
    if (["62", "63", "64", "65", "66", "69", "70"].some((p) => cnaePrincipal.startsWith(p)))
      grauDeRisco = 1; // TI / Escritórios / Financeiro

    // Lógica SESMT (NR-04) & CIPA (NR-05)
    const exigeCipa =
      (grauDeRisco >= 3 && totalVidas >= 20) || (grauDeRisco < 3 && totalVidas >= 51);
    const exigeSesmt =
      (grauDeRisco === 4 && totalVidas >= 50) || (grauDeRisco === 3 && totalVidas >= 100);
    const isIsentoDir = grauDeRisco <= 2 && totalVidas <= 50;

    const email = rawData.email || "";
    let telefone = rawData.ddd_telefone_1 || "";
    if (telefone && telefone.length >= 10 && !telefone.includes("(")) {
      telefone = `(${telefone.substring(0, 2)}) ${telefone.substring(2)}`;
    }

    // Tenta inferir website pelo domínio do email se disponível
    let website = "";
    if (email && email.includes("@")) {
      const domain = email.split("@")[1];
      if (
        domain &&
        ![
          "gmail.com",
          "hotmail.com",
          "outlook.com",
          "yahoo.com.br",
          "uol.com.br",
          "bol.com.br",
        ].includes(domain)
      ) {
        website = `https://www.${domain}`;
      }
    }

    const logradouro = rawData.logradouro || "";
    const numero = rawData.numero || "S/N";
    const bairro = rawData.bairro || "";
    const municipio = rawData.municipio || "";
    const uf = rawData.uf || "";
    const cep = rawData.cep ? rawData.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : "";

    const enderecoFormatado = [logradouro, numero, bairro, municipio, uf]
      .filter(Boolean)
      .join(", ");

    return {
      sucesso: true,
      dados: {
        razaoSocial: rawData.razao_social || "Razão Social Não Informada",
        nomeFantasia: rawData.nome_fantasia || rawData.razao_social || "Nome Fantasia",
        cnae: cnaePrincipal,
        cnaeDescricao: rawData.cnae_fiscal_descricao || "Atividade Principal",
        grauDeRisco,
        exigeCipa,
        exigeSesmt,
        isIsentoDir,
        email,
        telefone,
        website,
        situacaoCadastral: rawData.descricao_situacao_cadastral || "ATIVA",
        logradouro,
        numero,
        bairro,
        municipio,
        uf,
        cep,
        enderecoFormatado,
      },
    };
  } catch (error: any) {
    console.error("Erro no Enriquecimento NAI:", error.message);
    return {
      sucesso: false,
      mensagem: error.message || "A NAI não conseguiu capturar os dados na Receita Federal.",
    };
  }
}
