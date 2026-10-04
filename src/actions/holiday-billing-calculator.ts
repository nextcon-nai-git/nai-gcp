"use server";

/**
 * @fileOverview NAI Holiday Billing & Allocation Engine.
 * Calcula os dias úteis faturáveis, identifica feriados nacionais do mês (não faturáveis)
 * e aplica o abatimento automático no contrato dos profissionais alocados em clientes.
 */

import { consultarFeriadosNacionais, NationalHoliday } from "./holidays";

export interface MonthBillingCalculation {
  ano: number;
  mes: number; // 1 - 12
  nomeMes: string;
  totalDiasMes: number;
  diasFinaisDeSemana: number;
  totalFeriadosNacionais: number;
  feriadosNoMes: (NationalHoliday & { diaDaSemanaIndex: number; eDiaUtil: boolean })[];
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
 * Calcula o faturamento líquido e dias faturáveis descontando feriados nacionais.
 */
export async function calcularFaturamentoAlocacaoComFeriados(
  ano: number,
  mes: number,
  taxaDiariaPadrao: number = 200,
  quantidadeProfissionais: number = 5
): Promise<MonthBillingCalculation> {
  const resultHolidays = await consultarFeriadosNacionais(ano);
  const feriadosAno =
    resultHolidays.sucesso && resultHolidays.dados ? resultHolidays.dados.feriados : [];

  // Dias no mês
  const totalDiasMes = new Date(ano, mes, 0).getDate();
  const mesPad = String(mes).padStart(2, "0");

  let diasFinaisDeSemana = 0;
  let diasUteisBrutos = 0;

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const dataObj = new Date(Date.UTC(ano, mes - 1, dia));
    const dayOfWeek = dataObj.getUTCDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      diasFinaisDeSemana++;
    } else {
      diasUteisBrutos++;
    }
  }

  // Filtra feriados do mês especificado
  const feriadosNoMes = feriadosAno
    .filter((f) => f.date.startsWith(`${ano}-${mesPad}`))
    .map((f) => {
      const [y, m, d] = f.date.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeek = dateObj.getUTCDay();
      const eDiaUtil = dayOfWeek !== 0 && dayOfWeek !== 6;
      return {
        ...f,
        diaDaSemanaIndex: dayOfWeek,
        eDiaUtil,
      };
    });

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
    totalFeriadosNacionais: feriadosNoMes.length,
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
