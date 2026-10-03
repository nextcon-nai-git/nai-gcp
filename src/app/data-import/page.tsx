"use client";

import * as React from "react";
import {
  Loader2,
  Database,
  Scale,
  CheckCircle2,
  LayoutGrid,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
  Zap,
  TrendingUp,
  History,
  Users,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { doc, writeBatch, collection } from "firebase/firestore";
import {
  REAL_EMPLOYEES,
  REAL_COMPANIES,
  REAL_EXAMS_HISTORY,
  DRE_2025_HISTORY,
  REAL_CONTRACTS,
  REAL_PROVIDERS,
  REAL_HIERARCHICAL_DATA,
} from "@/lib/real-data";

export default function UnifiedImportCenter() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [uploading, setUploading] = React.useState(false);
  const [uploadingHierarchical, setUploadingHierarchical] = React.useState(false);

  const handleHierarchicalImport = async () => {
    if (!user || !db) return;
    setUploadingHierarchical(true);

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      console.log("🚀 Iniciando Injeção Hierárquica...");

      REAL_HIERARCHICAL_DATA.forEach((client) => {
        // 1. Cria/Atualiza Empresa na Raiz
        const companyRef = doc(db, "companies", client.id_cliente);
        batch.set(
          companyRef,
          {
            id: client.id_cliente,
            name: client.nome_fantasia,
            razao_social: client.razao_social,
            total_vidas: client.total_vidas,
            active: true,
            updatedAt: now,
          },
          { merge: true }
        );

        // 2. Injeta Colaboradores na Subcoleção
        client.colaboradores.forEach((colab) => {
          const colabRef = doc(
            db,
            "companies",
            client.id_cliente,
            "employees",
            colab.id_colaborador
          );
          batch.set(colabRef, {
            ...colab,
            companyId: client.id_cliente,
            status: "active",
            createdAt: now,
          });
        });
      });

      await batch.commit();
      toast({
        title: "Injeção Concluída",
        description: "104 Clientes e 806 Vidas organizados na nova hierarquia.",
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro na Injeção" });
    } finally {
      setUploadingHierarchical(false);
    }
  };

  const handleRealBaseImport = async () => {
    if (!user || !db) return;
    setUploading(true);

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      REAL_COMPANIES.forEach((comp) => {
        const docRef = doc(db, "companies", comp.id);
        batch.set(docRef, { ...comp, updatedAt: now }, { merge: true });
      });

      REAL_CONTRACTS.forEach((contract) => {
        const docRef = doc(db, "companies", contract.companyId, "contracts", contract.id);
        batch.set(docRef, { ...contract, createdAt: now }, { merge: true });
      });

      await batch.commit();
      toast({ title: "Base Global Sincronizada", description: "Empresas e contratos carregados." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na Carga" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-headline font-black text-primary uppercase tracking-tight">
            Carga de Elite 2026
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Injeção massiva de dados para Multiapp e Operações.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="h-16 px-8 border-accent/20 text-accent hover:bg-accent/5 rounded-2xl gap-3 font-black uppercase text-xs tracking-widest"
            onClick={handleHierarchicalImport}
            disabled={uploadingHierarchical}
          >
            {uploadingHierarchical ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Layers className="size-5" />
            )}
            Injetar 806 Vidas (Hierárquico)
          </Button>
          <Button
            className="h-16 px-10 bg-primary text-white hover:bg-primary/90 rounded-2xl shadow-2xl shadow-primary/20 gap-3 font-black uppercase text-xs tracking-widest"
            onClick={handleRealBaseImport}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Database className="size-5 text-accent" />
            )}
            Sincronizar Empresas & Contratos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="p-3 bg-white rounded-2xl w-fit shadow-sm mb-4">
              <FileSpreadsheet className="size-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-black text-primary uppercase">
              Estrutura de Elite
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase opacity-60">
              Isolamento Multi-tenant Ativado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed font-medium italic">
              "Colaboradores injetados como subcoleções de cada empresa, garantindo conformidade
              total com a LGPD e regras de acesso do sistema."
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
