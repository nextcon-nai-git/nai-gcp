"use server";

/**
 * @fileOverview NAI Brazilian National Holidays Engine.
 * Calcula feriados nacionais fixos e móveis (Páscoa, Carnaval, Sexta-feira Santa, Corpus Christi)
 * para anos entre 1900 e 2199 via algoritmo astronômico e consulta resiliente.
 */

import { ActionResult } from "@/types/schema";

export interface NationalHoliday {
  date: string; // YYYY-MM-DD
  name: string; // Nome do Feriado
  type: "national"; // Tipo do Feriado
  category: "fixo" | "movel";
  weekdayName: string; // Ex: Segunda-feira, Terça-feira...
}

export interface HolidayCalendarData {
  ano: number;
  totalFeriados: number;
  provedor: string;
  feriados: NationalHoliday[];
}

const WEEKDAYS_PT = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/**
 * Algoritmo astronômico de Meeus/Jones/Butcher para cálculo exato da data da Páscoa.
 */
function calcularDataPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const mes = Math.floor((h + L - 7 * m + 114) / 31) - 1; // 0-indexed (2 = Março, 3 = Abril)
  const dia = ((h + L - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(ano, mes, dia));
}

function formatDateIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekdayName(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAYS_PT[date.getUTCDay()];
}

/**
 * Calcula localmente os feriados nacionais (fixos e móveis) para qualquer ano entre 1900 e 2199.
 */
export async function calcularFeriadosNacionaisLocais(ano: number): Promise<NationalHoliday[]> {
  const pascoa = calcularDataPascoa(ano);

  // Feriados móveis derivados da Páscoa
  const carnavalSegunda = new Date(pascoa.getTime() - 48 * 24 * 60 * 60 * 1000);
  const carnavalTerca = new Date(pascoa.getTime() - 47 * 24 * 60 * 60 * 1000);
  const sextaFeiraSanta = new Date(pascoa.getTime() - 2 * 24 * 60 * 60 * 1000);
  const corpusChristi = new Date(pascoa.getTime() + 60 * 24 * 60 * 60 * 1000);

  const feriadosMoveis: { date: string; name: string }[] = [
    { date: formatDateIso(carnavalSegunda), name: "Carnaval (Segunda-feira)" },
    { date: formatDateIso(carnavalTerca), name: "Carnaval (Terça-feira)" },
    { date: formatDateIso(sextaFeiraSanta), name: "Sexta-feira Santa (Paixão de Cristo)" },
    { date: formatDateIso(pascoa), name: "Páscoa" },
    { date: formatDateIso(corpusChristi), name: "Corpus Christi" },
  ];

  // Feriados fixos estabelecidos pela Legislação Federal Brasileira
  const padAno = String(ano);
  const feriadosFixos: { date: string; name: string }[] = [
    { date: `${padAno}-01-01`, name: "Confraternização Universal (Ano Novo)" },
    { date: `${padAno}-04-21`, name: "Tiradentes" },
    { date: `${padAno}-05-01`, name: "Dia Mundial do Trabalho" },
    { date: `${padAno}-09-07`, name: "Independência do Brasil" },
    { date: `${padAno}-10-12`, name: "Nossa Senhora Aparecida (Padroeira do Brasil)" },
    { date: `${padAno}-11-02`, name: "Finados" },
    { date: `${padAno}-11-15`, name: "Proclamação da República" },
    { date: `${padAno}-11-20`, name: "Dia Nacional de Zumbi e da Consciência Negra" }, // Lei Federal nº 14.759/2023
    { date: `${padAno}-12-25`, name: "Natal" },
  ];

  const todosFeriados: NationalHoliday[] = [
    ...feriadosFixos.map((f) => ({
      date: f.date,
      name: f.name,
      type: "national" as const,
      category: "fixo" as const,
      weekdayName: getWeekdayName(f.date),
    })),
    ...feriadosMoveis.map((f) => ({
      date: f.date,
      name: f.name,
      type: "national" as const,
      category: "movel" as const,
      weekdayName: getWeekdayName(f.date),
    })),
  ];

  // Ordena cronologicamente por data
  return todosFeriados.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Consulta feriados brasileiros para um ano especificado (1900 a 2199).
 */
export async function consultarFeriadosNacionais(
  ano: number
): Promise<ActionResult<HolidayCalendarData>> {
  try {
    if (!Number.isInteger(ano) || ano < 1900 || ano > 2199) {
      return {
        sucesso: false,
        mensagem: "O parâmetro 'ano' deve ser um número inteiro válido entre 1900 e 2199.",
      };
    }

    let feriados: NationalHoliday[] = [];
    let provedor = "BrasilAPI";

    // 1. Tenta consultar na BrasilAPI
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/feriados/v1/${encodeURIComponent(String(ano))}`,
        {
          next: { revalidate: 86400 },
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          feriados = json.map((item: any) => ({
            date: item.date,
            name: item.name,
            type: "national" as const,
            category:
              item.name.toLowerCase().includes("carnaval") ||
              item.name.toLowerCase().includes("páscoa") ||
              item.name.toLowerCase().includes("santa") ||
              item.name.toLowerCase().includes("corpus")
                ? "movel"
                : "fixo",
            weekdayName: getWeekdayName(item.date),
          }));
        }
      }
    } catch (e) {
      // Avança para o motor local
    }

    // 2. Fallback: Cálculo matemático local Meeus/Jones/Butcher
    if (feriados.length === 0) {
      feriados = await calcularFeriadosNacionaisLocais(ano);
      provedor = "Motor Matemático NAI (Meeus/Lei 14.759)";
    }

    return {
      sucesso: true,
      dados: {
        ano,
        totalFeriados: feriados.length,
        provedor,
        feriados,
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao calcular a lista de feriados nacionais.",
    };
  }
}
