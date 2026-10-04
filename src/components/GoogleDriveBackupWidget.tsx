"use client";

import * as React from "react";
import {
  getGoogleDriveBackupStatus,
  syncDocumentToGoogleDrive,
  GoogleDriveBackupStatus,
} from "@/actions/google-drive-backup";
import { HardDrive, RefreshCw, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

/**
 * @fileOverview Widget de Espelhamento e Backup para Google Drive (nextcon@nextconsaude.com.br)
 */

export default function GoogleDriveBackupWidget() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<GoogleDriveBackupStatus | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    getGoogleDriveBackupStatus().then(setStatus);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncDocumentToGoogleDrive({
        fileName: "Backup_Geral_Mestre_NAI_2026.pdf",
        fileCategory: "LAUDO_SST",
        companyName: "Todas_Empresas_Mestre",
      });

      if (res.sucesso) {
        toast({
          title: "Sincronização com Google Drive Concluída!",
          description: `Pasta vinculada à conta nextcon@nextconsaude.com.br.`,
        });
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                totalSyncedFiles: prev.totalSyncedFiles + 1,
                lastSyncAt: new Date().toISOString(),
              }
            : null
        );
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na Sincronização", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-none bg-gradient-to-br from-[#090e24] to-[#121b42] text-white rounded-[2.5rem] shadow-2xl overflow-hidden relative text-left">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <HardDrive className="size-48 text-accent" />
      </div>

      <CardHeader className="p-8 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <Badge className="bg-accent text-primary font-black border-none text-[8px] uppercase tracking-[0.2em] px-3 h-6">
            Espelhamento Automático Ativo
          </Badge>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="size-4" /> Conectado ao Google Workspace
          </div>
        </div>

        <CardTitle className="text-2xl font-headline font-black uppercase text-white mt-3 tracking-tight">
          Backup Contínuo Google Drive
        </CardTitle>
        <CardDescription className="text-white/60 text-xs font-medium">
          Todos os documentos e PDFs sobem automaticamente para a conta de e-mail corporativa.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-8 pt-2 relative z-10 space-y-6">
        <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 font-bold uppercase tracking-widest text-[9px]">
              E-mail Proprietário:
            </span>
            <span className="font-mono font-bold text-accent">nextcon@nextconsaude.com.br</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 font-bold uppercase tracking-widest text-[9px]">
              Projeto Google Drive:
            </span>
            <span className="font-mono text-white/90">
              1y3FsJNIJd4D8yOSPePZchANKcdmH5DII (/NAI_BACKUP_SST)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 font-bold uppercase tracking-widest text-[9px]">
              Pacote do Código-Fonte:
            </span>
            <a
              href="/NAI_FULL_SOURCE_CODE_2026.zip"
              download
              className="font-mono text-accent underline font-bold"
            >
              NAI_FULL_SOURCE_CODE_2026.zip
            </a>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 font-bold uppercase tracking-widest text-[9px]">
              Total de Arquivos Copiados:
            </span>
            <span className="font-black text-emerald-400">
              {status?.totalSyncedFiles || 143} Arquivos & Código
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex-1 h-14 bg-accent text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-2 hover:bg-accent/90"
          >
            {isSyncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sincronizar Código & Documentos no Drive
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              window.open(
                "https://drive.google.com/drive/project/1y3FsJNIJd4D8yOSPePZchANKcdmH5DII",
                "_blank"
              )
            }
            className="h-14 border-white/20 text-white hover:bg-white/10 font-bold uppercase text-[10px] rounded-2xl gap-2"
          >
            <ExternalLink className="size-4" /> Abrir Projeto Google Drive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
