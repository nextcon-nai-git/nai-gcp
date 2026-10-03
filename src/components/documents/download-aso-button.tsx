"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CloudDownload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Desativa SSR para evitar erros de APIs de browser no servidor
const DynamicPDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((module) => module.PDFDownloadLink),
  { ssr: false }
);
const AsoDocument = dynamic(() => import("./aso-document").then((module) => module.AsoDocument), {
  ssr: false,
});

interface DownloadAsoButtonProps {
  patientData: {
    patientName: string;
    companyName?: string;
    status: string;
    type?: string;
  };
  variant?: "ghost" | "default";
  className?: string;
}

export function DownloadAsoButton({
  patientData,
  variant = "ghost",
  className,
}: DownloadAsoButtonProps) {
  return (
    <DynamicPDFDownloadLink
      document={<AsoDocument {...patientData} />}
      fileName={`ASO_${patientData.patientName.replace(/\s+/g, "_")}.pdf`}
    >
      {({ loading }: any) => (
        <button
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50",
            variant === "ghost"
              ? "h-10 px-4 rounded-xl text-primary hover:bg-primary/5 font-black uppercase text-[9px]"
              : "h-11 px-6 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-lg",
            className
          )}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CloudDownload className="size-3.5" />
          )}
          {loading ? "Processando..." : "Baixar ASO"}
        </button>
      )}
    </DynamicPDFDownloadLink>
  );
}
