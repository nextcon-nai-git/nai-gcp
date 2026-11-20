"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVP_RECEIPT_EXAM_TYPES, AVP_ASO_MAX_BYTES, AvpAsoReceiptSchema } from "@/lib/avp-evidence";
import { saoPauloDay } from "@/lib/executive-dashboard";

export function AvpAsoReceipt({
  busy,
  onReceive,
}: {
  busy: boolean;
  onReceive: (payload: FormData) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get("file");
    if (!(file instanceof File) || !file.size || file.size > AVP_ASO_MAX_BYTES) {
      setError("Selecione o PDF do ASO assinado, de até 15 MB.");
      return;
    }
    fields.delete("file");
    const parsed = AvpAsoReceiptSchema.safeParse({
      ...Object.fromEntries(fields),
      onlySignedAso: fields.has("onlySignedAso"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Confira os dados do ASO.");
      return;
    }
    setError("");
    const payload = new FormData();
    payload.set("receipt", JSON.stringify(parsed.data));
    payload.set("file", file);
    if (await onReceive(payload)) form.reset();
  }
  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Receber ASO assinado</summary>
      <form onSubmit={submit} className="mt-4">
        <fieldset disabled={busy} className="grid gap-3 text-sm sm:grid-cols-2">
          <label>
            Colaborador no ASO
            <Input name="employee" required minLength={2} maxLength={240} />
          </label>
          <label>
            Código do colaborador no SOC (opcional)
            <Input name="socEmployeeCode" maxLength={80} />
          </label>
          <label>
            Empregador no ASO
            <Input name="company" required maxLength={240} />
          </label>
          <label>
            CNPJ do empregador no ASO
            <Input name="companyCnpj" required maxLength={24} />
          </label>
          <label>
            Tipo do exame
            <select
              name="examType"
              className="block w-full rounded border p-2"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione o tipo
              </option>
              {AVP_RECEIPT_EXAM_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Situação do vínculo
            <select
              name="review"
              defaultValue="Conferir vínculo"
              className="block w-full rounded border p-2"
            >
              <option>Conferir vínculo</option>
              <option>Conferir retificação</option>
              <option value="Recebido">Vínculo conferido</option>
            </select>
          </label>
          <label>
            Data do exame
            <Input name="examDate" type="date" required />
          </label>
          <label>
            Data do recebimento
            <Input
              name="receivedDate"
              type="date"
              required
              defaultValue={saoPauloDay(new Date())}
            />
          </label>
          <label className="sm:col-span-2">
            Origem do documento
            <Input
              name="source"
              placeholder="Link do Drive ou referência da remessa"
              required
              maxLength={500}
            />
          </label>
          <label className="sm:col-span-2">
            Observações da conferência (opcional)
            <Input
              name="notes"
              placeholder="Ex.: divergência entre o empregador do ASO e o cabeçalho da ficha"
              maxLength={3000}
            />
          </label>
          <label className="sm:col-span-2">
            PDF do ASO assinado
            <Input type="file" name="file" required accept=".pdf,application/pdf" />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="onlySignedAso" required />
            Conferi que o PDF contém somente o ASO assinado. A ficha clínica fica no prontuário.
          </label>
          {error && (
            <p role="alert" className="text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <Button type="submit" className="justify-self-start">
            Salvar ASO e anexo
          </Button>
        </fieldset>
      </form>
    </details>
  );
}
