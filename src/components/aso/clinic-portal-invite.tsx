"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { formatClinicPortalStatus } from "@/lib/clinic-portal-status";

export function ClinicPortalInvite({
  requestId,
  existingId,
}: {
  requestId: string;
  existingId?: string;
}) {
  const { user } = useUser();
  const [id, setId] = useState(existingId || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [form, setForm] = useState({
    clinicName: "",
    receptionEmail: "",
    doctorEmail: "",
    doctorName: "",
    crm: "",
    uf: "PR",
    days: 14,
    reviewed: false,
  });
  async function call(action: string, payload?: unknown) {
    if (!user || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      if (!alive.current) return;
      const response = await fetch("/api/clinic-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...(id ? { id } : {}), payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!alive.current) return;
      if (result.id) setId(result.id);
      if (result.state) setStatus(formatClinicPortalStatus(result));
      setMessage(
        action === "invite"
          ? "Link criado. Nenhuma mensagem foi enviada."
          : action === "revoke"
            ? "Acesso revogado."
            : "Situação atualizada."
      );
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : "Falha ao concluir.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function downloadSigned() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      if (!alive.current) return;
      const response = await fetch(`/api/clinic-portal/document?id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("ASO ainda não recebido ou acesso indisponível.");
      const blob = await response.blob();
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ASO-NAI.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : "Falha no download.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border border-cyan-700 bg-slate-900 p-5 space-y-4">
      <h3 className="text-lg font-bold">Portal restrito da clínica</h3>
      <p className="text-sm">
        Convite por atendimento, com conta individual e e-mail confirmado. Confira a identidade e o
        CRM do médico antes de liberar acesso.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void call("invite", { ...form, requestId });
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["clinicName", "Clínica", "text"],
              ["receptionEmail", "E-mail individual da recepção (opcional)", "email"],
              ["doctorEmail", "E-mail individual do médico", "email"],
              ["doctorName", "Nome do médico", "text"],
              ["crm", "CRM", "text"],
              ["uf", "UF do CRM", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2"
                type={type}
                required={key !== "receptionEmail"}
                maxLength={key === "uf" ? 2 : 254}
                value={form[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: key === "uf" ? e.target.value.toUpperCase() : e.target.value,
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="block">
          Validade em dias{" "}
          <input
            className="rounded bg-slate-950 p-2"
            type="number"
            min={1}
            max={30}
            value={form.days}
            onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            required
            checked={form.reviewed}
            onChange={(e) => setForm({ ...form, reviewed: e.target.checked })}
          />
          Conferi os destinatários, a identificação profissional, os dados do colaborador e os
          exames com o PGR/PCMSO.
        </label>
        <button
          disabled={busy || !form.reviewed}
          className="rounded bg-cyan-600 p-3 disabled:opacity-50"
        >
          {busy
            ? "Aguarde…"
            : id
              ? "Criar novo convite e revogar o anterior"
              : "Criar link restrito"}
        </button>
      </form>
      {id && (
        <div className="space-y-3">
          <p className="text-sm break-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/portal-clinica/{id}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className="rounded border p-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/portal-clinica/${id}`
                  );
                  if (alive.current) setMessage("Link copiado. Envie ao destinatário autorizado.");
                } catch {
                  if (alive.current) setMessage("Não foi possível copiar o link.");
                }
              }}
            >
              Copiar link para WhatsApp ou e-mail
            </button>
            <button
              disabled={busy}
              className="rounded border p-2"
              onClick={() => void call("status")}
            >
              Consultar andamento
            </button>
            <button
              disabled={busy}
              className="rounded border border-red-500 p-2"
              onClick={() => void call("revoke")}
            >
              Revogar acesso
            </button>
          </div>
          <button
            disabled={busy}
            className="rounded border p-2"
            onClick={() => void downloadSigned()}
          >
            Baixar ASO devolvido para conferência
          </button>
          <p>{status}</p>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
