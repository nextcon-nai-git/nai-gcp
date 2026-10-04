"use client";

import * as React from "react";
import {
  ShieldCheck,
  Lock,
  Loader2,
  CheckCircle2,
  Fingerprint,
  Key,
  Calendar,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface DigitalSignatureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (signatureData: any) => Promise<void>;
  patientName: string;
  doctorProfile: any;
}

export function DigitalSignatureDialog({
  isOpen,
  onOpenChange,
  onSign,
  patientName,
  doctorProfile,
}: DigitalSignatureDialogProps) {
  const [pin, setPin] = React.useState("");
  const [isSigning, setIsSigning] = React.useState(false);
  const { toast } = useToast();

  const handleSign = async () => {
    if (!pin) {
      toast({
        variant: "destructive",
        title: "PIN Obrigatório",
        description: "Insira a senha do certificado para assinar.",
      });
      return;
    }

    setIsSigning(true);
    try {
      // Simulação de processamento de criptografia ICP-Brasil
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockSignature = {
        hash: Math.random().toString(36).substring(2, 15).toUpperCase(),
        protocol: `ICP-${Date.now()}`,
        certificate_issuer: doctorProfile?.certificate_info?.issuer || "AC SOLUTI Multipla v5",
        timestamp: new Date().toISOString(),
      };

      await onSign(mockSignature);

      toast({
        title: "Documento Assinado!",
        description: "Protocolo ICP-Brasil gerado com sucesso.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na Assinatura",
        description: "Falha ao acessar o provedor de certificado.",
      });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSigning && onOpenChange(open)}>
      <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <DialogHeader className="p-8 bg-[#001F3F] text-white space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Fingerprint className="size-5 text-accent" />
            </div>
            <DialogTitle className="text-xl font-headline font-black uppercase tracking-tight">
              Assinatura ICP-Brasil
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/60 font-medium italic">
            Padrão PAdES - Validade Jurídica Inquestionável para documentos ocupacionais.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 shadow-inner">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Documento em Assinatura:
            </p>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-primary">ASO OCUPACIONAL: {patientName}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Certificado Detectado
              </label>
              <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] uppercase">
                Token Ativo
              </Badge>
            </div>

            <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <UserCheck className="size-3.5 text-slate-400" />{" "}
                {doctorProfile?.name || "Dr. Médico do Trabalho"}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                <Key className="size-3" /> Emissor:{" "}
                {doctorProfile?.certificate_info?.issuer || "AC SOLUTI Multipla v5"}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                <Calendar className="size-3" /> Validade: 12/12/2026
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Senha do Certificado (PIN)
            </label>
            <Input
              type="password"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-14 bg-slate-50 border-none rounded-xl text-center text-xl font-bold tracking-widest shadow-inner focus-visible:ring-primary/10"
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <Lock className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[9px] text-primary/70 leading-relaxed font-medium italic">
              &quot;Esta assinatura possui o mesmo valor jurídico de um reconhecimento de firma em
              cartório, conforme MP 2.200-2/2001.&quot;
            </p>
          </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 gap-3 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSigning}
            className="font-bold uppercase text-[10px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSign}
            disabled={isSigning || !pin}
            className="h-14 px-10 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
          >
            {isSigning ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ShieldCheck className="size-5 text-accent" />
            )}
            Confirmar Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
