"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";

export default function AuditSetupPage() {
  const { user, role } = useUser();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  async function inspect() {
    if (!user || loading) return;
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/dashboard/overview?company=all", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("unavailable");
      const result = await response.json();
      if (!result || typeof result !== "object" || !Array.isArray(result.issues)) {
        throw new Error("invalid response");
      }
      setStatus(
        result.issues.length
          ? `Consulta concluída com ${result.issues.length} pendência(s) de fonte. Confira o painel executivo.`
          : "Consulta do painel executivo concluída. Este resultado não certifica os demais módulos, integrações ou conformidade normativa."
      );
    } catch {
      setStatus(
        "Não foi possível concluir a consulta. Confira seu acesso e tente novamente. Nenhum cadastro foi alterado."
      );
    } finally {
      setLoading(false);
    }
  }
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  async function inspectAi() {
    if (!user || aiLoading) return;
    setAiLoading(true);
    setAiStatus("");
    try {
      const response = await fetch("/api/admin/ai-diagnostic", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error("unavailable");
      const result = await response.json();
      setAiStatus(`${result.message} Código: ${result.code}.`);
    } catch {
      setAiStatus("Não foi possível concluir o diagnóstico da IA. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-white">
      <Link href="/" className="text-cyan-300 underline">
        Voltar ao painel
      </Link>
      <h1 className="text-3xl font-bold">Diagnóstico do NAI</h1>
      <p>
        Verifique a resposta do painel executivo com seu acesso atual. A consulta é somente leitura.
      </p>
      <Button
        onClick={inspect}
        disabled={!user || loading}
        className="bg-cyan-800 text-white hover:bg-cyan-700"
      >
        {loading ? "Consultando…" : "Consultar disponibilidade"}
      </Button>
      {status && (
        <p role="status" className="rounded-xl border border-white/20 p-4">
          {status}
        </p>
      )}
      {role === "SUPER_ADMIN" && (
        <section className="space-y-3 rounded-xl border border-white/20 p-5">
          <h2 className="text-xl font-semibold">Disponibilidade da IA</h2>
          <p>Envia uma solicitação curta ao provedor, sem documentos ou dados pessoais.</p>
          <Button onClick={inspectAi} disabled={aiLoading}>
            {aiLoading ? "Testando IA…" : "Testar provedor de IA"}
          </Button>
          {aiStatus && <p role="status">{aiStatus}</p>}
        </section>
      )}
      <section className="space-y-3 rounded-xl border border-white/20 p-5">
        <h2 className="text-xl font-semibold">Revisão de cadastros</h2>
        <p>
          Cadastros com nomes semelhantes exigem conferência de CNPJ, unidade e vínculos antes de
          qualquer alteração.
        </p>
        <Link href="/admin/client-portfolio" className="text-cyan-300 underline">
          Abrir revisão da carteira
        </Link>
      </section>
    </main>
  );
}
