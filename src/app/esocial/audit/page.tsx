"use client";

import * as React from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Search,
  Sparkles,
  Send,
  FileCheck,
  TrendingDown,
  BrainCircuit,
  DollarSign,
  ArrowRight,
  Download,
  Share2,
  RefreshCw,
  Building2,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES } from "@/lib/real-data";
import { runEsocialCrossAudit, CrossAuditReport } from "@/ai/flows/esocial-cross-audit-flow";
import { useToast } from "@/hooks/use-toast";

export default function EsocialAuditPage() {
  const { activeClientId } = useSgi();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(false);
  const [report, setReport] = React.useState<CrossAuditReport | null>(null);
  const [filterSeverity, setFilterSeverity] = React.useState<string>("ALL");
  const [searchTerm, setSearchTerm] = React.useState("");

  // Determinar empresa ativa
  const currentCompany = React.useMemo(() => {
    if (!activeClientId || activeClientId === "all") {
      return (
        REAL_COMPANIES[0] || {
          name: "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA",
          cnpj: "44.882.110/0001-92",
        }
      );
    }
    const found = REAL_COMPANIES.find((c) => c.id === activeClientId);
    return found || { name: activeClientId, cnpj: "44.882.110/0001-92" };
  }, [activeClientId]);

  // Carregar auditoria inicial
  const handleRunAudit = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await runEsocialCrossAudit({
        companyName: currentCompany.name,
        cnpj: currentCompany.cnpj,
      });
      setReport(res);
      toast({
        title: "Superauditoria eSocial Concluída!",
        description: `Score de conformidade: ${res.overallComplianceScore}% | Exposição estimada: R$ ${res.totalEstimatedFineExposure.toLocaleString("pt-BR")}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro na auditoria",
        description: err.message || "Falha ao processar cruzamento com o Gemini 3.8.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany, toast]);

  React.useEffect(() => {
    handleRunAudit();
  }, [handleRunAudit]);

  const filteredItems = React.useMemo(() => {
    if (!report) return [];
    return report.crossAudits.filter((item) => {
      const matchSeverity = filterSeverity === "ALL" || item.riskSeverity === filterSeverity;
      const matchSearch =
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hazardDetected.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jobRole.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSeverity && matchSearch;
    });
  }, [report, filterSeverity, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono">
              <BrainCircuit className="size-3.5 mr-1" /> Powered by Gemini 3.8 Flash
            </Badge>
            <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs">
              S-2240 × S-2220 × S-1200
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="size-8 text-amber-400" />
            Superauditoria Fiscal Preditiva eSocial
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cruzamento trilateral em tempo real para prevenção de multas trabalhistas e
            previdenciárias.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunAudit}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg shadow-emerald-900/30"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Auditando via Gemini 3.8..." : "Reprocessar Auditoria"}
          </Button>
        </div>
      </div>

      {/* Empresa Auditada Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
            <Building2 className="size-6 text-sky-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono">EMPRESA ATIVA NA SESSÃO</div>
            <div className="text-lg font-bold text-white">{currentCompany.name}</div>
            <div className="text-xs text-slate-400 font-mono">CNPJ: {currentCompany.cnpj}</div>
          </div>
        </div>

        {report && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-slate-400">Score de Conformidade</div>
              <div
                className={`text-2xl font-black ${
                  report.overallComplianceScore >= 80
                    ? "text-emerald-400"
                    : report.overallComplianceScore >= 60
                      ? "text-amber-400"
                      : "text-rose-400"
                }`}
              >
                {report.overallComplianceScore}%
              </div>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div className="text-right">
              <div className="text-xs text-slate-400">Exposição a Multas</div>
              <div className="text-2xl font-black text-rose-400">
                R${" "}
                {report.totalEstimatedFineExposure.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resumo Estratégico da IA */}
      {report && (
        <Card className="bg-slate-900/50 border-amber-500/30 border-2 rounded-2xl overflow-hidden shadow-xl">
          <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-400 animate-pulse" />
              <CardTitle className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                Parecer Estratégico Executivo (Gemini 3.8 Reasoning)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              "{report.executiveStrategicAdvice}"
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-500" />
          <Input
            placeholder="Buscar por colaborador, risco ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          {["ALL", "CRITICO", "ALTO", "MEDIO"].map((sev) => (
            <Button
              key={sev}
              size="sm"
              variant={filterSeverity === sev ? "default" : "outline"}
              onClick={() => setFilterSeverity(sev)}
              className={
                filterSeverity === sev
                  ? "bg-slate-100 text-slate-900 font-bold"
                  : "border-slate-800 text-slate-400 hover:text-white"
              }
            >
              {sev === "ALL" ? "Todos os Casos" : sev}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabela de Inconsistências Auditadas */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 space-y-4">
            <RefreshCw className="size-10 animate-spin mx-auto text-emerald-400" />
            <p className="font-medium text-sm">
              Gemini 3.8 cruzando dados de PGR, PCMSO e Folha...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            <CheckCircle2 className="size-12 mx-auto text-emerald-400 mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">
              Nenhuma inconsistência fiscal encontrada com estes filtros.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={item.id}
              className="bg-slate-900/70 border-slate-800 hover:border-slate-700 transition-all rounded-2xl overflow-hidden shadow-md"
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info do Colaborador e Risco */}
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-base">{item.employeeName}</span>
                      <span className="text-xs text-slate-400 font-mono">({item.cpf})</span>
                      <Badge
                        className={
                          item.riskSeverity === "CRITICO"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : item.riskSeverity === "ALTO"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                        }
                      >
                        Risco {item.riskSeverity}
                      </Badge>
                      <Badge variant="outline" className="text-slate-400 border-slate-700 text-xs">
                        {item.jobRole} • {item.sector}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        <span className="text-slate-400 font-bold block mb-1">
                          ⚠️ Risco / Agente Nocivo Detectado:
                        </span>
                        <span className="text-amber-300 font-medium">{item.hazardDetected}</span>
                      </div>
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        <span className="text-slate-400 font-bold block mb-1">
                          🩺 Exame Obrigatório Faltante (NR-07):
                        </span>
                        <span className="text-rose-300 font-medium">{item.requiredExam}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 pt-1">
                      <span className="font-semibold text-slate-300">Base Legal:</span>{" "}
                      {item.legalViolation}
                    </div>

                    <div className="bg-emerald-950/20 border border-emerald-800/30 p-2.5 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                      <span>
                        <strong>Ação Corretiva Recomendada:</strong> {item.correctiveAction}
                      </span>
                    </div>
                  </div>

                  {/* Impacto Financeiro e Ações Rápidas */}
                  <div className="flex flex-col lg:items-end justify-between border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6 space-y-4 shrink-0">
                    <div className="text-left lg:text-right">
                      <div className="text-xs text-slate-400">Multa Prevista (Art. 201 CLT)</div>
                      <div className="text-lg font-black text-rose-400 font-mono">
                        R${" "}
                        {item.estimatedFineMin.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        ~ R${" "}
                        {item.estimatedFineMax.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        toast({
                          title: "Convocação Gerada!",
                          description: `Guia de encaminhamento de ${item.requiredExam} enviada para o colaborador ${item.employeeName}.`,
                        });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
                    >
                      <Send className="size-3.5" />
                      Convocar Exame Agora
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
