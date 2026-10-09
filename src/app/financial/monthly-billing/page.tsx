"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  parseMonthlyBillingPaste,
  type MonthlyBillingRow,
  type MonthlyBillingView,
} from "@/lib/monthly-billing";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cnpjLabel = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export default function MonthlyBillingPage() {
  return (
    <Suspense fallback={<p>Carregando faturamento mensal...</p>}>
      <MonthlyBilling />
    </Suspense>
  );
}
function MonthlyBilling() {
  const { user, role } = useUser();
  const params = useSearchParams();
  const [groupId, setGroupId] = useState(params.get("group") || "");
  const [view, setView] = useState<MonthlyBillingView | null>(null);
  const [paste, setPaste] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [review, setReview] = useState<MonthlyBillingRow[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/financial/monthly-billing?group=${encodeURIComponent(groupId)}`,
        { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao consultar o faturamento.");
      if (!signal?.aborted) setView(body);
      return body as MonthlyBillingView;
    },
    [user, groupId]
  );
  useEffect(() => {
    const controller = new AbortController();
    setView(null);
    setReview(null);
    setError("");
    setSuccess("");
    setLoading(true);
    void load(controller.signal)
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Falha na consulta.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);
  async function save() {
    if (!user || !review || !view?.group || view.group.id !== groupId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/financial/monthly-billing", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          groupCompanyId: groupId,
          sourceName,
          revision: view.revision,
          confirmed: true,
          rows: review,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível gravar o lote.");
      const saved = await load();
      if (
        !saved ||
        !review.every((row) =>
          saved.records.some(
            (r) => r.cnpj === row.cnpj && r.valueCents === row.valueCents && r.name === row.name
          )
        )
      )
        throw new Error(
          "O envio terminou, mas a conferência não foi concluída. Atualize os dados antes de reenviar."
        );
      setSuccess(
        `${review.length} CNPJs conferidos no banco. Valor fixo mensal do lote: ${money(review.reduce((sum, row) => sum + row.valueCents, 0))}.`
      );
      setReview(null);
      setPaste("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="rounded-3xl bg-slate-950 p-8 text-white">
        <Link href="/financial" className="text-sm text-teal-300">
          Financeiro
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Faturamento mensal por grupo</h1>
        <p className="mt-3 text-slate-300">
          Cadastre os CNPJs do grupo com um valor fixo mensal para cada empresa.
        </p>
      </header>
      {role && role !== "SUPER_ADMIN" ? (
        <p role="alert">Esta área exige administrador global.</p>
      ) : (
        <>
          <section className="rounded-2xl border bg-white p-6 space-y-4">
            <label htmlFor="billing-group" className="block font-semibold">
              Grupo / cliente principal
            </label>
            <select
              id="billing-group"
              value={groupId}
              disabled={saving || loading}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-xl border p-3"
            >
              <option value="">Selecione o grupo</option>
              {view?.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              {groupId && !view?.groups.some((g) => g.id === groupId) && (
                <option value={groupId}>{groupId}</option>
              )}
            </select>
            <Button
              variant="outline"
              disabled={loading || saving}
              onClick={() => {
                setLoading(true);
                setError("");
                setReview(null);
                void load()
                  .catch((e: unknown) =>
                    setError(e instanceof Error ? e.message : "Falha na consulta.")
                  )
                  .finally(() => setLoading(false));
              }}
            >
              Atualizar dados
            </Button>
            {loading && <p role="status">Consultando os registros...</p>}
          </section>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
            >
              {success}
            </div>
          )}
          {view?.group && (
            <>
              <section className="rounded-2xl border bg-white p-6 space-y-4">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{view.group.name}</h2>
                    <p className="text-slate-500">
                      {view.records.length} CNPJs com mensalidade cadastrada
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Faturamento fixo mensal</p>
                    <p className="text-3xl font-semibold text-teal-800">{money(view.totalCents)}</p>
                  </div>
                </div>
                {view.records.length > 0 ? (
                  <BillingTable rows={view.records} />
                ) : (
                  <p>Nenhuma mensalidade fixa cadastrada para este grupo.</p>
                )}
              </section>
              {view.group.id !== "GRUPO_AVP" && (
                <section className="rounded-2xl border bg-white p-6 space-y-5">
                  <h2 className="text-xl font-semibold">Importar empresas e mensalidades</h2>
                  <p className="text-sm text-slate-600">
                    Copie as três colunas da planilha: CNPJ, razão social e valor em reais. Não
                    inclua a linha de total. Cadastros existentes são localizados pelo CNPJ.
                  </p>
                  <div>
                    <label htmlFor="billing-source" className="block mb-2 font-medium">
                      Nome da planilha de origem
                    </label>
                    <input
                      id="billing-source"
                      className="w-full rounded-xl border p-3"
                      value={sourceName}
                      maxLength={200}
                      disabled={saving}
                      onChange={(e) => {
                        setSourceName(e.target.value);
                        setReview(null);
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="billing-paste" className="block mb-2 font-medium">
                      CNPJ, razão social e valor mensal
                    </label>
                    <textarea
                      id="billing-paste"
                      className="min-h-48 w-full rounded-xl border p-3 font-mono text-sm"
                      value={paste}
                      disabled={saving}
                      onChange={(e) => {
                        setPaste(e.target.value);
                        setReview(null);
                        setSuccess("");
                      }}
                    />
                  </div>
                  <Button
                    disabled={saving || loading || !sourceName.trim() || !paste.trim()}
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      try {
                        setReview(parseMonthlyBillingPaste(paste));
                      } catch (e) {
                        setReview(null);
                        setError(e instanceof Error ? e.message : "Lote inválido.");
                      }
                    }}
                  >
                    Revisar lote
                  </Button>
                  {review && (
                    <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50 p-5">
                      <h3 className="font-semibold">
                        {review.length} CNPJs para {view.group.name} ·{" "}
                        {money(review.reduce((sum, row) => sum + row.valueCents, 0))} por mês
                      </h3>
                      <BillingTable rows={review} />
                      <p className="text-sm">
                        Os valores serão cadastrados como mensalidades fixas. Vencimento e
                        competência de emissão não foram definidos neste cadastro.
                      </p>
                      <Button disabled={saving} onClick={() => void save()}>
                        {saving ? "Gravando e conferindo..." : "Confirmar cadastro e mensalidades"}
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
function BillingTable({ rows }: { rows: MonthlyBillingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-3 pr-4">CNPJ</th>
            <th className="py-3 pr-4">Razão social</th>
            <th className="py-3 text-right">Mensalidade fixa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cnpj} className="border-b last:border-0">
              <td className="whitespace-nowrap py-3 pr-4">{cnpjLabel(row.cnpj)}</td>
              <td className="py-3 pr-4">{row.name}</td>
              <td className="whitespace-nowrap py-3 text-right tabular-nums">
                {money(row.valueCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
