"use client";

import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DigitalSignatureDialogProps<T> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (signatureData: T) => Promise<void>;
  patientName: string;
  doctorProfile: unknown;
}

export function DigitalSignatureDialog<T>({
  isOpen,
  onOpenChange,
  patientName,
}: DigitalSignatureDialogProps<T>) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assinatura digital pendente</DialogTitle>
          <DialogDescription>ASO de {patientName}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="size-5 shrink-0" />
          <p>
            O provedor de assinatura e o certificado do profissional ainda precisam ser configurados
            e validados. O documento permanece pendente de assinatura.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button disabled>Assinatura indisponível</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
