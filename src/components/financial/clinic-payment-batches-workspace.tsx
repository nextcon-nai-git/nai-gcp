"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, WalletCards } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Preview = {
  hash: string;
  dueDate: string;
  cadence: "TUESDAY_FRIDAY";
  sourceRevision: string;
  sourceCheckedAt: string | null;
  sourceStatus: string;
  sourceError: string | null;
  closedCompetences: string[];
  ignored: number;
  totals: { clinics: number; asos: number; amountCents: number };
  batches: Array<{
    key: string;
    clinicName: string;
    clinicDocument: string;
    competence: string;
    amountCents: number;
    items: Array<{
      asoId: string;
      collaborator: string;
      city: string;
      examDate: string;
      amountCents: number;
    }>;
    warnings: string[];
  }>;
  blocked: Array<{
    asoId: string;
    collaborator: string;
    clinicName: string;
    code: string;
    reason: string;
  }>;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ClinicPaymentBatchesWorkspace() {
  const { user } = useUser();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (requestedDate?: string) => {
      if (!user) return;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const token = await user.getIdToken();
        const query = requestedDate ? `?dueDate=${encodeURIComponent(requestedDate)}` : "";
        const response = await fetch("/api/financial/clinic-payments" + query, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(45000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Não foi possível preparar os lotes.");
        const next = data as Preview;
        setPreview(next);
        setDueDate(next.dueDate);
      } catch (cause) {
        setPreview(null);
        setError(cause instanceof Error ? cause.message : "Não foi possível preparar os lotes.");
      } finally {
        setBusy(false);
      }
    },
    [user]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const blockedSummary = useMemo(() => {
    const rows = new Map<string, number>();
    for (const item of preview?.blocked || []) rows.set(item.code, (rows.get(item.code) || 0) + 1);
    return [...rows.entries()].sort((a, b) => b[1] - a[1]);
  }, [preview]);

  async function createDrafts() {
    if (!user || !preview || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/financial/clinic-payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hash: preview.hash, dueDate }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível criar os rascunhos.");
      const message =
        `${data.created?.length || 0} rascunho(s) criado(s) para ${data.totals?.asos || 0} ASO(s). Revise no financeiro antes de aprovar ou enviar ao Omie.`;
      await load(dueDate);
      setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar os rascunhos.");
    } finally {
      setBusy(false);
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
            <Button
              disabled={
                busy ||
                !preview?.batches.length ||
                Boolean(preview?.closedCompetences.length) ||
                dueDate !== preview?.dueDate
              }
              onClick={() => void createDrafts()}
            >
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
          {preview?.sourceError && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Fonte AVP: {preview.sourceError}
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
              {blockedSummary.map(([code, count]) => (
                <p key={code}>
                  {count} bloqueada(s) · {code}
                </p>
              ))}
              {preview.blocked.slice(0, 25).map((row) => (
                <p key={row.asoId} className="text-slate-600">
                  {row.collaborator}: {row.reason}
                </p>
              ))}
              {preview.blocked.length > 25 && (
                <p className="text-slate-500">
                  + {preview.blocked.length - 25} bloqueio(s) não exibido(s) nesta lista resumida.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
