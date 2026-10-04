"use client";

import * as React from "react";
import {
  Cloud,
  Zap,
  RefreshCw,
  ExternalLink,
  Cpu,
  Globe,
  Key,
  Box,
  Lock,
  CreditCard,
  ShieldAlert,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function CloudInfraPage() {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const cloudRunParams = [
    { label: "Service Name", value: "nai-nextcon" },
    { label: "Region", value: "us-central1" },
    { label: "Project ID", value: "studio-8439299034-125c7" },
    { label: "Production Domain", value: "nai.nextconsaude.com.br" },
    { label: "Artifact Repository", value: "cloud-run-source-deploy" },
    { label: "SSL Status", value: "Active (Global Edge)" },
  ];

  const billingParams = [
    { label: "Billing Account ID", value: "4441-8591-3881-2297" },
    { label: "Account Nickname", value: "Google Cloud 0198EB-D63730-329D81" },
    { label: "Currency", value: "BRL (Real)" },
    { label: "Status", value: "Active" },
  ];

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Infraestrutura Google Cloud
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Domínio Oficial: nai.nextconsaude.com.br
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={isSyncing ? "size-4 animate-spin" : "size-4"} />
            {isSyncing ? "Sincronizando..." : "Verificar Status"}
          </Button>
          <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 gap-2">
            <Zap className="size-4" /> Deploy em Produção
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-slate-100 text-left">
            <CardHeader className="bg-slate-900 text-white border-b pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                  <Cpu className="size-5 text-accent" /> Cloud Engine Parameters
                </CardTitle>
                <Badge className="bg-accent text-primary font-black uppercase text-[8px] px-2 h-5">
                  Versão 2026.1
                </Badge>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Definições para implantação via Firebase App Hosting.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cloudRunParams.map((param) => (
                  <div
                    key={param.label}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all"
                  >
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">
                      {param.label}
                    </p>
                    <code className="text-[11px] font-bold text-primary font-mono block truncate">
                      {param.value}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-blue-100/50 text-left">
            <CardHeader className="bg-blue-50 border-b pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
                  <CreditCard className="size-5 text-blue-600" /> Billing & Payment Profile
                </CardTitle>
                <Badge className="bg-blue-600 text-white font-black uppercase text-[8px] px-2 h-5">
                  Sincronizado
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {billingParams.map((param) => (
                  <div
                    key={param.label}
                    className="p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 transition-all shadow-sm"
                  >
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">
                      {param.label}
                    </p>
                    <p className="text-[11px] font-bold text-primary truncate">{param.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-red-100/50 text-left">
            <CardHeader className="bg-red-50 border-b pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black text-red-600 uppercase flex items-center gap-2">
                  <Database className="size-5" /> Cloud SQL & Network Security
                </CardTitle>
                <Badge className="bg-red-600 text-white font-black uppercase text-[8px] px-2 h-5">
                  Compliance 2026
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="p-5 bg-white rounded-2xl border border-red-100 shadow-sm flex gap-4 items-start">
                <ShieldAlert className="size-5 text-red-500 shrink-0 mt-1" />
                <div className="space-y-2">
                  <h4 className="text-[11px] font-black uppercase text-primary">
                    Private Service Connect (PSC) - Connection Reconciliation
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    A partir de 1º de agosto de 2026, o comportamento de reconciliação de conexões
                    para instâncias de Cloud SQL (MySQL e PostgreSQL) será ativado por padrão. Ao
                    remover um projeto da lista autorizada, todas as conexões PSC existentes serão
                    imediatamente encerradas (reconciliadas), garantindo o isolamento multi-tenant e
                    impedindo acessos residuais não autorizados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 text-left">
          <Card className="bg-[#090e24] text-white border-none p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Cloud className="size-32 text-accent" />
            </div>
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                <Lock className="size-4" /> Segurança de Borda
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <p className="text-xs text-white/60 leading-relaxed font-medium italic">
                "Todo o tráfego é protegido pelo Google Cloud Armor e possui certificação SSL/TLS
                automática."
              </p>
              <Button className="w-full h-14 bg-accent text-primary font-black uppercase text-[10px] rounded-2xl shadow-xl hover:opacity-90 transition-all">
                Ver Logs de Acesso
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
