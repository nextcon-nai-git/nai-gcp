"use client";

import * as React from "react";
import {
  CalendarOff,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcularFaturamentoAlocacaoComFeriados,
  MonthBillingCalculation,
} from "@/actions/holiday-billing-calculator";
import { cn } from "@/lib/utils";

export function HolidayBillingWidget() {
  const [ano, setAno] = React.useState(2026);
  const [mes, setMes] = React.useState(2); // Fevereiro por padrão
  const [taxaDiaria, setTaxaDiaria] = React.useState(200);
  const [qtdProfissionais, setQtdProfissionais] = React.useState(5);
  const [calculation, setCalculation] = React.useState<MonthBillingCalculation | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchCalculation = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await calcularFaturamentoAlocacaoComFeriados(
        ano,
        mes,
        taxaDiaria,
        qtdProfissionais
      );
      setCalculation(res);
    } catch (e) {
      console.error("Erro ao calcular faturamento com feriados:", e);
    } finally {
      setLoading(false);
    }
  }, [ano, mes, taxaDiaria, qtdProfissionais]);

  React.useEffect(() => {
    fetchCalculation();
  }, [fetchCalculation]);

  const handlePrevMonth = () => {
    if (mes === 1) {
      setMes(12);
      setAno((prev) => prev - 1);
    } else {
      setMes((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (mes === 12) {
      setMes(1);
      setAno((prev) => prev + 1);
    } else {
      setMes((prev) => prev + 1);
    }
  };

  return (
    <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden text-left">
      <CardHeader className="p-8 bg-slate-900 text-white relative overflow-hidden space-y-3">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CalendarOff size={140} className="text-accent" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-widest px-3 h-5 mb-2">
              REGRA DE ABONATÓRIO & FATURAMENTO
            </Badge>
            <CardTitle className="text-2xl font-headline font-black uppercase tracking-tight">
              Abatimento de Feriados Nacionais em Equipes Alocadas
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs font-medium mt-1">
              Desconto automático de dias não faturáveis na locação de profissionais em clientes.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl border border-white/20 backdrop-blur-md">
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-xl text-white hover:bg-white/20"
              onClick={handlePrevMonth}
            >
              <ChevronLeft size={18} />
            </Button>
            <span className="font-headline font-black uppercase text-xs tracking-widest px-3 min-w-[120px] text-center">
              {calculation?.nomeMes || "Mês"} / {ano}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-xl text-white hover:bg-white/20"
              onClick={handleNextMonth}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-8">
        {/* PARÂMETROS DO CONTRATO */}
        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1.5">
              <DollarSign size={12} className="text-primary" /> Valor da Diária por Profissional
              (R$)
            </label>
            <Input
              type="number"
              min="0"
              value={taxaDiaria}
              onChange={(e) => setTaxaDiaria(Number(e.target.value) || 0)}
              className="h-12 bg-white border-none rounded-xl font-mono font-bold shadow-inner text-primary text-base"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1.5">
              <Users size={12} className="text-primary" /> Qtd. de Profissionais Alocados
            </label>
            <Input
              type="number"
              min="1"
              value={qtdProfissionais}
              onChange={(e) => setQtdProfissionais(Number(e.target.value) || 1)}
              className="h-12 bg-white border-none rounded-xl font-mono font-bold shadow-inner text-primary text-base"
            />
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
            <Info className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-900 font-medium leading-relaxed">
              <strong>Regra de Negócio NAI:</strong> Em feriados nacionais os profissionais alocados
              não realizam expediente nos clientes. O valor das diárias destes dias é deduzido do
              faturamento mensal.
            </div>
          </div>
        </div>

        {/* CARDS RESUMO DO MÊS */}
        {calculation && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-blue-50/60 rounded-3xl border border-blue-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[9px] font-black uppercase text-blue-700 tracking-widest">
                  Dias Faturáveis Líquidos
                </p>
                <Badge className="bg-blue-600 text-white border-none text-[8px] font-black">
                  {calculation.diasFaturaveisLiquidos} DIAS ÚTEIS
                </Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-black text-primary font-headline">
                  {calculation.horasFaturaveisPorProfissional} hrs
                </h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                  Por Profissional (8h/dia)
                </p>
              </div>
            </div>

            <div className="p-6 bg-red-50/60 rounded-3xl border border-red-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[9px] font-black uppercase text-red-700 tracking-widest">
                  Abatimento Feriados
                </p>

                <Badge className="bg-red-600 text-white border-none text-[8px] font-black">
                  {calculation.feriadosNoMes.filter((f) => f.eDiaUtil).length} DIAS ABATIDOS
                </Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-red-600 font-headline flex items-center gap-1">
                  <TrendingDown size={22} />- R${" "}
                  {calculation.valorAbatimentoFeriados.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </h3>
                <p className="text-[9px] text-red-700/70 font-bold uppercase mt-1">
                  Desconto Faturável no Mês
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  Faturamento Bruto Teorico
                </p>
                <Badge
                  variant="outline"
                  className="text-[8px] font-black uppercase border-slate-200"
                >
                  {calculation.diasUteisBrutos} Dias Úteis
                </Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-slate-700 font-headline">
                  R${" "}
                  {calculation.valorBrutoContrato.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                  Sem considerar feriados
                </p>
              </div>
            </div>

            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">
                  Líquido a Faturar
                </p>
                <Badge className="bg-emerald-600 text-white border-none text-[8px] font-black">
                  VALOR FINAL
                </Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-emerald-700 font-headline">
                  R${" "}
                  {calculation.valorLiquidoFaturavel.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </h3>
                <p className="text-[9px] text-emerald-800/70 font-bold uppercase mt-1">
                  Valor com Abatimento Aplicado
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DETALHAMENTO DE FERIADOS NO MÊS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-primary uppercase flex items-center gap-2">
              <CalendarIcon size={16} className="text-accent" /> Feriados Nacionais em{" "}
              {calculation?.nomeMes} / {ano}
            </h4>
            <Badge
              variant="outline"
              className="text-[9px] font-black uppercase tracking-widest border-slate-200"
            >
              {calculation?.totalFeriadosNacionais || 0} Feriado(s) Encontrado(s)
            </Badge>
          </div>

          <div className="border rounded-[2rem] bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50 text-[8px] uppercase font-black">
                <TableRow>
                  <TableHead className="pl-6 py-4">Data do Feriado</TableHead>
                  <TableHead>Feriado Nacional</TableHead>
                  <TableHead>Dia da Semana</TableHead>
                  <TableHead className="text-center">Tipo de Dia</TableHead>
                  <TableHead className="pr-6 text-right">Impacto no Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculation?.feriadosNoMes.map((feriado) => (
                  <TableRow key={feriado.date} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="pl-6 py-4 font-mono font-bold text-xs text-primary">
                      {feriado.date.split("-").reverse().join("/")}
                    </TableCell>
                    <TableCell className="font-bold text-xs uppercase text-primary">
                      {feriado.name}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-500">
                      {feriado.weekdayName}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase border-none px-2.5 h-5",
                          feriado.eDiaUtil
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {feriado.eDiaUtil ? "DIA ÚTIL (SEGUNDA A SEXTA)" : "FINAL DE SEMANA"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {feriado.eDiaUtil ? (
                        <span className="text-xs font-black text-red-600 flex items-center justify-end gap-1">
                          <TrendingDown size={14} /> - R${" "}
                          {(taxaDiaria * qtdProfissionais).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          Sem Abatimento Extra
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {(!calculation?.feriadosNoMes || calculation.feriadosNoMes.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest"
                    >
                      Nenhum feriado nacional neste mês ({calculation?.nomeMes}). Faturamento sem
                      deduções de feriados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
