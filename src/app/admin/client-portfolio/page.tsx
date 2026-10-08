"use client";
import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
type Review = {
  revision: string;
  applied: boolean;
  groups: { name: string; records: number }[];
  records: number;
  inactive: number;
  santander: boolean;
};
export default function PortfolioReviewPage() {
  const { user } = useUser();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(apply = false) {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/client-portfolio", {
        method: apply ? "POST" : "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        ...(apply ? { body: JSON.stringify({ revision: review?.revision }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (apply) {
        setMessage(
          "Carteira aplicada: 11 clientes ativos. Demais cadastros inativos. Santander removido da lista de clientes."
        );
        setReview((old) => (old ? { ...old, applied: true } : old));
      } else setReview(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">Revisão da carteira de clientes</h1>
      <p>
        Relação aprovada pela Nextcon em 07/10/2026. Unidades e cadastros vinculados mantêm seus
        históricos. O Santander será removido da carteira de clientes, sem apagar informações
        bancárias ou financeiras.
      </p>
      <button
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
        disabled={busy || !user}
        onClick={() => void request()}
      >
        Consultar revisão da carteira
      </button>
      {review && (
        <section className="space-y-4 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">
            {review.groups.length} clientes ativos aprovados
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {review.groups.map((g) => (
              <li key={g.name}>
                {g.name} — {g.records} registro(s) vinculado(s)
              </li>
            ))}
          </ul>
          <p>
            {review.inactive} outros cadastros ficarão inativos.{" "}
            {review.santander
              ? "Santander será excluído da lista de clientes com histórico preservado."
              : "Santander não encontrado na base."}
          </p>
          {review.applied ? (
            <p role="status">Esta relação já foi aplicada.</p>
          ) : (
            <button
              className="rounded-xl bg-teal-700 px-5 py-3 text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void request(true)}
            >
              Aplicar carteira aprovada
            </button>
          )}
        </section>
      )}
      {message && (
        <p role="status" className="rounded-xl border bg-slate-50 p-4">
          {message}
        </p>
      )}
      <div className="flex gap-6">
        <Link href="/">Abrir painel executivo</Link>
        <Link href="/clients">Ver cadastros e históricos</Link>
      </div>
    </main>
  );
}
