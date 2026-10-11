"use client";

import * as React from "react";
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DreMonthData {
  mes: string;
  mesAbrev: string;
  receitaBruta: number;
  impostos: number;
  receitasFinanceiras: number;
  custoServicos: number;
  recuperacaoDespesas: number;
  despesasPessoal: number;
  despesasAdmin: number;
  despesasFinanceiras: number;
  despesasVendasMkt: number;
  totalGeral: number;
}

// Base histórica já cadastrada. Preservar os valores de origem até a conciliação.
export const DRE_DATA_2026: DreMonthData[] = [
  {
    mes: "Janeiro",
    mesAbrev: "Jan",
    receitaBruta: 91478.2,
    impostos: -18163.79,
    receitasFinanceiras: 15.02,
    custoServicos: -36769.91,
    recuperacaoDespesas: 0,
    despesasPessoal: -32075.73,
    despesasAdmin: -4324.67,
    despesasFinanceiras: -139.54,
    despesasVendasMkt: -9797.09,
    totalGeral: -9777.51,
  },
  {
    mes: "Fevereiro",
    mesAbrev: "Fev",
    receitaBruta: 95185.83,
    impostos: -16759.59,
    receitasFinanceiras: 0,
    custoServicos: -24265.85,
    recuperacaoDespesas: 0,
    despesasPessoal: -37496.99,
    despesasAdmin: -5896.0,
    despesasFinanceiras: -130.33,
    despesasVendasMkt: -5081.6,
    totalGeral: 5555.47,
  },
  {
    mes: "Março",
    mesAbrev: "Mar",
    receitaBruta: 148068.32,
    impostos: -19484.48,
    receitasFinanceiras: 84.24,
    custoServicos: -28799.08,
    recuperacaoDespesas: 0,
    despesasPessoal: -36228.66,
    despesasAdmin: -6880.6,
    despesasFinanceiras: -288.96,
    despesasVendasMkt: -11301.99,
    totalGeral: 45168.79,
  },
  {
    mes: "Abril",
    mesAbrev: "Abr",
    receitaBruta: 121929.38,
    impostos: -38103.81,
    receitasFinanceiras: 16.77,
    custoServicos: -36566.76,
    recuperacaoDespesas: 0,
    despesasPessoal: -30179.31,
    despesasAdmin: -5518.01,
    despesasFinanceiras: -284.61,
    despesasVendasMkt: -14088.94,
    totalGeral: -2795.29,
  },
  {
    mes: "Maio",
    mesAbrev: "Mai",
    receitaBruta: 97073.68,
    impostos: -19555.07,
    receitasFinanceiras: 60.17,
    custoServicos: -38473.35,
    recuperacaoDespesas: 0,
    despesasPessoal: -34554.56,
    despesasAdmin: -7614.16,
    despesasFinanceiras: -55.59,
    despesasVendasMkt: -12099.36,
    totalGeral: -15218.24,
  },
  {
    mes: "Junho",
    mesAbrev: "Jun",
    receitaBruta: 86251.62,
    impostos: -14173.2,
    receitasFinanceiras: 0,
    custoServicos: -53975.5,
    recuperacaoDespesas: 100.43,
    despesasPessoal: -45947.88,
    despesasAdmin: -3943.86,
    despesasFinanceiras: -25.79,
    despesasVendasMkt: -3803.07,
    totalGeral: -35517.25,
  },
  {
    mes: "Julho",
    mesAbrev: "Jul",
    receitaBruta: 183988.32,
    impostos: -14122.33,
    receitasFinanceiras: 320.73,
    custoServicos: -78244.01,
    recuperacaoDespesas: 0,
    despesasPessoal: -38048.2,
    despesasAdmin: -5913.26,
    despesasFinanceiras: -102.97,
    despesasVendasMkt: -1168.5,
    totalGeral: 46709.78,
  },
  {
    mes: "Agosto",
    mesAbrev: "Ago",
    receitaBruta: 335581.19,
    impostos: -25627.41,
    receitasFinanceiras: 131.63,
    custoServicos: -63723.14,
    recuperacaoDespesas: 0,
    despesasPessoal: -43495.25,
    despesasAdmin: -4355.96,
    despesasFinanceiras: -490.06,
    despesasVendasMkt: -1030.0,
    totalGeral: 196991.0,
  },
];

type DreTotals = Omit<DreMonthData, "mes" | "mesAbrev">;

const DRE_AMOUNT_FIELDS = [
  "receitaBruta",
  "impostos",
  "receitasFinanceiras",
  "custoServicos",
  "recuperacaoDespesas",
  "despesasPessoal",
  "despesasAdmin",
  "despesasFinanceiras",
  "despesasVendasMkt",
  "totalGeral",
] as const satisfies readonly (keyof DreTotals)[];

export function calculateDreTotals(months: readonly DreMonthData[]): DreTotals {
  return Object.fromEntries(
    DRE_AMOUNT_FIELDS.map((field) => [
      field,
      months.reduce((sum, month) => sum + Math.round(month[field] * 100), 0) / 100,
    ])
  ) as DreTotals;
}

export const DRE_TOTALS_2026 = calculateDreTotals(DRE_DATA_2026);
export const DRE_PERIOD_2026 = "Jan–Ago/2026";
export const DRE_SOURCE_NOTE_2026 =
  "Base histórica Nextcon de janeiro a agosto de 2026, pendente de conciliação com o Omie.";
export const DRE_MARGIN_2026 =
  DRE_TOTALS_2026.receitaBruta === 0
    ? null
    : DRE_TOTALS_2026.totalGeral / DRE_TOTALS_2026.receitaBruta;
export const DRE_BEST_MONTH_2026 = DRE_DATA_2026.reduce<DreMonthData | undefined>(
  (best, month) => (!best || month.receitaBruta > best.receitaBruta ? month : best),
  undefined
);

export function formatCurrency(val: number) {
  if (val === 0) return "R$ 0,00";
  const isNegative = val < 0;
  const formatted = Math.abs(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (isNegative) {
    return `- ${formatted}`;
  }
  return formatted;
}

export function DreStatementTab() {
  const exportCsv = () => {
    const headers = [
      "Conta do DRE",
      ...DRE_DATA_2026.map((d) => `${d.mes}/2026`),
      `Total ${DRE_PERIOD_2026}`,
    ];
    const rows = [
      [
        "01. Receita Bruta de Vendas",
        ...DRE_DATA_2026.map((d) => d.receitaBruta.toFixed(2)),
        DRE_TOTALS_2026.receitaBruta.toFixed(2),
      ],
      [
        "02. Impostos",
        ...DRE_DATA_2026.map((d) => d.impostos.toFixed(2)),
        DRE_TOTALS_2026.impostos.toFixed(2),
      ],
      [
        "02. Receitas Financeiras",
        ...DRE_DATA_2026.map((d) => d.receitasFinanceiras.toFixed(2)),
        DRE_TOTALS_2026.receitasFinanceiras.toFixed(2),
      ],
      [
        "02. Custo dos Serviços Prestados",
        ...DRE_DATA_2026.map((d) => d.custoServicos.toFixed(2)),
        DRE_TOTALS_2026.custoServicos.toFixed(2),
      ],
      [
        "02. Recuperação de Despesas Variáveis",
        ...DRE_DATA_2026.map((d) => d.recuperacaoDespesas.toFixed(2)),
        DRE_TOTALS_2026.recuperacaoDespesas.toFixed(2),
      ],
      [
        "01. Despesas com Pessoal",
        ...DRE_DATA_2026.map((d) => d.despesasPessoal.toFixed(2)),
        DRE_TOTALS_2026.despesasPessoal.toFixed(2),
      ],
      [
        "02. Despesas Administrativas",
        ...DRE_DATA_2026.map((d) => d.despesasAdmin.toFixed(2)),
        DRE_TOTALS_2026.despesasAdmin.toFixed(2),
      ],
      [
        "03. Despesas Financeiras",
        ...DRE_DATA_2026.map((d) => d.despesasFinanceiras.toFixed(2)),
        DRE_TOTALS_2026.despesasFinanceiras.toFixed(2),
      ],
      [
        "04. Despesas de Vendas e Marketing",
        ...DRE_DATA_2026.map((d) => d.despesasVendasMkt.toFixed(2)),
        DRE_TOTALS_2026.despesasVendasMkt.toFixed(2),
      ],
      [
        "Total Geral (Resultado Líquido)",
        ...DRE_DATA_2026.map((d) => d.totalGeral.toFixed(2)),
        DRE_TOTALS_2026.totalGeral.toFixed(2),
      ],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Fonte;Base histórica Nextcon cadastrada",
        "Período;Janeiro a agosto de 2026",
        "Situação;Conciliação com o Omie pendente",
        "",
        headers.join(";"),
        ...rows.map((e) => e.join(";")),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "NAI_DRE_Historica_Jan_Ago_2026_Pendente_Conciliacao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <p className="font-semibold">DRE histórica · {DRE_PERIOD_2026}</p>
        <p className="mt-1 text-sm">{DRE_SOURCE_NOTE_2026}</p>
      </div>
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign className="size-6" />
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-black uppercase">
              {DRE_PERIOD_2026}
            </Badge>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Receita Bruta Total
          </p>
          <h3 className="text-3xl font-black font-headline text-primary tracking-tight mt-1">
            {formatCurrency(DRE_TOTALS_2026.receitaBruta)}
          </h3>
          <p className="text-[10px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
            <ArrowUpRight className="size-3.5" /> Receita da base histórica
          </p>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <TrendingUp className="size-6" />
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-none text-[9px] font-black uppercase">
              {DRE_MARGIN_2026 === null
                ? "Margem indisponível"
                : `${DRE_MARGIN_2026.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 })} de margem`}
            </Badge>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Resultado Líquido
          </p>
          <h3 className="text-3xl font-black font-headline text-blue-600 tracking-tight mt-1">
            {formatCurrency(DRE_TOTALS_2026.totalGeral)}
          </h3>
          <p className="text-[10px] font-bold text-slate-500 mt-2">
            Resultado histórico · {DRE_PERIOD_2026}
          </p>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Sparkles className="size-6" />
            </div>
            <Badge className="bg-amber-100 text-amber-800 border-none text-[9px] font-black uppercase">
              Maior receita da base
            </Badge>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {DRE_BEST_MONTH_2026?.mes ?? "Sem competência"} / 2026
          </p>
          <h3 className="text-3xl font-black font-headline text-amber-600 tracking-tight mt-1">
            {formatCurrency(DRE_BEST_MONTH_2026?.receitaBruta ?? 0)}
          </h3>
          <p className="text-[10px] font-bold text-slate-500 mt-2">
            Resultado de {formatCurrency(DRE_BEST_MONTH_2026?.totalGeral ?? 0)}
          </p>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <ArrowDownRight className="size-6" />
            </div>
            <Badge className="bg-rose-100 text-rose-800 border-none text-[9px] font-black uppercase">
              Custos + Folha
            </Badge>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Serviços & Pessoal
          </p>
          <h3 className="text-3xl font-black font-headline text-slate-800 tracking-tight mt-1">
            {formatCurrency(DRE_TOTALS_2026.custoServicos + DRE_TOTALS_2026.despesasPessoal)}
          </h3>
          <p className="text-[10px] font-bold text-rose-600 mt-2">
            Corpo Clínico, Credenciados & Time
          </p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden border-2 border-slate-50">
        <CardHeader className="bg-slate-900 text-white p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-accent text-primary border-none font-black text-[9px] tracking-[0.3em] h-7 px-4 shadow-lg rounded-lg">
                DRE HISTÓRICA
              </Badge>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Conciliação pendente
              </span>
            </div>
            <CardTitle className="text-3xl font-headline font-black uppercase tracking-tight text-white">
              Demonstrativo de Resultados · {DRE_PERIOD_2026}
            </CardTitle>
            <CardDescription className="text-slate-300 font-bold uppercase text-[11px] tracking-[0.3em]">
              Base histórica mensal • Faturamento e despesas Nextcon
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={exportCsv}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-6 gap-2"
            >
              <FileSpreadsheet className="size-4 text-accent" /> Exportar CSV
            </Button>
            <Button
              onClick={() => window.print()}
              className="bg-accent text-primary hover:bg-accent/90 rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-6 gap-2 shadow-xl"
            >
              <Printer className="size-4" /> Imprimir
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto scrollbar-thin">
          <Table className="w-full min-w-[1100px]">
            <TableHeader className="bg-slate-100/80 text-[11px] font-black uppercase tracking-wider text-slate-700">
              <TableRow className="border-b">
                <TableHead className="py-5 pl-8 w-44">Tipo</TableHead>
                <TableHead className="py-5 w-60">Grupo</TableHead>
                <TableHead className="py-5 w-72">Conta do DRE</TableHead>
                {DRE_DATA_2026.map((d) => (
                  <TableHead key={d.mes} className="py-5 text-right font-black">
                    {d.mes}
                  </TableHead>
                ))}
                <TableHead className="py-5 text-right pr-8 font-black text-primary bg-slate-200/60">
                  Total {DRE_PERIOD_2026}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="text-xs">
              {/* 1. LUCRO BRUTO SECTION */}
              <TableRow className="bg-slate-50/70 font-black text-slate-900 border-b border-slate-200">
                <TableCell className="pl-8 font-black uppercase text-primary">
                  1. Lucro Bruto
                </TableCell>
                <TableCell
                  colSpan={11}
                  className="uppercase font-bold text-slate-500 tracking-wider"
                >
                  Receitas e Custos Diretos
                </TableCell>
              </TableRow>

              {/* 01. Receita Bruta */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="font-bold text-slate-600">
                  01. Receita Líquida Operacional
                </TableCell>
                <TableCell className="font-black text-slate-800">
                  01. Receita Bruta de Vendas
                </TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell
                    key={d.mes}
                    className="text-right font-mono font-bold text-emerald-600"
                  >
                    {formatCurrency(d.receitaBruta)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-emerald-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.receitaBruta)}
                </TableCell>
              </TableRow>

              {/* 02. Impostos */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="text-slate-400"></TableCell>
                <TableCell className="font-bold text-rose-600">02. Impostos</TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell key={d.mes} className="text-right font-mono font-medium text-rose-600">
                    {formatCurrency(d.impostos)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-rose-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.impostos)}
                </TableCell>
              </TableRow>

              {/* 02. Receitas Financeiras */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="font-bold text-slate-600">
                  11. Receita Líquida Indireta
                </TableCell>
                <TableCell className="font-bold text-slate-800">02. Receitas Financeiras</TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell
                    key={d.mes}
                    className="text-right font-mono font-medium text-slate-600"
                  >
                    {d.receitasFinanceiras > 0 ? formatCurrency(d.receitasFinanceiras) : "-"}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-slate-800 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.receitasFinanceiras)}
                </TableCell>
              </TableRow>

              {/* 02. Custos Serviços Prestados */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="font-bold text-slate-600">21. Custos</TableCell>
                <TableCell className="font-bold text-rose-600">
                  02. Custo dos Serviços Prestados
                </TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell key={d.mes} className="text-right font-mono font-medium text-rose-600">
                    {formatCurrency(d.custoServicos)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-rose-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.custoServicos)}
                </TableCell>
              </TableRow>

              {/* 2. DESPESAS SECTION */}
              <TableRow className="bg-slate-50/70 font-black text-slate-900 border-b border-slate-200">
                <TableCell className="pl-8 font-black uppercase text-primary">
                  2. Despesas
                </TableCell>
                <TableCell
                  colSpan={11}
                  className="uppercase font-bold text-slate-500 tracking-wider"
                >
                  Despesas Variáveis e Fixas
                </TableCell>
              </TableRow>

              {/* 02. Recuperação de Despesas */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="font-bold text-slate-600">01. Variáveis</TableCell>
                <TableCell className="font-bold text-slate-800">
                  02. Recuperação de Despesas Variáveis
                </TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell
                    key={d.mes}
                    className="text-right font-mono font-medium text-slate-600"
                  >
                    {d.recuperacaoDespesas > 0 ? formatCurrency(d.recuperacaoDespesas) : "-"}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-slate-800 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.recuperacaoDespesas)}
                </TableCell>
              </TableRow>

              {/* 01. Despesas com Pessoal */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="font-bold text-slate-600">11. Fixas</TableCell>
                <TableCell className="font-bold text-rose-600">01. Despesas com Pessoal</TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell key={d.mes} className="text-right font-mono font-medium text-rose-600">
                    {formatCurrency(d.despesasPessoal)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-rose-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.despesasPessoal)}
                </TableCell>
              </TableRow>

              {/* 02. Despesas Administrativas */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="text-slate-400"></TableCell>
                <TableCell className="font-bold text-rose-600">
                  02. Despesas Administrativas
                </TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell key={d.mes} className="text-right font-mono font-medium text-rose-600">
                    {formatCurrency(d.despesasAdmin)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-rose-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.despesasAdmin)}
                </TableCell>
              </TableRow>

              {/* 03. Despesas Financeiras */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="text-slate-400"></TableCell>
                <TableCell className="font-bold text-rose-600">03. Despesas Financeiras</TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell key={d.mes} className="text-right font-mono font-medium text-rose-600">
                    {formatCurrency(d.despesasFinanceiras)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-rose-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.despesasFinanceiras)}
                </TableCell>
              </TableRow>

              {/* 04. Despesas de Vendas e Marketing */}
              <TableRow className="hover:bg-slate-50/80 border-b transition-colors">
                <TableCell className="pl-8 text-slate-400 font-mono"></TableCell>
                <TableCell className="text-slate-400"></TableCell>
                <TableCell className="font-bold text-rose-600">
                  04. Despesas de Vendas e Marketing
                </TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell key={d.mes} className="text-right font-mono font-medium text-rose-600">
                    {formatCurrency(d.despesasVendasMkt)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 font-mono font-black text-rose-700 bg-slate-50">
                  {formatCurrency(DRE_TOTALS_2026.despesasVendasMkt)}
                </TableCell>
              </TableRow>

              {/* TOTAL GERAL (RESULTADO LÍQUIDO) */}
              <TableRow className="bg-slate-900 text-white font-black hover:bg-slate-900 border-t-2 border-slate-900">
                <TableCell
                  className="pl-8 py-6 font-headline uppercase text-base text-accent"
                  colSpan={3}
                >
                  Total Geral (Resultado Líquido)
                </TableCell>
                {DRE_DATA_2026.map((d) => (
                  <TableCell
                    key={d.mes}
                    className={cn(
                      "text-right py-6 font-mono font-black text-sm",
                      d.totalGeral >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {formatCurrency(d.totalGeral)}
                  </TableCell>
                ))}
                <TableCell className="text-right pr-8 py-6 font-mono font-black text-base text-accent bg-slate-950">
                  {formatCurrency(DRE_TOTALS_2026.totalGeral)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
