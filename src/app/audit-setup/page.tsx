"use client";

import * as React from "react";
import {
  Database,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  FolderTree,
  ArrowLeft,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useStorage } from "@/firebase";
import { doc, writeBatch } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";
import { REAL_COMPANIES, REAL_PROVIDERS } from "@/lib/real-data";
import { calculateDistance } from "@/lib/utils";
import Link from "next/link";

interface Provider {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export default function AuditSetupPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState("");

  async function handleSetup() {
    if (!db || !storage) return;
    setLoading(true);
    setStatus("Iniciando geoprocessamento da rede Nextcon...");

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      // 1. Provisionar Empresas
      setStatus("Sincronizando Unidades Estratégicas...");
      REAL_COMPANIES.forEach((comp) => {
        batch.set(
          doc(db, "companies", comp.id),
          {
            ...comp,
            updatedAt: now,
            active: true,
          },
          { merge: true }
        );
      });
      setProgress(25);

      // 2. Provisionar Prestadores com Geofencing (Raio 50km)
      setStatus("Calculando Raio de 50km para Fornecedores...");
      REAL_PROVIDERS.forEach((provider: Provider) => {
        const servedCompanies = REAL_COMPANIES.filter((comp) => {
          const distance = calculateDistance(provider.lat, provider.lng, comp.lat, comp.lng);
          return distance <= 50;
        }).map((comp) => comp.id);

        batch.set(
          doc(db, "users", provider.id),
          {
            ...provider,
            updatedAt: now,
            active: true,
            servedCompanies: servedCompanies,
            status: "PROVISIONED",
            radius_limit: 50,
          },
          { merge: true }
        );
      });
      setProgress(50);

      // 3. Provisionamento da Inteligência NAI (Pitch de Vendas)
      setStatus("Semeando Inteligência NAI...");
      const naiRef = doc(db, "config_nai_avatar", "pitch_vendas_padrao");
      batch.set(
        naiRef,
        {
          avatar: {
            saudacao_inicial:
              "Olá! Sou a NAI, a Inteligência Artificial da Nextcon. Estou aqui para ajudar você a blindar sua empresa com as melhores práticas de SST e Auditoria. Como posso aju[...]",
          },
          pilares_venda: [
            {
              ordem: 1,
              titulo: "Gestão de PGR e PCMSO",
              resumo: "Elaboração e controle de programas conforme NR-01 e NR-07.",
            },
            {
              ordem: 2,
              titulo: "Auditoria eSocial",
              resumo: "Validação de eventos S-2210, S-2220 e S-2240.",
            },
            {
              ordem: 3,
              titulo: "Consultoria em NRs",
              resumo: "Suporte técnico especializado em todas as Normas Regulamentadoras.",
            },
          ],
          cta_final: "A Nextcon é sobre gestão de conformidade. Blinde sua operação agora.",
          updatedAt: now,
        },
        { merge: true }
      );
      setProgress(75);

      // 4. Provisionamento de Pastas Storage
      setStatus("Sincronizando Hierarquia Multi-tenant...");
      const targetCompanies = REAL_COMPANIES.slice(0, 5);
      const clientFolders = [
        "docs_legais",
        "sst_nrs/nr01_pgr",
        "sst_nrs/nr07_pcmso",
        "saude_gestao/afastados",
      ];

      for (const comp of targetCompanies) {
        for (const folder of clientFolders) {
          await uploadString(ref(storage, `clientes/${comp.id}/${folder}/.keep`), "");
        }
      }

      await batch.commit();
      setProgress(100);
      setStatus("✅ Blindagem Geográfica e Inteligência NAI Ativadas!");

      toast({
        title: "Setup Concluído",
        description: "Geofencing e Configurações da NAI foram ativadas com sucesso.",
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro no Setup Global" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 animate-in fade-in duration-700">
      <Card className="max-w-2xl w-full border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-primary text-white p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <MapPin className="size-48 text-accent" />
          </div>
          <div className="relative z-10 space-y-2">
            <Link href="/data-import">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white -ml-2 mb-4 gap-2"
              >
                <ArrowLeft className="size-4" /> Voltar
              </Button>
            </Link>
            <CardTitle className="text-3xl font-headline font-black uppercase tracking-tight">
              Ativar Infraestrutura NAI
            </CardTitle>
            <CardDescription className="text-white/70 font-bold uppercase text-[10px] tracking-widest">
              Ativação de Geofencing, Inteligência NAI e Storage.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-10 space-y-8">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">
              <span>Status do Provisionamento</span>
              <span className="text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3 bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <MapPin className="size-5 text-primary" />
              <p className="text-[10px] font-black uppercase text-slate-400">Blindagem</p>
              <p className="text-xs font-bold">Filtro de 50km para Prestadores</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <Sparkles className="size-5 text-accent" />
              <p className="text-[10px] font-black uppercase text-slate-400">Inteligência</p>
              <p className="text-xs font-bold">Roteiro de Vendas da NAI</p>
            </div>
          </div>

          {status && (
            <div className="p-5 bg-accent/5 border border-accent/10 rounded-2xl flex items-center gap-4 text-primary">
              {loading ? (
                <Loader2 className="size-5 animate-spin text-accent" />
              ) : (
                <CheckCircle2 className="size-5 text-accent" />
              )}
              <span className="text-xs font-bold italic leading-tight">"{status}"</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-10 bg-slate-50">
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="w-full h-16 bg-primary text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl gap-3"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ShieldCheck className="size-5 text-accent" />
            )}
            Iniciar Provisionamento Global
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
