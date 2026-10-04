"use server";

/**
 * @fileOverview NAI Brazilian Banks Engine (Sistema Bancário do Brasil).
 * Consulta todos os bancos, cooperativas e instituições financeiras autorizadas pelo Banco Central (BCB/ISPB).
 */

import { ActionResult } from "@/types/schema";

export interface BankItem {
  ispb: string; // Código ISPB de 8 dígitos
  name: string; // Nome Abreviado / Comercial
  code: number | null; // Código de Compensação COMPE (3 dígitos, ex: 1, 237, 341, 104)
  fullName: string; // Razão Social completa no Banco Central
  cnpj?: string | null;
  logo_url?: string | null;
}

export interface BanksQueryResult {
  total: number;
  limit: number;
  offset: number;
  provedor: string;
  bancos: BankItem[];
}

export interface SearchBanksOptions {
  code?: string | number;
  ispb?: string;
  name?: string;
  limit?: number;
  offset?: number;
}

/**
 * Normaliza string para busca sem acentos e em caixa baixa.
 */
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Catálogo Mestre de Principais Instituições Financeiras do Brasil (Fallback Local BCB).
 */
const PRINCIPAIS_BANCOS_FALLBACK: BankItem[] = [
  {
    ispb: "00000000",
    name: "BCO DO BRASIL S.A.",
    code: 1,
    fullName: "BANCO DO BRASIL S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00000000.svg",
  },
  {
    ispb: "60701190",
    name: "ITAÚ UNIBANCO S.A.",
    code: 341,
    fullName: "ITAÚ UNIBANCO S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/60701190.svg",
  },
  {
    ispb: "60746948",
    name: "BCO BRADESCO S.A.",
    code: 237,
    fullName: "BANCO BRADESCO S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/60746948.svg",
  },
  {
    ispb: "00360305",
    name: "CAIXA ECONOMICA FEDERAL",
    code: 104,
    fullName: "CAIXA ECONOMICA FEDERAL",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00360305.svg",
  },
  {
    ispb: "90400888",
    name: "BCO SANTANDER (BRASIL) S.A.",
    code: 33,
    fullName: "BANCO SANTANDER (BRASIL) S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/90400888.svg",
  },
  {
    ispb: "18284400",
    name: "NU PAGAMENTOS - NUBANK",
    code: 260,
    fullName: "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/18284400.svg",
  },
  {
    ispb: "00416968",
    name: "BANCO INTER",
    code: 77,
    fullName: "BANCO INTER S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00416968.svg",
  },
  {
    ispb: "07450604",
    name: "BANCO BTG PACTUAL S.A.",
    code: 208,
    fullName: "BANCO BTG PACTUAL S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/07450604.svg",
  },
  {
    ispb: "33885724",
    name: "BANCO C6 S.A.",
    code: 336,
    fullName: "BANCO C6 S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/33885724.svg",
  },
  {
    ispb: "13009717",
    name: "BANCO SAFRA S.A.",
    code: 422,
    fullName: "BANCO SAFRA S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/13009717.svg",
  },
  {
    ispb: "04184779",
    name: "BANCO PAN S.A.",
    code: 623,
    fullName: "BANCO PAN S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/04184779.svg",
  },
  {
    ispb: "00000208",
    name: "BRB - BCO DE BRASILIA",
    code: 70,
    fullName: "BRB - BANCO DE BRASILIA S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00000208.svg",
  },
  {
    ispb: "92702067",
    name: "BCO DO ESTADO DO RS S.A. - BANRISUL",
    code: 41,
    fullName: "Banco do Estado do Rio Grande do Sul S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/92702067.svg",
  },
  {
    ispb: "28195667",
    name: "BANCO NEON",
    code: 536,
    fullName: "NEON PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/28195667.svg",
  },
  {
    ispb: "32062580",
    name: "PICPAY PAGO",
    code: 380,
    fullName: "PICPAY SERVIÇOS S.A.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/32062580.svg",
  },
  {
    ispb: "10264037",
    name: "MERCADO PAGO",
    code: 323,
    fullName: "MERCADO PAGO INSTITUIÇÃO DE PAGAMENTO LTDA.",
    logo_url: "https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/10264037.svg",
  },
];

/**
 * Consulta a lista completa de bancos e cooperativas financeiras do Brasil.
 */
export async function consultarBancosBrasil(
  options: SearchBanksOptions = {}
): Promise<ActionResult<BanksQueryResult>> {
  try {
    const limit = Math.max(1, options.limit ? Number(options.limit) : 100);
    const offset = Math.max(0, options.offset ? Number(options.offset) : 0);

    let bancosList: BankItem[] = [];
    let provedorName = "Banco Central do Brasil / BrasilAPI";

    // 1. Tenta buscar na BrasilAPI
    try {
      const res = await fetch("https://brasilapi.com.br/api/banks/v1", {
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          bancosList = json.map((b: any) => ({
            ispb: String(b.ispb || ""),
            name: b.name || b.fullName || "Instituição Financeira",
            code: b.code !== null && b.code !== undefined ? Number(b.code) : null,
            fullName: b.fullName || b.name || "Instituição Financeira",
            cnpj: b.cnpj || null,
            logo_url: b.logo_url || null,
          }));
        }
      }
    } catch (e) {
      // Avança para o catálogo local
    }

    // 2. Fallback: Catálogo Mestre Local
    if (bancosList.length === 0) {
      bancosList = PRINCIPAIS_BANCOS_FALLBACK;
      provedorName = "NAI Local Banking Engine";
    }

    // 3. Aplica Filtros de Busca
    const nameFilter = options.name ? removeAccents(options.name) : "";
    const ispbFilter = options.ispb ? options.ispb.replace(/\D/g, "") : "";
    const codeFilter =
      options.code !== undefined && options.code !== null
        ? String(options.code).replace(/\D/g, "")
        : "";

    const filtered = bancosList.filter((b) => {
      // Filtro por Código COMPE
      if (codeFilter) {
        if (b.code === null || String(b.code) !== codeFilter) {
          return false;
        }
      }

      // Filtro por ISPB
      if (ispbFilter) {
        if (!b.ispb.includes(ispbFilter)) {
          return false;
        }
      }

      // Filtro por Nome (Case e Acento Insensitive)
      if (nameFilter) {
        const nameNorm = removeAccents(b.name);
        const fullNorm = removeAccents(b.fullName);
        if (!nameNorm.includes(nameFilter) && !fullNorm.includes(nameFilter)) {
          return false;
        }
      }

      return true;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      sucesso: true,
      dados: {
        total,
        limit,
        offset,
        provedor: provedorName,
        bancos: paginated,
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao consultar o sistema bancário brasileiro.",
    };
  }
}
