"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import {
  ShieldCheck,
  Scale,
  AlertTriangle,
  Loader2,
  FileSearch,
  CheckCircle2,
  Zap,
  ArrowRight,
  ClipboardList,
  Gavel,
  History,
  Terminal,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { runComplianceAudit, type ComplianceOutput } from "@/ai/flows/compliance-auditor-flow";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * @fileOverview NAI Compliance Audit Center.
 * Terminal de auditoria técnica para validação de NRs e eSocial.
 */

export default function ComplianceAuditPage() {
  const { toast } = useToast();
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [result, setResult] = React.useState<ComplianceOutput | null>(null);
  const [inputPayload, setInputPayload] = React.useState("");

  const handleRunAudit = async () => {
    if (!inputPayload.trim()) return;

    setIsAuditing(true);
    setResult(null);

    try {
      let parsed;
      try {
        parsed = JSON.parse(inputPayload);
      } catch (e) {
        throw new Error("O payload deve ser um JSON válido vindo do Data Lab.");
      }

      const audit = await runComplianceAudit(
        {
          analysisPayload: parsed,
          context: "Auditoria de Campo / Quase-Acidente",
        },
        await getActionIdToken()
      );
      setResult(audit);
      toast({
        title: "Auditoria Finalizada",
        description: "O parecer legal foi gerado com base nas NRs.",
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na Auditoria", description: error.message });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-8">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5 uppercase">
            LEGAL COMPLIANCE ENGINE v4.0
          </Badge>
          <h1 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter leading-none">
            Auditoria de NRs
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.3em] mt-2 flex items-center gap-2">
            <Scale className="size-4 text-accent" /> Validação Normativa & Plano de Ação 5W2H.
          </p>
        </div>
        <Badge className="h-12 bg-emerald-600 text-white font-black uppercase text-[10px] gap-3 px-6 flex items-center shadow-2xl rounded-2xl">
          <ShieldCheck className="size-5 text-accent" /> FILTRO ZERO ERROS
        </Badge>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* INPUT DE PAYLOAD */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
              <CardTitle className="text-sm font-black text-primary uppercase">
                Payload de Entrada
              </CardTitle>
              <CardDescription className="text-[9px] font-bold uppercase">
                Cole o JSON do Data Lab aqui.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <textarea
                value={inputPayload}
                onChange={(e) => setInputPayload(e.target.value)}
                placeholder='{ "findings": [...] }'
                className="w-full h-80 bg-slate-950 text-emerald-400 font-mono text-[10px] p-6 rounded-[2rem] border-none shadow-inner resize-none focus:ring-2 ring-accent/20"
              />
              <Button
                onClick={handleRunAudit}
                disabled={isAuditing || !inputPayload}
                className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 btn-hover-effect"
              >
                {isAuditing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Gavel className="size-5 text-accent" />
                )}
                Iniciar Auditoria Legal
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* PARECER TÉCNICO */}
        <div className="lg:col-span-8">
          {!result && !isAuditing ? (
            <div className="h-full min-h-[600px] border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
              <FileSearch size={80} className="text-primary mb-4" />
              <p className="text-xl font-black uppercase tracking-[0.4em] text-primary">
                Aguardando Payload...
              </p>
            </div>
          ) : isAuditing ? (
            <div className="h-full min-h-[600px] bg-slate-50 rounded-[3rem] flex flex-col items-center justify-center text-center p-20 gap-6">
              <Loader2 className="size-16 animate-spin text-primary opacity-20" />
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.5em] text-primary animate-pulse">
                  NAI Cruzando NRs & eSocial...
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Analisando impacto jurídico v4.0
                </p>
              </div>
            </div>
          ) : (
            result && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                {/* HEADER DE RISCO */}
                <Card
                  className={cn(
                    "border-none shadow-2xl rounded-[3rem] overflow-hidden",
                    result.legalRiskLevel === "CRÍTICO"
                      ? "bg-red-600 text-white"
                      : "bg-[#090e24] text-white"
                  )}
                >
                  <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                      <div className="p-5 bg-white/10 rounded-[2rem] border border-white/20 shadow-2xl">
                        <AlertTriangle
                          className={cn(
                            "size-10",
                            result.legalRiskLevel === "CRÍTICO" ? "text-accent" : "text-red-500"
                          )}
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
                          Risco Legal Identificado
                        </p>
                        <h2 className="text-4xl font-black uppercase tracking-tighter font-headline">
                          {result.legalRiskLevel}
                        </h2>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                      {result.applicableNrs.map((nr) => (
                        <Badge
                          key={nr}
                          className="bg-white text-primary border-none font-black h-8 px-4 rounded-xl shadow-lg"
                        >
                          {nr}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* ACHADOS E NORMAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.findings.map((finding, idx) => (
                    <Card
                      key={idx}
                      className="card-shadow border-none bg-white rounded-[2rem] p-8 text-left hover:ring-2 ring-primary/5 transition-all"
                    >
                      <Badge
                        variant="outline"
                        className="text-[8px] font-black border-red-100 text-red-600 bg-red-50 mb-4 h-6 px-3"
                      >
                        REF: {finding.legalBasis}
                      </Badge>
                      <h4 className="text-sm font-black text-primary uppercase leading-tight mb-3">
                        {finding.description}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium italic">
                        Consequência: {finding.consequence}
                      </p>
                    </Card>
                  ))}
                </div>

                {/* PLANO DE AÇÃO 5W2H */}
                <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-8 text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary text-accent rounded-xl shadow-lg">
                        <ClipboardList className="size-5" />
                      </div>
                      <CardTitle className="text-lg font-black text-primary uppercase">
                        Plano de Ação Corretiva (5W2H)
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/50 text-[9px] font-black uppercase">
                        <TableRow>
                          <TableHead className="pl-8">O que (What)</TableHead>
                          <TableHead>Por que (Why)</TableHead>
                          <TableHead>Quem (Who)</TableHead>
                          <TableHead className="pr-8 text-right">Custo Est.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.actionPlan5W2H.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="pl-8 py-5">
                              <p className="font-bold text-xs text-primary">{item.what}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                                Como: {item.how}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-[10px] font-medium text-slate-600 leading-relaxed italic max-w-[200px]">
                                "{item.why}"
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-[10px] font-black text-primary uppercase">
                                {item.who}
                              </p>
                            </TableCell>
                            <TableCell className="pr-8 text-right font-black text-xs text-emerald-600">
                              {item.howMuch}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* ALERTAS PREVENTIVOS */}
                <div className="p-8 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex flex-col gap-4 text-left">
                  <div className="flex items-center gap-3 text-primary font-black uppercase text-xs">
                    <Zap className="size-5 text-accent" /> Alertas Preventivos da Auditoria
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.preventiveAlerts.map((alert, i) => (
                      <div
                        key={i}
                        className="flex gap-3 items-start bg-white/50 p-4 rounded-2xl border border-blue-100"
                      >
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-bold text-blue-900 leading-relaxed">
                          {alert}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] border-primary text-primary"
                  >
                    Rejeitar Parecer
                  </Button>
                  <Button className="flex-1 h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2">
                    <Database className="size-4 text-accent" /> Protocolar Auditoria no SGI
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
