"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  CONTRACT_FIELDS,
  CONTRACT_REVIEW_NOTES,
  CONTRACT_REVIEW_SOURCES,
  emptyContractFields,
  type ClinicContractFields,
} from "@/lib/clinic-contract";
import type { PeriodicClinic } from "@/lib/avp-periodic-control";

const endpoint = "/api/clients/grupo-avp/clinic-contract";
type Status = { ready: boolean; canUpload: boolean; version: string; name: string };
export function ClinicContractDialog({
  clinic,
  onClose,
}: {
  clinic: PeriodicClinic | null;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [status, setStatus] = useState<Status | null>(null);
  const [fields, setFields] = useState<ClinicContractFields>(() => ({
    ...emptyContractFields(),
    legalName: clinic?.legalNames?.length === 1 ? clinic.legalNames[0] : "",
    cnpj: clinic?.cnpj || "",
    cityUf: clinic?.city && clinic.uf ? `${clinic.city}/${clinic.uf}` : "",
    address: clinic?.addresses.length === 1 ? clinic.addresses[0] : "",
    email: clinic?.emails.length === 1 ? clinic.emails[0] : "",
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ text: string; pending: string[] } | null>(null);
  const owner = useRef(user?.uid);
  const generation = useRef(0);
  const [initialOwner] = useState(user?.uid);
  useLayoutEffect(() => {
    owner.current = user?.uid;
    generation.current++;
  }, [user?.uid]);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );
  async function request(init?: RequestInit, suffix = "") {
    if (!user) throw new Error("Entre novamente para consultar o modelo.");
    const token = await user.getIdToken();
    if (owner.current !== user.uid) throw new Error("Sessão alterada.");
    const response = await fetch(endpoint + suffix, {
      ...init,
      cache: "no-store",
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setStatus(null);
        setPreview(null);
      }
      const result = await response.json();
      throw new Error(result.error || "Não foi possível consultar o modelo.");
    }
    return response;
  }
  useEffect(() => {
    let current = true;
    const uid = user?.uid;
    setStatus(null);
    setPreview(null);
    void (async () => {
      try {
        const response = await request();
        const result = await response.json();
        if (current && owner.current === uid) setStatus(result);
      } catch (e) {
        if (current && owner.current === uid)
          setError(e instanceof Error ? e.message : "Falha ao consultar o modelo.");
      }
    })();
    return () => {
      current = false;
    };
    // Re-fetch only for session changes; the dialog is remounted for each clinic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  async function run(action: () => Promise<void>) {
    const uid = user?.uid,
      id = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      if (owner.current === uid && generation.current === id)
        setError(e instanceof Error ? e.message : "Falha ao preparar o contrato.");
    } finally {
      if (owner.current === uid && generation.current === id) setBusy(false);
    }
  }
  async function download(response: Response, name: string, uid: string | undefined, id: number) {
    const blob = await response.blob();
    if (owner.current !== uid || generation.current !== id) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      name.endsWith(".eml")
        ? "Rascunho baixado com a minuta anexada. Abra no aplicativo de e-mail, revise e envie somente após autorização."
        : "Arquivo baixado para revisão."
    );
  }
  async function prepare(format: "preview" | "docx" | "email") {
    const uid = user?.uid,
      id = generation.current;
    const response = await request({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields, format }),
    });
    if (format === "preview") {
      const result = await response.json();
      if (owner.current === uid && generation.current === id) setPreview(result);
    } else
      await download(
        response,
        format === "email"
          ? "Rascunho_Email_Credenciamento.eml"
          : "Minuta_Credenciamento_NEXTCON.docx",
        uid,
        id
      );
  }
  if (!user || user.uid !== initialOwner) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogTitle>
          {clinic ? `Preparar contrato — ${clinic.name}` : "Modelo de contrato de credenciamento"}
        </DialogTitle>
        <DialogDescription>
          Modelo NEXTCON v2. Gera minutas para revisão e um rascunho de e-mail com o Word anexado. O
          NAI não envia a mensagem nem registra assinatura nesta etapa.
        </DialogDescription>
        <p className="text-sm">
          Condições do original: R$30 por exame clínico; pagamento em 30 dias do recebimento da nota
          fiscal; ASO em 24h sem complementares ou 72h com complementares, com as exclusões de
          contagem previstas na cláusula 7.2; vigência de 12 meses. Valores observados no cadastro
          não alteram estas condições.
        </p>
        <details className="rounded border p-3" open={!clinic}>
          <summary className="cursor-pointer font-semibold">
            Revisão do modelo e pendências antes do envio
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {CONTRACT_REVIEW_NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            As sugestões não alteram o original. Recomenda-se validação jurídica das cláusulas
            indicadas antes da assinatura.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {CONTRACT_REVIEW_SOURCES.map((s) => (
              <a className="underline" key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </details>
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!status && !error && <p role="status">Consultando modelo...</p>}
        {status && (
          <p role="status">
            {status.ready ? `Modelo cadastrado: ${status.name}` : "Modelo ainda não cadastrado."}
          </p>
        )}
        {status && !status.ready && status.canUpload && (
          <label className="grid gap-2 text-sm">
            Cadastrar contrato Word original
            <Input
              type="file"
              accept=".docx"
              disabled={busy}
              aria-label="Cadastrar contrato Word original"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                e.target.value = "";
                if (!selected) return;
                void run(async () => {
                  const uid = user.uid,
                    id = generation.current;
                  const form = new FormData();
                  form.append("file", selected);
                  await request({ method: "POST", body: form });
                  if (owner.current === uid && generation.current === id) {
                    setStatus({ ...status, ready: true });
                    setNotice("Modelo original cadastrado para gerar minutas.");
                  }
                });
              }}
            />
          </label>
        )}
        {status?.ready && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() =>
              void run(async () => {
                const uid = user.uid,
                  id = generation.current;
                await download(
                  await request(undefined, "?download=original"),
                  status.name,
                  uid,
                  id
                );
              })
            }
          >
            Baixar modelo original
          </Button>
        )}
        {clinic && status?.ready && (
          <>
            <p className="text-sm">
              Confira a razão social, os contatos e os dados do representante. Campos em branco
              permanecem sinalizados na minuta. Condições comerciais e datas de assinatura devem ser
              revisadas no Word.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTRACT_FIELDS.map(([key, label]) => (
                <label key={key} className="grid gap-1 text-sm">
                  {label}
                  <Input
                    value={fields[key]}
                    maxLength={300}
                    type={key === "email" || key === "nextconEmail" ? "email" : "text"}
                    disabled={busy}
                    onChange={(e) => {
                      setFields({ ...fields, [key]: e.target.value });
                      setPreview(null);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void run(() => prepare("preview"))}>
                Conferir minuta
              </Button>
              <Button
                disabled={busy || !preview}
                variant="outline"
                onClick={() => void run(() => prepare("docx"))}
              >
                Baixar minuta Word
              </Button>
              <Button
                disabled={busy || !preview || !fields.email}
                variant="outline"
                onClick={() => void run(() => prepare("email"))}
              >
                Baixar rascunho de e-mail
              </Button>
            </div>
            {preview && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">
                  Minuta para revisão — {preview.pending.length} campos ou condições entre colchetes
                  ainda precisam de conferência.
                </p>
                <p className="break-words text-xs">{preview.pending.join(" · ")}</p>
                <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border p-4 font-sans text-sm">
                  {preview.text}
                </pre>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
