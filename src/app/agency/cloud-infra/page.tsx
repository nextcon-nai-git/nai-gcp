"use client";

import * as React from "react";
import {
  Cloud,
  Terminal,
  ShieldCheck,
  Zap,
  RefreshCw,
  ExternalLink,
  HardDrive,
  Cpu,
  Network,
  Lock,
  Globe,
  Key,
  AlertCircle,
  Database,
  Box,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * @fileOverview Gestão de Infraestrutura Cloud - 100% Google Cloud / Firebase.
 * Centraliza parâmetros de Cloud Run, Artifact Registry e Cloud Build.
 */

export default function CloudInfraPage() {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const cloudRunParams = [
    { label: "Service Name", value: "nai" },
    { label: "Region", value: "us-central1" },
    { label: "Platform", value: "managed" },
    { label: "Project ID", value: "studio-8439299034-125c7" },
    { label: "Hostname", value: "us-central1-docker.pkg.dev" },
    { label: "Repository", value: "cloud-run-source-deploy" },
    { label: "Trigger ID", value: "94272751-3036-4e36-9c24-43e9b3d723ff" },
  ];

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Infraestrutura Google Cloud
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Hospedagem Exclusiva: Cloud Run • App Hosting • Artifact Registry
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-bold uppercase text-[10px] gap-2"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={isSyncing ? "size-4 animate-spin" : "size-4"} />
            {isSyncing ? "Sincronizando..." : "Verificar Status"}
          </Button>
          <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 gap-2">
            <Zap className="size-4" /> Trigger Cloud Build
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Parâmetros Cloud Build / Run */}
          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-slate-100">
            <CardHeader className="bg-slate-900 text-white border-b pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                  <Cpu className="size-5 text-accent" /> Cloud Engine Parameters
                </CardTitle>
                <Badge className="bg-accent text-primary font-black uppercase text-[8px] px-2 h-5">
                  Configuração Estável
                </Badge>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Definições para implantação via Artifact Registry e Cloud Run.
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

          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-emerald-100/50">
            <CardHeader className="bg-emerald-50 border-b pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
                  <Globe className="size-5 text-emerald-600" /> Domínio de Produção
                </CardTitle>
                <Badge className="bg-emerald-600 text-white font-black uppercase text-[8px] px-2 h-5">
                  Ativo e Estável
                </Badge>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/60">
                Endpoint oficial via Google DNS.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Endereço Principal
                  </p>
                  <h3 className="text-xl font-bold text-primary">nai.nextconsaude.com.br</h3>
                </div>
                <Button
                  className="bg-primary text-white font-black uppercase text-[10px] rounded-xl h-12 px-8 shadow-xl"
                  asChild
                >
                  <a
                    href="https://nai.nextconsaude.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Acessar Produção <ExternalLink className="size-3 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-blue-100/50">
            <CardHeader className="bg-blue-50 border-b pb-6">
              <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
                <Key className="size-5 text-blue-600" /> Verificação de Domínio (DNS)
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-blue-700/60">
                Código obrigatório para validação SSL Google.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">Hostname / Host</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-slate-100 rounded-xl text-xs font-mono font-bold text-primary truncate">
                      _gh-nextcon-sst-e.nai.nextconsaude.com.br
                    </code>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Valor / TXT Value
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-slate-100 rounded-xl text-xs font-mono font-bold text-blue-600">
                      a9925fdf66
                    </code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-[#090e24] text-white border-none p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Cloud className="size-32 text-accent" />
            </div>
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                <Lock className="size-4" /> Cloud Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[9px] font-black uppercase text-white/40 mb-2">Build Image</p>
                  <p className="text-[10px] font-bold font-mono text-accent truncate">
                    us-central1-docker.pkg.dev/studio-8439299034-125c7/cloud-run-source-deploy/nai
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[9px] font-black uppercase text-white/40 mb-2">
                    Deployment Platform
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-xs font-bold uppercase">Google Cloud Run</p>
                  </div>
                </div>
              </div>
              <Button
                className="w-full h-14 bg-accent text-primary font-black uppercase text-[10px] rounded-2xl shadow-xl hover:opacity-90 transition-all"
                asChild
              >
                <a href="https://console.cloud.google.com/run" target="_blank">
                  Console Cloud Run <ExternalLink className="size-3 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-4">
            <div className="size-16 bg-primary/5 rounded-full flex items-center justify-center">
              <Box className="size-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-primary uppercase">Artifact Registry</h4>
              <p className="text-xs text-muted-foreground italic">
                "As imagens de container são armazenadas e versionadas no registro privado do
                Google."
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
