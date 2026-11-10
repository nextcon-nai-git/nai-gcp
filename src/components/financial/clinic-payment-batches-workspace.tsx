"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import type { previewClinicPaymentBatches } from "@/services/clinic-payment-batches";
import { AlertTriangle, CheckCircle2, RefreshCw, WalletCards } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Preview = Awaited<ReturnType<typeof previewClinicPaymentBatches>>;
const pageSize = 25;

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ClinicPaymentBatchesWorkspace() {
  const { user, role, tenantId, isUserLoading } = useUser();
  if (!user || isUserLoading)
    return (
      <p className="p-4">
        {isUserLoading ? "Carregando sessão…" : "Entre no NAI para consultar os pagamentos."}
      </p>
    );
  return <ClinicPaymentReview key={JSON.stringify([user.uid, role, tenantId])} user={user} />;
}

function ClinicPaymentReview({ user }: { user: User }) {
  const session = useRef(new AbortController());
  const saving = useRef(false);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (requestedDate?: string) => {
      const { signal } = session.current;
      if (signal.aborted) return;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const token = await user.getIdToken();
        if (signal.aborted) return;
        const query = requestedDate ? `?dueDate=${encodeURIComponent(requestedDate)}` : "";
        const response = await fetch("/api/financial/clinic-payments" + query, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
        });
        const data = await response.json().catch(() => ({}));
        if (signal.aborted) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível preparar os lotes.");
        const next = data as Preview;
        setPreview(next);
        setPage(0);
        setDueDate(next.dueDate);
      } catch (cause) {
        if (signal.aborted) return;
        setPreview(null);
        setError(cause instanceof Error ? cause.message : "Não foi possível preparar os lotes.");
      } finally {
        if (!signal.aborted) setBusy(false);
      }
    },
    [user]
  );

  useEffect(() => {
    const current = new AbortController();
    session.current = current;
    void load();
    return () => current.abort();
  }, [load]);

  const blockedSummary = useMemo(() => {
    const rows = new Map<string, number>();
    for (const item of preview?.blocked || [])
      rows.set(item.reason, (rows.get(item.reason) || 0) + 1);
    return [...rows.entries()].sort((a, b) => b[1] - a[1]);
  }, [preview]);

  const canCreate =
    preview &&
    preview.batches.length > 0 &&
    !busy &&
    !preview.closedCompetences.length &&
    dueDate === preview.dueDate &&
    preview.sourceStatus === "CONNECTED" &&
    !preview.sourceError &&
    !preview.refreshInProgress;
  async function createDrafts() {
    const { signal } = session.current;
    if (!preview || !canCreate || saving.current || signal.aborted) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      if (signal.aborted) return;
      const response = await fetch("/api/financial/clinic-payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hash: preview.hash, dueDate }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      });
      const data = await response.json().catch(() => ({}));
      if (signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "Não foi possível criar os rascunhos.");
      const message = `${data.created?.length || 0} rascunho(s) criado(s) para ${data.totals?.asos || 0} ASO(s). Revise no financeiro antes de aprovar ou enviar ao Omie.`;
      await load(dueDate);
      if (!signal.aborted) setNotice(message);
    } catch (cause) {
      if (signal.aborted) return;
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Não foi possível criar os rascunhos.");
    } finally {
      saving.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/financial" className="text-sm text-cyan-300 hover:underline">
            ← Central financeira
          </Link>
          <h1 className="mt-2 text-3xl font-black">Pagamentos de clínicas · ASOs</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Consolida ASOs concluídos por CNPJ da clínica. Esta tela cria somente rascunhos de
            contas a pagar; não baixa títulos, não concilia e não envia instrução ao banco.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/financial/operacoes">Abrir financeiro operacional</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="size-5" /> Próximo lote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              Data prevista para pagamento
              <Input
                disabled={busy}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-48"
              />
            </label>
            <Button variant="outline" disabled={busy} onClick={() => void load(dueDate)}>
              <RefreshCw className="mr-2 size-4" />
              Atualizar prévia
            </Button>
            <Button disabled={!canCreate} onClick={() => void createDrafts()}>
              Gerar rascunhos no financeiro
            </Button>
          </div>
          {dueDate !== preview?.dueDate && preview && (
            <p className="text-sm text-amber-700">
              Atualize a prévia depois de alterar a data. O hash de revisão precisa corresponder ao
              lote mostrado.
            </p>
          )}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {notice && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>
          )}
          {preview?.refreshInProgress && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              A atualização da fila AVP está em andamento. Atualize a prévia quando terminar.
            </p>
          )}
          {preview && (preview.sourceError || preview.sourceStatus !== "CONNECTED") && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {preview.sourceError || "Consulte novamente a fila AVP para confirmar a conexão."}
            </p>
          )}
          {preview?.closedCompetences.length ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              Competência(s) fechada(s): {preview.closedCompetences.join(", ")}. Nenhum rascunho
              será criado enquanto houver itens nesses períodos.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-slate-500">Clínicas</p>
                <p className="mt-1 text-2xl font-black">{preview.totals.clinics}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-slate-500">ASOs aptos</p>
                <p className="mt-1 text-2xl font-black">{preview.totals.asos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-slate-500">Valor do lote</p>
                <p className="mt-1 text-2xl font-black">{money(preview.totals.amountCents)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {preview.batches.map((batch) => (
              <Card key={batch.key}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{batch.clinicName}</p>
                      <p className="text-xs text-slate-500">
                        CNPJ {batch.clinicDocument} · competência {batch.competence}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{money(batch.amountCents)}</p>
                      <p className="text-xs text-slate-500">{batch.items.length} ASO(s)</p>
                    </div>
                  </div>
                  {batch.warnings.map((warning) => (
                    <p key={warning} className="mt-3 text-sm text-amber-700">
                      <AlertTriangle className="mr-1 inline size-4" />
                      {warning}
                    </p>
                  ))}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Ver colaboradores
                    </summary>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      {batch.items.map((item) => (
                        <div key={item.asoId} className="flex flex-wrap justify-between gap-2">
                          <span>
                            {item.collaborator} · {item.city} · {item.examDate}
                          </span>
                          <span>{money(item.amountCents)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-5" /> Itens fora do lote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{preview.ignored} solicitação(ões) ainda não concluída(s) foram ignoradas.</p>
              {blockedSummary.map(([reason, count]) => (
                <p key={reason}>
                  {count} · {reason}
                </p>
              ))}
              {preview.blocked.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                <p key={row.asoId} className="text-slate-600">
                  {row.collaborator} · {row.clinicName || "Clínica não informada"} — {row.reason}
                </p>
              ))}
              {preview.blocked.length > pageSize && (
                <nav
                  aria-label="Páginas de itens fora do lote"
                  className="flex flex-wrap items-center gap-3"
                >
                  <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Anterior
                  </Button>
                  <span aria-live="polite">
                    Página {page + 1} de {Math.ceil(preview.blocked.length / pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * pageSize >= preview.blocked.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Próxima
                  </Button>
                </nav>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
