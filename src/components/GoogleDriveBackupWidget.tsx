"use client";

import * as React from "react";
import {
  getGoogleDriveBackupStatus,
  syncDocumentToGoogleDrive,
  GoogleDriveBackupStatus,
} from "@/actions/google-drive-backup";
import {
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  FolderGit2,
  Sparkles,
  Loader2,
} from "lucide-react";
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
      } else {
        toast({ variant: "destructive", title: "Backup pendente", description: res.mensagem });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na Sincronização", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup Google Drive</CardTitle>
        <CardDescription>
          {status?.isConnected ? "Conexão verificada" : "Configuração pendente"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {status?.isConnected
            ? `${status.totalSyncedFiles} arquivos confirmados`
            : "O envio de arquivos para o Google Drive ainda não foi configurado. Os documentos salvos no SGI permanecem disponíveis no sistema."}
        </p>
        {status?.lastSyncAt && (
          <p className="text-sm">
            Última confirmação: {new Date(status.lastSyncAt).toLocaleString("pt-BR")}
          </p>
        )}
        <Button onClick={handleManualSync} disabled={!status?.isConnected || isSyncing}>
          Sincronizar arquivos
        </Button>
        {status?.isConnected && status.driveProjectUrl && (
          <Button asChild variant="outline">
            <a href={status.driveProjectUrl} target="_blank" rel="noopener noreferrer">
              Abrir pasta
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
