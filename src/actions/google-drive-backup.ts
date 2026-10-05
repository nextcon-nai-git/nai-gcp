"use server";

/**
 * @fileOverview NAI Google Drive Sync & Backup Service - nextcon@nextconsaude.com.br
 * Realiza backup redundante e espelhamento automático de todos os laudos,
 * recibos de EPI, CNHs e ASOs do sistema no Google Drive corporativo.
 */

import { ActionResult } from "@/types/schema";

export interface GoogleDriveBackupStatus {
  targetEmail: string;
  driveFolderName: string;
  driveProjectId: string;
  driveProjectUrl: string;
  sourceCodeZipUrl: string;
  totalSyncedFiles: number;
  lastSyncAt: string;
  isConnected: boolean;
  driveStorageUsedFormatted: string;
}

export interface DriveSyncInput {
  fileName: string;
  fileCategory:
    | "EPI_RECIBO"
    | "ASO_SAUDE"
    | "CONTRATO_PRESTADOR"
    | "LAUDO_SST"
    | "CNH_DOCUMENTO"
    | "CODIGO_FONTE_SISTEMA";
  companyName: string;
  fileBase64OrUrl?: string;
}

export async function getGoogleDriveBackupStatus(): Promise<GoogleDriveBackupStatus> {
  return {
    targetEmail: "nextcon@nextconsaude.com.br",
    driveFolderName: "",
    driveProjectId: "",
    driveProjectUrl: "",
    sourceCodeZipUrl: "",
    totalSyncedFiles: 0,
    lastSyncAt: "",
    isConnected: false,
    driveStorageUsedFormatted: "Não verificado",
  };
}

export async function syncDocumentToGoogleDrive(
  _input: DriveSyncInput
): Promise<ActionResult<{ fileId: string; driveLink: string }>> {
  return {
    sucesso: false,
    mensagem:
      "Backup Google Drive pendente: configure o destino e a autenticação e confirme o envio do arquivo.",
  };
}
