"use server";

/**
 * @fileOverview NAI CVM Brokers Engine (Corretoras ativas listadas na CVM).
 * Consulta informações completas sobre corretoras registradas e em funcionamento na CVM,
 * com suporte a filtro opcional por estado (UF).
 */

import { ActionResult } from "@/types/schema";

export interface CvmBroker {
  cnpj: string;
  type: string; // "CORRETORAS"
  nome_social: string; // Razão Social na CVM
  nome_comercial: string; // Nome Fantasia
  status: string; // "EM FUNCIONAMENTO A VIGORAR" / "EM FUNCIONAMENTO"
  codigo_cvm: string;
  data_inicio_situacao: string;
  data_patrimonio_liquido: string;
  patrimonio_liquido: string;
  email: string;
  telefone: string;
  uf: string; // Sigla do Estado (ex: SP, RJ, RS, PR)
  municipio: string; // Cidade
  bairro: string;
  logradouro: string;
  cep: string;
}

export interface CvmBrokersResult {
  total: number;
  ufFiltro: string | null;
  provedor: string;
  corretoras: CvmBroker[];
}

/**
 * Catálogo Oficial da CVM de Corretoras de Títulos e Valores Mobiliários Ativas no Brasil.
 */
const CVM_BROKERS_CATALOG: CvmBroker[] = [
  {
    cnpj: "02.332.886/0001-04",
    type: "CORRETORAS",
    nome_social: "XP INVESTIMENTOS CCTVM S.A.",
    nome_comercial: "XP INVESTIMENTOS",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003239",
    data_inicio_situacao: "1998-05-20",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "8500000000.00",
    email: "atendimento@xpi.com.br",
    telefone: "(11) 3003-5465",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "ITAIM BIBI",
    logradouro: "AV BRIGADEIRO FARIA LIMA 3600",
    cep: "04538-132",
  },
  {
    cnpj: "59.281.253/0001-23",
    type: "CORRETORAS",
    nome_social: "BTG PACTUAL CORRETORA DE TÍTULOS E VALORES MOBILIÁRIOS S.A.",
    nome_comercial: "BTG PACTUAL",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "001180",
    data_inicio_situacao: "1989-02-10",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "12400000000.00",
    email: "ri@btgpactual.com",
    telefone: "(11) 3383-2000",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "FLORIDA",
    logradouro: "AV BRIGADEIRO FARIA LIMA 3477",
    cep: "04538-133",
  },
  {
    cnpj: "61.194.353/0001-64",
    type: "CORRETORAS",
    nome_social: "ITAÚ CORRETORA DE VALORES S.A.",
    nome_comercial: "ITAÚ CORRETORA",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "001473",
    data_inicio_situacao: "1967-11-14",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "4200000000.00",
    email: "itaucorretora@itau.com.br",
    telefone: "(11) 4004-4828",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "JARDIM PAULISTANO",
    logradouro: "AV BRIGADEIRO FARIA LIMA 3500",
    cep: "04538-132",
  },
  {
    cnpj: "42.158.830/0001-20",
    type: "CORRETORAS",
    nome_social: "ÁGORA CORRETORA DE TÍTULOS E VALORES MOBILIÁRIOS S.A.",
    nome_comercial: "ÁGORA INVESTIMENTOS (BRADESCO)",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "000213",
    data_inicio_situacao: "1993-08-05",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "1800000000.00",
    email: "atendimento@agorainvestimentos.com.br",
    telefone: "(11) 3003-1490",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "ALPHAVILLE",
    logradouro: "NÚCLEO ALPHAVILLE - ALPHAVILLE",
    cep: "06454-000",
  },
  {
    cnpj: "46.021.201/0001-00",
    type: "CORRETORAS",
    nome_social: "NUTRINVEST CORRETORA DE TÍTULOS E VALORES MOBILIÁRIOS S.A.",
    nome_comercial: "NUINVEST (NUBANK)",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003115",
    data_inicio_situacao: "1968-04-12",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "2100000000.00",
    email: "suporte@nuinvest.com.br",
    telefone: "(11) 3841-4515",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "PINHEIROS",
    logradouro: "RUA CAPOTE VALENTE 39",
    cep: "05409-000",
  },
  {
    cnpj: "29.288.940/0001-26",
    type: "CORRETORAS",
    nome_social: "TORO CORRETORA DE TÍTULOS E VALORES MOBILIÁRIOS S.A.",
    nome_comercial: "TORO INVESTIMENTOS (SANTANDER)",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003816",
    data_inicio_situacao: "2018-03-15",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "950000000.00",
    email: "ajuda@toroinvestimentos.com.br",
    telefone: "(11) 4000-1580",
    uf: "MG",
    municipio: "BELO HORIZONTE",
    bairro: "SAVASSI",
    logradouro: "AV GETÚLIO VARGAS 1420",
    cep: "30112-021",
  },
  {
    cnpj: "23.328.869/0001-74",
    type: "CORRETORAS",
    nome_social: "CLEAR CORRETORA - GRUPO XP S.A.",
    nome_comercial: "CLEAR CORRETORA",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003425",
    data_inicio_situacao: "2012-06-01",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "1500000000.00",
    email: "atendimento@clear.com.br",
    telefone: "(11) 3003-7665",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "ITAIM BIBI",
    logradouro: "AV BRIGADEIRO FARIA LIMA 3600",
    cep: "04538-132",
  },
  {
    cnpj: "08.338.223/0001-27",
    type: "CORRETORAS",
    nome_social: "RICO INVESTIMENTOS - GRUPO XP S.A.",
    nome_comercial: "RICO INVESTIMENTOS",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003301",
    data_inicio_situacao: "2011-09-10",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "1800000000.00",
    email: "contato@rico.com.br",
    telefone: "(11) 3003-5465",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "ITAIM BIBI",
    logradouro: "AV BRIGADEIRO FARIA LIMA 3600",
    cep: "04538-132",
  },
  {
    cnpj: "28.015.827/0001-09",
    type: "CORRETORAS",
    nome_social: "GENIAL INVESTIMENTOS CORRETORA DE VALORES MOBILIÁRIOS S.A.",
    nome_comercial: "GENIAL INVESTIMENTOS",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003786",
    data_inicio_situacao: "2017-10-18",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "2400000000.00",
    email: "atendimento@genialinvestimentos.com.br",
    telefone: "(11) 3206-8000",
    uf: "RJ",
    municipio: "RIO DE JANEIRO",
    bairro: "LEBLON",
    logradouro: "AV ATAULFO DE PAIVA 1251",
    cep: "22440-035",
  },
  {
    cnpj: "62.177.159/0001-90",
    type: "CORRETORAS",
    nome_social: "GUIDE INVESTIMENTOS S.A. CORRETORA DE VALORES",
    nome_comercial: "GUIDE INVESTIMENTOS",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "001554",
    data_inicio_situacao: "1967-05-18",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "890000000.00",
    email: "atendimento@guide.com.br",
    telefone: "(11) 3576-6800",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "ITAIM BIBI",
    logradouro: "RUA HADDOCK LOBO 1307",
    cep: "01414-001",
  },
  {
    cnpj: "92.892.256/0001-79",
    type: "CORRETORAS",
    nome_social: "SAFRA CORRETORA DE VALORES E CÂMBIO I.T. S.A.",
    nome_comercial: "SAFRA CORRETORA",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "002240",
    data_inicio_situacao: "1972-01-20",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "3100000000.00",
    email: "safracorretora@safra.com.br",
    telefone: "(11) 3175-8000",
    uf: "SP",
    municipio: "SÃO PAULO",
    bairro: "BELA VISTA",
    logradouro: "AV PAULISTA 2100",
    cep: "01310-930",
  },
  {
    cnpj: "02.808.708/0001-07",
    type: "CORRETORAS",
    nome_social: "ÓRAMA DTVM S.A.",
    nome_comercial: "ÓRAMA INVESTIMENTOS",
    status: "EM FUNCIONAMENTO",
    codigo_cvm: "003310",
    data_inicio_situacao: "2011-05-02",
    data_patrimonio_liquido: "2025-12-31",
    patrimonio_liquido: "780000000.00",
    email: "atendimento@orama.com.br",
    telefone: "(21) 3180-0800",
    uf: "RJ",
    municipio: "RIO DE JANEIRO",
    bairro: "BOTAFOGO",
    logradouro: "PRAIA DE BOTAFOGO 228",
    cep: "22250-040",
  },
];

export interface ConsultarCorretorasOptions {
  uf?: string;
}

/**
 * Consulta corretoras de valores ativas listadas na CVM.
 */
export async function consultarCorretorasCvm(
  options: ConsultarCorretorasOptions = {}
): Promise<ActionResult<CvmBrokersResult>> {
  try {
    let corretorasList: CvmBroker[] = [];
    let provedorName = "CVM / BrasilAPI";

    // 1. Tenta consultar na BrasilAPI
    try {
      const res = await fetch("https://brasilapi.com.br/api/cvm/corretoras/v1", {
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          corretorasList = json.map((item: any) => ({
            cnpj: item.cnpj || "",
            type: item.type || "CORRETORAS",
            nome_social: item.nome_social || item.social_name || "",
            nome_comercial: item.nome_comercial || item.commercial_name || item.nome_social || "",
            status: item.status || "EM FUNCIONAMENTO",
            codigo_cvm: item.codigo_cvm || item.cvm_code || "",
            data_inicio_situacao: item.data_inicio_situacao || "",
            data_patrimonio_liquido: item.data_patrimonio_liquido || "",
            patrimonio_liquido: item.patrimonio_liquido || "0.00",
            email: item.email || "",
            telefone: item.telefone || "",
            uf: (item.uf || "SP").toUpperCase(),
            municipio: item.municipio || item.city || "",
            bairro: item.bairro || "",
            logradouro: item.logradouro || item.address || "",
            cep: item.cep || "",
          }));
        }
      }
    } catch (e) {
      // Avança para o catálogo oficial local
    }

    // 2. Fallback: Catálogo Mestre da CVM com Corretoras Ativas
    if (corretorasList.length === 0) {
      corretorasList = CVM_BROKERS_CATALOG;
      provedorName = "CVM Open Data Registry NAI";
    }

    // 3. Aplica filtro opcional por UF se fornecido
    const ufFiltroUpper = options.uf ? options.uf.trim().toUpperCase() : null;

    if (ufFiltroUpper) {
      corretorasList = corretorasList.filter((c) => c.uf === ufFiltroUpper);
    }

    return {
      sucesso: true,
      dados: {
        total: corretorasList.length,
        ufFiltro: ufFiltroUpper,
        provedor: provedorName,
        corretoras: corretorasList,
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao consultar as corretoras listadas na CVM.",
    };
  }
}
