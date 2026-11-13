"use server";

/**
 * @fileOverview NAI Holiday Billing & Allocation Engine.
 * Calcula os dias úteis faturáveis, identifica feriados nacionais do mês (não faturáveis)
 * e aplica o abatimento automático no contrato dos profissionais alocados em clientes.
 */

import { isCalendarDate } from "@/lib/calendar-date";
import { consultarFeriadosNacionais, type NationalHoliday } from "./holidays";

type DataNaoFaturavel = (
  | NationalHoliday
  | {
      date: string;
      name: string;
      weekdayName: string;
      type: "contractual";
    }
) & {
  origem: "contrato" | "calendario";
  diaDaSemanaIndex: number;
  eDiaUtil: boolean;
};

export interface MonthBillingCalculation {
  ano: number;
  mes: number; // 1 - 12
  nomeMes: string;
  totalDiasMes: number;
  diasFinaisDeSemana: number;
  totalFeriadosNacionais: number;
  feriadosNoMes: DataNaoFaturavel[];
  diasUteisBrutos: number;
  diasFaturaveisLiquidos: number;
  horasFaturaveisPorProfissional: number; // considerando 8h/dia
  // Abatimento Financeiro
  taxaDiariaPadrao: number;
  quantidadeProfissionais: number;
  valorBrutoContrato: number;
  valorAbatimentoFeriados: number;
  valorLiquidoFaturavel: number;
}

const PONTO_FACULTATIVO = /carnaval|corpus christi/i;
const NORM_MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Calcula o faturamento descontando feriados nacionais e exclusões contratuais em dias úteis.
 */
export async function calcularFaturamentoAlocacaoComFeriados(
  ano: number,
  mes: number,
  taxaDiariaPadrao: number = 200,
  quantidadeProfissionais: number = 5,
  datasFacultativasContratadas: string[] = []
): Promise<MonthBillingCalculation> {
  if (
    !Number.isInteger(mes) ||
    mes < 1 ||
    mes > 12 ||
    !Number.isFinite(taxaDiariaPadrao) ||
    taxaDiariaPadrao < 0 ||
    !Number.isSafeInteger(quantidadeProfissionais) ||
    quantidadeProfissionais < 1
  )
    throw new Error("Confira o mês, a diária e a quantidade de profissionais.");
  if (
    !Array.isArray(datasFacultativasContratadas) ||
    datasFacultativasContratadas.some((date) => typeof date !== "string" || !isCalendarDate(date))
  )
    throw new Error("Informe datas de contrato válidas no formato AAAA-MM-DD.");
  const resultHolidays = await consultarFeriadosNacionais(ano);
  if (!resultHolidays.sucesso || !resultHolidays.dados) throw new Error("Calendário indisponível.");
  const feriadosAno = resultHolidays.dados.feriados;

  // Dias no mês
  const totalDiasMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesPad = String(mes).padStart(2, "0");

  let diasFinaisDeSemana = 0;
  let diasUteisBrutos = 0;

  const contratuais = new Set(datasFacultativasContratadas);
  const porData = new Map<string, NationalHoliday>();
  for (const feriado of feriadosAno) {
    const facultativo = PONTO_FACULTATIVO.test(feriado.name);
    if (!facultativo || (contratuais.has(feriado.date) && !porData.has(feriado.date))) {
      porData.set(feriado.date, feriado);
    }
  }
  const feriadosNoMes: DataNaoFaturavel[] = [];
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const date = `${ano}-${mesPad}-${String(dia).padStart(2, "0")}`;
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    const diaDaSemanaIndex = data.getUTCDay();
    const eDiaUtil = diaDaSemanaIndex !== 0 && diaDaSemanaIndex !== 6;
    if (eDiaUtil) diasUteisBrutos++;
    else diasFinaisDeSemana++;

    const feriado = porData.get(date);
    if (!feriado && !contratuais.has(date)) continue;
    feriadosNoMes.push({
      ...(feriado ?? {
        date,
        name: "Data não faturável do contrato",
        weekdayName: data.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" }),
        type: "contractual" as const,
      }),
      origem: feriado && !PONTO_FACULTATIVO.test(feriado.name) ? "calendario" : "contrato",
      diaDaSemanaIndex,
      eDiaUtil,
    });
  }

  // Quantidade de feriados que caem em dias úteis (segunda a sexta)
  const feriadosEmDiasUteis = feriadosNoMes.filter((f) => f.eDiaUtil).length;

  // Dias efetivamente faturáveis
  const diasFaturaveisLiquidos = Math.max(0, diasUteisBrutos - feriadosEmDiasUteis);
  const horasFaturaveisPorProfissional = diasFaturaveisLiquidos * 8;

  // Cálculos Financeiros
  const valorBrutoContrato = diasUteisBrutos * taxaDiariaPadrao * quantidadeProfissionais;
  const valorAbatimentoFeriados = feriadosEmDiasUteis * taxaDiariaPadrao * quantidadeProfissionais;
  const valorLiquidoFaturavel = diasFaturaveisLiquidos * taxaDiariaPadrao * quantidadeProfissionais;

  return {
    ano,
    mes,
    nomeMes: NORM_MONTH_NAMES[mes - 1] || `Mês ${mes}`,
    totalDiasMes,
    diasFinaisDeSemana,
    totalFeriadosNacionais: feriadosNoMes.filter((dia) => dia.origem === "calendario").length,
    feriadosNoMes,
    diasUteisBrutos,
    diasFaturaveisLiquidos,
    horasFaturaveisPorProfissional,
    taxaDiariaPadrao,
    quantidadeProfissionais,
    valorBrutoContrato,
    valorAbatimentoFeriados,
    valorLiquidoFaturavel,
  };
}
