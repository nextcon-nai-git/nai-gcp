"use server";

/**
 * @fileOverview NAI TUSS Engine (Terminologia Unificada da Saúde Suplementar).
 * Catalogo de códigos TUSS com suporte a busca parcial (case/acento-insensitive),
 * prefixo de código TUSS, e paginação via limit/offset.
 */

import { ActionResult } from "@/types/schema";

export interface TussTerm {
  tuss: string; // Código TUSS (somente dígitos, ex: "10101012")
  name: string; // Nome/Descrição oficial do termo
  category: string; // Categoria do procedimento (ex: Consultas, Exames Ocupacionais, Análises Clínicas)
  table: string; // Tabela TUSS de origem (ex: "Tabela 22 - Procedimentos e Eventos em Saúde")
}

export interface TussQueryResult {
  total: number;
  limit: number;
  offset: number;
  items: TussTerm[];
}

/**
 * Normaliza string removendo acentos e convertendo para minúsculas.
 */
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Catálogo mestre TUSS Tabela 22 (Medicina Ocupacional e Saúde Suplementar)
 */
const TUSS_CATALOG: TussTerm[] = [
  // CONSULTAS
  {
    tuss: "10101012",
    name: "Consulta médica em consultório (no horário normal ou extraordinário)",
    category: "Consultas",
    table: "Tabela 22",
  },
  {
    tuss: "10101020",
    name: "Consulta médica em domicílio",
    category: "Consultas",
    table: "Tabela 22",
  },
  {
    tuss: "10101039",
    name: "Consulta médica em pronto socorro",
    category: "Consultas",
    table: "Tabela 22",
  },

  // EXAMES CARDIOLÓGICOS E DIAGNÓSTICOS
  {
    tuss: "40101010",
    name: "ECG - Eletrocardiograma de alta resolução",
    category: "Cardiologia",
    table: "Tabela 22",
  },
  {
    tuss: "40101029",
    name: "Eletrocardiograma de repouso convencional de 12 derivações",
    category: "Cardiologia",
    table: "Tabela 22",
  },
  {
    tuss: "40101037",
    name: "Eletroencefalograma convencional (EEG)",
    category: "Neurologia",
    table: "Tabela 22",
  },
  {
    tuss: "40101045",
    name: "Audiometria tonal limiar com testes de discriminação",
    category: "Otorrinolaringologia",
    table: "Tabela 22",
  },
  {
    tuss: "40101053",
    name: "Audiometria vocal - pesquisa de limiar de discriminação (SRT)",
    category: "Otorrinolaringologia",
    table: "Tabela 22",
  },
  {
    tuss: "40101061",
    name: "Espirometria - Prova de Função Pulmonar Completa",
    category: "Pneumologia",
    table: "Tabela 22",
  },
  {
    tuss: "40101070",
    name: "Impedanciometria / Timpanometria",
    category: "Otorrinolaringologia",
    table: "Tabela 22",
  },

  // ANÁLISES CLÍNICAS E LABORATORIAIS (SST)
  {
    tuss: "40301000",
    name: "Hemograma completo com contagem de plaquetas e frações",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301010",
    name: "Glicemia de jejum",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  { tuss: "40301020", name: "Colesterol total", category: "Análises Clínicas", table: "Tabela 22" },
  { tuss: "40301030", name: "Colesterol HDL", category: "Análises Clínicas", table: "Tabela 22" },
  { tuss: "40301040", name: "Colesterol LDL", category: "Análises Clínicas", table: "Tabela 22" },
  { tuss: "40301050", name: "Triglicérides", category: "Análises Clínicas", table: "Tabela 22" },
  { tuss: "40301060", name: "Creatinina", category: "Análises Clínicas", table: "Tabela 22" },
  { tuss: "40301070", name: "Ureia", category: "Análises Clínicas", table: "Tabela 22" },
  {
    tuss: "40301080",
    name: "Transaminase Glutâmica Oxalacética (TGO / AST)",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301090",
    name: "Transaminase Glutâmica Pirúvica (TGP / ALT)",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301100",
    name: "Gama GT (Gama Glutamil Transferase)",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301110",
    name: "Ácido Hipúrico - Dosagem Urinária (Tolueno)",
    category: "Toxicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40301120",
    name: "Ácido Metilhipúrico - Dosagem Urinária (Xileno)",
    category: "Toxicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40301130",
    name: "Ácido Mandélico - Dosagem Urinária (Estireno)",
    category: "Toxicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40301140",
    name: "Carboxihemoglobina sanguínea",
    category: "Toxicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40301150",
    name: "Plumbemia - Chumbo Sanguíneo",
    category: "Toxicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40301160",
    name: "Reticulócitos - Contagem",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301170",
    name: "Urina Tipo I (EAS / Elementos Anormais e Sedimentoscopia)",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301180",
    name: "Parasitológico de Fezes (EPF)",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301190",
    name: "Cultura de Fezes (Coprocultura) para Manipuladores de Alimentos",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },
  {
    tuss: "40301200",
    name: "Cultura de Secreção Orofaringe e Nasofaringe",
    category: "Análises Clínicas",
    table: "Tabela 22",
  },

  // RADIOLOGIA E IMAGEM
  {
    tuss: "40801010",
    name: "Radiografia de Tórax - Padrão OIT (Organização Internacional do Trabalho)",
    category: "Radiologia",
    table: "Tabela 22",
  },
  {
    tuss: "40801020",
    name: "Radiografia de Tórax (PA e Perfil)",
    category: "Radiologia",
    table: "Tabela 22",
  },
  {
    tuss: "40801030",
    name: "Ultrassonografia de Abdômen Total",
    category: "Ultrassonografia",
    table: "Tabela 22",
  },
  {
    tuss: "40801040",
    name: "Ultrassonografia de Ombro e Articulações (LER / DORT)",
    category: "Ultrassonografia",
    table: "Tabela 22",
  },
  {
    tuss: "40801050",
    name: "Tomografia Computadorizada de Tórax de Alta Resolução",
    category: "Tomografia",
    table: "Tabela 22",
  },

  // PROCEDIMENTOS ESPECIAIS & SST
  {
    tuss: "40901010",
    name: "Acuidade Visual e Teste de Visão Ocupacional",
    category: "Oftalmologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40901020",
    name: "Avaliação Psicológica Ocupacional (NR-33 Espaços Confinados e NR-35 Trabalho em Altura)",
    category: "Psicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40901030",
    name: "Exame Toxicológico de Larga Janela de Detecção (Motoristas Profissionais C, D, E)",
    category: "Toxicologia Ocupacional",
    table: "Tabela 22",
  },
  {
    tuss: "40901040",
    name: "Emissão de ASO (Atestado de Saúde Ocupacional) Admissional, Periódico, Demissional, Mudança de Risco ou Retorno ao Trabalho",
    category: "Medicina Ocupacional",
    table: "Tabela 22",
  },
];

export interface SearchTussOptions {
  name?: string;
  tuss?: string;
  limit?: number;
  offset?: number;
}

/**
 * Pesquisa termos TUSS com suporte a filtros e paginação.
 */
export async function listarTermosTuss(
  options: SearchTussOptions = {}
): Promise<ActionResult<TussQueryResult>> {
  try {
    const limit = Math.max(1, options.limit ? Number(options.limit) : 50);
    const offset = Math.max(0, options.offset ? Number(options.offset) : 0);

    const nameQuery = options.name ? removeAccents(options.name) : "";
    const tussQuery = options.tuss ? options.tuss.replace(/\D/g, "") : "";

    const filtered = TUSS_CATALOG.filter((item) => {
      // Filtro por Código TUSS (somente dígitos, compara pelo início)
      if (tussQuery) {
        const itemDigits = item.tuss.replace(/\D/g, "");
        if (!itemDigits.startsWith(tussQuery)) {
          return false;
        }
      }

      // Filtro por Nome (case-insensitive e acento-insensitive)
      if (nameQuery) {
        const itemNameNorm = removeAccents(item.name);
        if (!itemNameNorm.includes(nameQuery)) {
          return false;
        }
      }

      return true;
    });

    const total = filtered.length;
    const paginatedItems = filtered.slice(offset, offset + limit);

    return {
      sucesso: true,
      dados: {
        total,
        limit,
        offset,
        items: paginatedItems,
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao consultar a lista de termos TUSS.",
    };
  }
}
