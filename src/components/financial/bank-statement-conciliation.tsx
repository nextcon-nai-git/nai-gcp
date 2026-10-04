"use client";

import * as React from "react";
import {
  Building2,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  ShieldCheck,
  Stethoscope,
  Users,
  Briefcase,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SANTANDER_STATEMENT_SUMMARY,
  SANTANDER_CONCILIATED_TRANSACTIONS,
  SantanderTransaction,
} from "@/lib/santander-statement-data";

export function BankStatementConciliation() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");

  const filteredTransactions = React.useMemo(() => {
    return SANTANDER_CONCILIATED_TRANSACTIONS.filter((tx) => {
      const matchesSearch =
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.reconciledWith.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.documentNumber && tx.documentNumber.includes(searchTerm));

      const matchesCategory = categoryFilter === "ALL" || tx.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, categoryFilter]);

  // Category totals
  const totalClinics = SANTANDER_CONCILIATED_TRANSACTIONS.filter(
    (t) => t.category === "CLÍNICA CREDENCIADA"
  ).reduce((acc, curr) => acc + curr.amount, 0);

  const totalProviders = SANTANDER_CONCILIATED_TRANSACTIONS.filter(
    (t) => t.category === "PRESTADOR SST"
  ).reduce((acc, curr) => acc + curr.amount, 0);

  const totalTeam = SANTANDER_CONCILIATED_TRANSACTIONS.filter(
    (t) => t.category === "EQUIPE NXC"
  ).reduce((acc, curr) => acc + curr.amount, 0);

  const totalTaxes = SANTANDER_CONCILIATED_TRANSACTIONS.filter(
    (t) => t.category === "TRIBUTOS & IMPOSTOS"
  ).reduce((acc, curr) => acc + curr.amount, 0);

  const totalSoftware = SANTANDER_CONCILIATED_TRANSACTIONS.filter(
    (t) => t.category === "SOFTWARE & SISTEMAS"
  ).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      {/* BANNER PRINCIPAL SANTANDER */}
      <Card className="border-none bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-red-800/30">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-red-600 text-white font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                <CreditCard size={12} /> BANCO SANTANDER EMPRESAS
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-lg flex items-center gap-1">
                <ShieldCheck size={12} /> CONCILIAÇÃO 100% AUDITADA
              </Badge>
            </div>
            <h2 className="text-3xl font-headline font-black tracking-tight text-white uppercase">
              {SANTANDER_STATEMENT_SUMMARY.companyName}
            </h2>
            <p className="text-xs text-slate-300 font-medium flex flex-wrap items-center gap-4">
              <span>
                Agência:{" "}
                <strong className="text-white">{SANTANDER_STATEMENT_SUMMARY.agency}</strong>
              </span>
              <span>•</span>
              <span>
                Conta Corrente:{" "}
                <strong className="text-white">{SANTANDER_STATEMENT_SUMMARY.accountNumber}</strong>
              </span>
              <span>•</span>
              <span>
                Período:{" "}
                <strong className="text-red-300">{SANTANDER_STATEMENT_SUMMARY.period}</strong>
              </span>
            </p>
          </div>

          {/* QUADRO DE SALDO SANTANDER */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4 min-w-[320px] shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Posição do Saldo ({SANTANDER_STATEMENT_SUMMARY.asOfDate})
              </span>
              <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase">
                Disponível
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">
                Saldo Total + Limite Cheque Empresa
              </p>
              <p className="text-3xl font-black text-emerald-400 tracking-tight font-headline">
                {SANTANDER_STATEMENT_SUMMARY.totalAvailableWithLimit.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] border-t border-slate-800/80">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">
                  Invest. ContaMax
                </span>
                <span className="font-extrabold text-white">
                  {SANTANDER_STATEMENT_SUMMARY.investmentContaMax.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">
                  Limite Cheque
                </span>
                <span className="font-extrabold text-slate-300">
                  {SANTANDER_STATEMENT_SUMMARY.creditLimit.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* CARDS DE RESUMO POR CATEGORIA CONCILIADA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-none bg-blue-50/80 rounded-2xl p-5 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
              <Stethoscope size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-blue-900 tracking-wider">
                Clínicas Ocupacionais
              </p>
              <h4 className="text-lg font-black text-blue-950 font-headline">
                {totalClinics.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h4>
            </div>
          </div>
          <p className="text-[10px] text-blue-700 font-bold">Exames, ASOs & Consultas</p>
        </Card>

        <Card className="border-none bg-purple-50/80 rounded-2xl p-5 border border-purple-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-md">
              <Briefcase size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-purple-900 tracking-wider">
                Prestadores SST
              </p>
              <h4 className="text-lg font-black text-purple-950 font-headline">
                {totalProviders.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h4>
            </div>
          </div>
          <p className="text-[10px] text-purple-700 font-bold">Engenharia, Perícias & Laudos</p>
        </Card>

        <Card className="border-none bg-pink-50/80 rounded-2xl p-5 border border-pink-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-pink-600 text-white rounded-xl shadow-md">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-pink-900 tracking-wider">
                Equipe Interna NXC
              </p>
              <h4 className="text-lg font-black text-pink-950 font-headline">
                {totalTeam.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h4>
            </div>
          </div>
          <p className="text-[10px] text-pink-700 font-bold">Kelly, Dra. Charyse, Isabelle, João</p>
        </Card>

        <Card className="border-none bg-amber-50/80 rounded-2xl p-5 border border-amber-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-md">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-amber-900 tracking-wider">
                Tributos & Guias
              </p>
              <h4 className="text-lg font-black text-amber-950 font-headline">
                {totalTaxes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h4>
            </div>
          </div>
          <p className="text-[10px] text-amber-700 font-bold">Receita, Prefeitura, CREA-PR</p>
        </Card>

        <Card className="border-none bg-emerald-50/80 rounded-2xl p-5 border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-emerald-900 tracking-wider">
                Entradas / Receitas
              </p>
              <h4 className="text-lg font-black text-emerald-950 font-headline">
                {SANTANDER_STATEMENT_SUMMARY.totalCredits.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </h4>
            </div>
          </div>
          <p className="text-[10px] text-emerald-700 font-bold">Contratos & Faturamento</p>
        </Card>
      </div>

      {/* CONTROLES DE BUSCA E FILTROS */}
      <Card className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Buscar por favorecido, descrição ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 text-xs rounded-xl border-slate-200"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "ALL", label: "Todos os Lançamentos" },
              { id: "CLÍNICA CREDENCIADA", label: "Clínicas" },
              { id: "PRESTADOR SST", label: "Prestadores SST" },
              { id: "EQUIPE NXC", label: "Equipe NXC" },
              { id: "TRIBUTOS & IMPOSTOS", label: "Tributos" },
              { id: "SOFTWARE & SISTEMAS", label: "Sistemas & Softwares" },
              { id: "FATURAMENTO & RECEITAS", label: "Receitas" },
            ].map((filter) => (
              <Button
                key={filter.id}
                variant={categoryFilter === filter.id ? "default" : "outline"}
                onClick={() => setCategoryFilter(filter.id)}
                className={`h-9 text-[10px] font-black uppercase rounded-xl px-4 ${
                  categoryFilter === filter.id
                    ? "bg-primary text-white"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* TABELA DE EXTRATO CONCILIADO */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-900 text-white">
              <TableRow className="hover:bg-slate-900/90 border-slate-800">
                <TableHead className="text-white text-[10px] font-black uppercase py-3.5 pl-4">
                  Data
                </TableHead>
                <TableHead className="text-white text-[10px] font-black uppercase py-3.5">
                  Histórico Bancário
                </TableHead>
                <TableHead className="text-white text-[10px] font-black uppercase py-3.5">
                  Favorecido / Conciliação
                </TableHead>
                <TableHead className="text-white text-[10px] font-black uppercase py-3.5">
                  Categoria
                </TableHead>
                <TableHead className="text-white text-[10px] font-black uppercase py-3.5 text-right">
                  Valor (R$)
                </TableHead>
                <TableHead className="text-white text-[10px] font-black uppercase py-3.5 text-right pr-4">
                  Saldo Após
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs font-medium divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-extrabold text-slate-900 py-3 pl-4">
                      {tx.formattedDate}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        {tx.type === "CREDIT" ? (
                          <ArrowUpRight size={14} className="text-emerald-600 shrink-0" />
                        ) : (
                          <ArrowDownLeft size={14} className="text-red-500 shrink-0" />
                        )}
                        <span>{tx.description}</span>
                      </div>
                      {tx.documentNumber && (
                        <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                          Doc: {tx.documentNumber}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <p className="font-black text-slate-900">{tx.beneficiary}</p>
                      <span className="text-[10px] text-slate-500 italic block">
                        {tx.reconciledWith}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        className={`text-[8px] font-black uppercase px-2.5 py-0.5 border-none rounded-md ${
                          tx.category === "CLÍNICA CREDENCIADA"
                            ? "bg-blue-100 text-blue-800"
                            : tx.category === "PRESTADOR SST"
                              ? "bg-purple-100 text-purple-800"
                              : tx.category === "EQUIPE NXC"
                                ? "bg-pink-100 text-pink-800"
                                : tx.category === "TRIBUTOS & IMPOSTOS"
                                  ? "bg-amber-100 text-amber-800"
                                  : tx.category === "SOFTWARE & SISTEMAS"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : tx.category === "FATURAMENTO & RECEITAS"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`py-3 text-right font-black ${
                        tx.type === "CREDIT" ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {tx.type === "CREDIT" ? "+" : "-"}
                      {tx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="py-3 text-right pr-4 font-mono font-bold text-slate-500">
                      {tx.balanceAfter.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-slate-400 italic">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
