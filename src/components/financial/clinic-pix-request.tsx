"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const fields = [
  "Clínica",
  "CNPJ",
  "Colaborador(es)",
  "Exame / Data",
  "Valor total",
  "Chave PIX (titularidade da clínica)",
];
const ownershipNote =
  "A chave PIX deve estar vinculada a uma conta de titularidade da clínica, no CNPJ informado.";

function requestText(data?: FormData) {
  const lines = fields.map((field) => {
    const value = String(data?.get(field) ?? "").trim();
    if (field === "Valor total") {
      const amount =
        value &&
        Number(value).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      return `* ${field}: R$ ${amount}`.trimEnd();
    }
    return `* ${field}: ${value}`.trimEnd();
  });
  return ["SOLICITAÇÃO DE PIX - CLÍNICA", "", ...lines, "", ownershipNote].join("\n");
}

export function ClinicPixRequest() {
  const [notice, setNotice] = useState("");
  const [manualCopy, setManualCopy] = useState("");

  async function copy(data?: FormData) {
    const message = requestText(data);
    try {
      await navigator.clipboard.writeText(message);
      setManualCopy("");
      setNotice(data ? "Solicitação copiada." : "Modelo em branco copiado.");
    } catch {
      setManualCopy(message);
      setNotice("Selecione o texto abaixo para copiar manualmente.");
    }
  }

  return (
    <details className="rounded-lg border bg-card p-4 text-card-foreground">
      <summary className="cursor-pointer text-base font-semibold">
        Solicitação de PIX antecipado para clínica
      </summary>
      <form
        className="mt-4 space-y-4"
        autoComplete="off"
        onChange={() => {
          setManualCopy("");
          setNotice("");
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void copy(new FormData(event.currentTarget));
        }}
      >
        <p className="text-sm">{ownershipNote}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field} className="grid gap-1 text-sm font-medium">
              {field === "Valor total" ? "Valor total (R$)" : field}
              {field === "Colaborador(es)" || field === "Exame / Data" ? (
                <Textarea
                  name={field}
                  rows={2}
                  required
                  onChange={(event) => {
                    const input = event.currentTarget;
                    input.setCustomValidity(input.value.trim() ? "" : "Preencha este campo.");
                  }}
                />
              ) : field === "Valor total" ? (
                <Input
                  name={field}
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                />
              ) : (
                <Input name={field} required pattern={".*\\S.*"} />
              )}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Copiar solicitação</Button>
          <Button type="button" variant="outline" onClick={() => void copy()}>
            Copiar modelo em branco
          </Button>
        </div>
        <p role="status" className="empty:hidden text-sm">
          {notice}
        </p>
        {manualCopy && (
          <Textarea
            aria-label="Texto para cópia manual"
            readOnly
            rows={11}
            value={manualCopy}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </form>
    </details>
  );
}
