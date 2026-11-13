"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { processAsoPdfAction } from "@/app/actions/ocr-aso";
import type { AsoDraft } from "@/lib/genkit/aso-draft";
export function AsoIngestForm({
  companyId,
  onApply,
  disabled = false,
}: {
  companyId: string;
  onApply: (d: AsoDraft) => void;
  disabled?: boolean;
}) {
  const { user } = useUser(),
    inputId = useId(),
    version = useRef(0);
  const [draft, setDraft] = useState<AsoDraft | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    version.current++;
    setDraft(null);
    setMessage("");
    setBusy(false);
    return () => {
      version.current++;
    };
  }, [companyId, user?.uid]);
  async function read(file?: File) {
    if (!file || !user || disabled) return;
    const id = ++version.current;
    setDraft(null);
    setBusy(false);
    if (
      !file.size ||
      file.size > 10 * 1024 * 1024 ||
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    ) {
      setMessage("Escolha um PDF, JPEG ou PNG de até 10 MiB.");
      return;
    }
    setBusy(true);
    setMessage("Lendo o ASO…");
    try {
      const form = new FormData();
      form.set("asoFile", file);
      const r = await processAsoPdfAction(await user.getIdToken(), companyId, form);
      if (id !== version.current) return;
      if (r.success) {
        if (r.data.documento !== "ASO_INDIVIDUAL") {
          setMessage("Envie um único ASO legível por arquivo.");
          return;
        }
        setDraft(r.data);
        setMessage("Confira a extração antes de preencher os campos.");
      } else setMessage(r.error);
    } catch {
      if (id === version.current) setMessage("A leitura foi interrompida.");
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  return (
    <fieldset
      className="space-y-3 rounded-xl border p-4"
      disabled={disabled}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void read(e.dataTransfer.files[0]);
      }}
    >
      <legend className="px-1 text-sm font-semibold">Preencher pelo ASO</legend>
      <label htmlFor={inputId} className="block text-sm">
        Selecione ou arraste o PDF, JPEG ou PNG de até 10 MiB
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void read(f);
        }}
      />
      <p role="status">{message}</p>
      {draft && (
        <>
          <p className="text-sm">
            CPF {draft.cpfTrabalhador || "ilegível"} · ASO {draft.dataAso || "sem data"} ·{" "}
            {draft.exames.length} procedimento(s)
          </p>
          {draft.pendencias.map((v, i) => (
            <p key={i}>{v}</p>
          ))}
          {draft.agentesNocivosRelacionados.length > 0 && (
            <p>Agentes transcritos: {draft.agentesNocivosRelacionados.join(", ")}</p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              try {
                onApply(draft);
                setDraft(null);
                setMessage(
                  "Rascunho aplicado. Confira o vínculo e informe o responsável pelo PCMSO conforme o documento antes de gerar a prévia."
                );
              } catch {
                setMessage("Confira o CPF. O documento não corresponde ao vínculo fixado.");
              }
            }}
          >
            Aplicar rascunho para revisão
          </Button>
        </>
      )}
    </fieldset>
  );
}
