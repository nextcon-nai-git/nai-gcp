"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Upload, ExternalLink } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { parseActionLines, type ClientDocument } from "@/lib/client-documents";

export function ClientDocuments({ companyId }: { companyId: string }) {
  const { user } = useUser();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [source, setSource] = useState<File | null>(null);
  const [actions, setActions] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<string | null>(null);
  const chooser = useRef<HTMLInputElement>(null);
  const endpoint = `/api/clients/${encodeURIComponent(companyId)}/documents`;
  const request = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) throw new Error("Entre no NAI para acessar os documentos.");
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok)
        throw new Error((await response.json()).error || "Falha ao acessar documentos.");
      return response;
    },
    [user]
  );
  useEffect(() => {
    let active = true;
    setDocuments([]);
    setError("");
    setNotice("");
    setPdf(null);
    setSource(null);
    setActions("");
    async function load() {
      try {
        const data = await (await request(endpoint)).json();
        if (active) setDocuments(data.documents);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Falha ao carregar.");
      }
    }
    if (user) void load();
    return () => {
      active = false;
    };
  }, [endpoint, request, user]);
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf);
    },
    [pdf]
  );
  async function save() {
    if (!source) {
      setError("Selecione o PDF original.");
      return;
    }
    let parsed;
    try {
      parsed = parseActionLines(actions);
    } catch {
      setError(
        "Use até 50 linhas: título (3 a 180 caracteres) | orientações (3 a 3.000 caracteres)."
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData();
      data.append("source", source);
      data.append("actions", JSON.stringify(parsed));
      const saved = await (await request(endpoint, { method: "POST", body: data })).json();
      setDocuments((await (await request(endpoint)).json()).documents);
      setNotice(
        saved.alreadySaved
          ? `Documento já cadastrado, com ${saved.taskCount} cards. Nenhuma duplicação criada.`
          : `Documento salvo neste cliente e ${saved.taskCount} cards criados em A fazer.`
      );
      setSource(null);
      setActions("");
      if (chooser.current) chooser.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      setPdf(URL.createObjectURL(await (await request(`${endpoint}?pdf=${id}`)).blob()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <FileText size={21} />
            Documentos e ações do cliente
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Editais, contratos e anexos com ações vinculadas ao documento de origem.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/action-plans?company=${encodeURIComponent(companyId)}`}>
            Abrir cards do cliente <ExternalLink size={15} />
          </Link>
        </Button>
      </div>
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 text-red-800 p-3 text-sm">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {documents.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap justify-between items-center gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="font-semibold text-sm">{d.name}</p>
              <p className="text-xs text-slate-500">
                {d.taskCount} cards vinculados · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Button variant="outline" disabled={busy} onClick={() => void open(d.id)}>
              Ver documento original
            </Button>
          </div>
        ))}
      </div>
      <details className="rounded-xl bg-slate-50 p-4" open={!!source}>
        <summary className="font-semibold cursor-pointer">Adicionar documento e ações</summary>
        <div className="pt-4 space-y-4">
          <input
            ref={chooser}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => setSource(e.target.files?.[0] || null)}
          />
          <Button variant="outline" disabled={busy} onClick={() => chooser.current?.click()}>
            <Upload size={16} />
            Selecionar PDF
          </Button>
          <span className="text-sm ml-3">{source?.name || "PDF de até 15 MB"}</span>
          <div>
            <label htmlFor="client-action-lines" className="text-sm font-semibold">
              Ações do documento
            </label>
            <p className="text-xs text-slate-500 my-1">
              Uma ação por linha: título | orientações, referência e prazo previsto. Deixe vazio
              para anexar somente o PDF.
            </p>
            <textarea
              id="client-action-lines"
              value={actions}
              disabled={busy}
              onChange={(e) => setActions(e.target.value)}
              rows={7}
              className="w-full rounded-xl border p-3 text-sm"
              placeholder="Revisar PGR | Item 4.1; conferir escopo e prazo no contrato"
            />
          </div>
          <p className="text-xs text-slate-500">
            Os cards serão criados em A fazer, sem responsável nominal ou data de vencimento. Defina
            esses campos após confirmar os marcos contratuais. Reenvios do mesmo PDF não duplicam os
            cards.
          </p>
          <Button disabled={busy || !source} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar documento e criar cards"}
          </Button>
        </div>
      </details>
      {pdf && (
        <div className="space-y-2">
          <div className="flex gap-4">
            <h3 className="font-semibold">Documento original</h3>
            <a className="underline text-sm" href={pdf} download={source?.name || "documento.pdf"}>
              Baixar PDF
            </a>
            <button className="text-sm underline" onClick={() => setPdf(null)}>
              Fechar documento
            </button>
          </div>
          <iframe
            title="Documento original do cliente"
            src={pdf}
            className="w-full h-[650px] border rounded-xl"
          />
        </div>
      )}
    </section>
  );
}
