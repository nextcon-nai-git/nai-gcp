"use client";

import { useState } from "react";
import { Copy, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AVP_REQUEST_FIELDS,
  buildAvpSchedulingMessage,
  buildAvpSchedulingWhatsAppUrl,
  isAvpSchedulingRequestComplete,
  type AvpSchedulingRequest,
} from "@/lib/avp-scheduling-request";

export function AvpSchedulingRequestForm() {
  const { toast } = useToast();
  const [request, setRequest] = useState<AvpSchedulingRequest>({
    fullName: "",
    birthDate: "",
    cpf: "",
    rg: "",
    phone: "",
    email: "",
    admissionDate: "",
    role: "",
    unitName: "",
    cnpj: "",
  });
  const [prepared, setPrepared] = useState(false);
  const complete = isAvpSchedulingRequestComplete(request);
  const message = buildAvpSchedulingMessage(request);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Mensagem copiada",
        description: "Cole a mensagem na conversa com a central Nextcon.",
      });
    } catch {
      toast({
        title: "Copie pelo campo de revisão",
        description: "Selecione o texto da mensagem e copie manualmente.",
        variant: "destructive",
      });
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complete) return;
        setPrepared(true);
        toast({
          title: "Solicitação preparada",
          description: "Revise os dados e conclua o envio no WhatsApp da central.",
        });
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AVP_REQUEST_FIELDS.map((field, index) => (
          <div key={field.key} className="space-y-1.5">
            <Label
              htmlFor={"avp-request-" + field.key}
              className="text-xs font-bold text-slate-700"
            >
              {index + 1}. {field.label} *
            </Label>
            <Input
              id={"avp-request-" + field.key}
              name={field.key}
              type={field.type}
              placeholder={field.placeholder}
              required
              value={request[field.key]}
              onChange={(event) =>
                setRequest((previous) => ({ ...previous, [field.key]: event.target.value }))
              }
              className="rounded-xl h-11 text-xs"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs text-slate-600">
          Prepare a mensagem para revisar os 10 dados antes de enviar.
        </p>
        <Button type="submit" disabled={!complete} className="rounded-2xl h-11 gap-2">
          <FileText size={15} /> Preparar solicitação
        </Button>
      </div>
      {prepared && (
        <section
          aria-label="Revisão da solicitação"
          className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <Label htmlFor="avp-request-review" className="font-semibold">
            Revise a mensagem
          </Label>
          <p className="text-xs text-slate-600">Destinatário: central Nextcon — (41) 98716-8938.</p>
          <Textarea
            id="avp-request-review"
            readOnly
            value={message}
            rows={12}
            className="bg-white text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyMessage()}
              className="gap-2"
            >
              <Copy size={14} /> Copiar mensagem
            </Button>
            {complete && (
              <Button asChild className="bg-emerald-700 hover:bg-emerald-800 gap-2">
                <a
                  href={buildAvpSchedulingWhatsAppUrl(message)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare size={14} /> Abrir WhatsApp para enviar
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Finalize o envio na conversa. A central confirma o recebimento e o agendamento; o prazo
            de atendimento começa após receber todos os dados.
          </p>
        </section>
      )}
    </form>
  );
}
