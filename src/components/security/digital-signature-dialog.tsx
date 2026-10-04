"use client";

import React, { useState } from "react";
import { ShieldCheck, Key, Loader2, CheckCircle2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DigitalSignatureDialogProps {
  documentTitle: string;
  documentType: "ASO" | "PGR" | "PCMSO" | "LTCAT";
  onSigned?: (signatureHash: string) => void;
}

export function DigitalSignatureDialog({
  documentTitle,
  documentType,
  onSigned,
}: DigitalSignatureDialogProps) {
  const [open, setOpen] = useState(false);
  const [certType, setCertType] = useState<"A1" | "A3">("A1");
  const [password, setPassword] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signatureHash, setSignatureHash] = useState("");

  const handleSign = async () => {
    if (!password && certType === "A1") return;

    setSigning(true);
    // Simula validação e assinatura digital do arquivo via ICP-Brasil
    setTimeout(() => {
      const generatedHash = `SHA256_${Math.random().toString(36).substring(2)}_${Date.now()}`;
      setSignatureHash(generatedHash);
      setSigning(false);
      setSigned(true);
      if (onSigned) onSigned(generatedHash);
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium">
          <ShieldCheck className="h-4 w-4" />
          Assinar Digitalmente ({documentType})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Assinatura Digital ICP-Brasil
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Assine documentos de SST com certificado digital A1 (.pfx) ou A3 (Token/Cartão) com
            validade jurídica.
          </DialogDescription>
        </DialogHeader>

        {!signed ? (
          <div className="space-y-4 py-2">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-xs space-y-1">
              <span className="text-slate-400">Documento Selecionado:</span>
              <p className="font-semibold text-sky-400">{documentTitle}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-300">Tipo de Certificado</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={certType === "A1" ? "default" : "outline"}
                  className={
                    certType === "A1"
                      ? "bg-sky-600 hover:bg-sky-500 text-white"
                      : "border-slate-700 text-slate-300"
                  }
                  onClick={() => setCertType("A1")}
                >
                  Certificado A1 (.PFX)
                </Button>
                <Button
                  type="button"
                  variant={certType === "A3" ? "default" : "outline"}
                  className={
                    certType === "A3"
                      ? "bg-sky-600 hover:bg-sky-500 text-white"
                      : "border-slate-700 text-slate-300"
                  }
                  onClick={() => setCertType("A3")}
                >
                  Certificado A3 (Token)
                </Button>
              </div>
            </div>

            {certType === "A1" ? (
              <div className="space-y-2">
                <Label htmlFor="cert-pass" className="text-xs text-slate-300">
                  Senha do Certificado Digital
                </Label>
                <Input
                  id="cert-pass"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 text-sm"
                />
              </div>
            ) : (
              <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                <Key className="h-4 w-4 shrink-0" />
                Certifique-se de que o Token USB/Cartão A3 está conectado ao computador.
              </div>
            )}

            <Button
              onClick={handleSign}
              disabled={signing || (certType === "A1" && !password)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 mt-2"
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assinando e Gerando Hash ICP-Brasil...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Confirmar e Assinar Documento
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h4 className="font-semibold text-slate-100 text-base">
              Documento Assinado com Sucesso!
            </h4>
            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-left text-[11px] font-mono text-emerald-400 break-all">
              Hash da Assinatura:
              <br />
              {signatureHash}
            </div>
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              className="border-slate-700 text-slate-200 mt-2"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
