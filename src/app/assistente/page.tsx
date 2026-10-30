"use client";
import * as React from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WorkActionData } from "@/lib/work-assistant";

type Message = { role: "user" | "assistant"; content: string };
export default function WorkAssistantPage() {
  const { user } = useUser();
  const { activeClientId } = useSgi();
  return (
    <AssistantSession
      key={JSON.stringify([user?.uid, activeClientId])}
      companyId={activeClientId}
    />
  );
}
function AssistantSession({ companyId }: { companyId: string }) {
  const { user } = useUser();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const [proposal, setProposal] = React.useState<{ id: string; actions: WorkActionData[] } | null>(
    null
  );
  const active = React.useRef(true),
    lock = React.useRef(false);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const request = React.useCallback(
    async (body?: unknown) => {
      if (!user) throw new Error("Entre no NAI para continuar.");
      const token = await user.getIdToken();
      if (!active.current) throw new Error("Sessão encerrada.");
      const r = await fetch("/api/work-assistant", {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Solicitação não concluída.");
      return result;
    },
    [user]
  );
  React.useEffect(() => {
    if (user)
      void request()
        .then((r) => {
          if (active.current) setConfigured(r.configured);
        })
        .catch((e) => {
          if (active.current) setError(e.message);
        });
  }, [user, request]);
  async function send() {
    if (lock.current || !input.trim() || !configured || companyId === "all") return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setProposal(null);
    const next: Message[] = [...messages, { role: "user", content: input.trim() }];
    try {
      const r = await request({ action: "chat", companyId, messages: next.slice(-12) });
      if (!active.current) return;
      setMessages([...next, { role: "assistant", content: r.answer }]);
      setInput("");
      if (r.proposalId) setProposal({ id: r.proposalId, actions: r.actions });
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Falha ao consultar.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function apply() {
    if (!proposal || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await request({ action: "apply", companyId, proposalId: proposal.id });
      if (!active.current) return;
      setNotice(
        `${r.count} cards ${r.alreadyApplied ? "já estavam salvos; nenhuma duplicação criada" : "salvos em Planejamento"}.`
      );
      setProposal(null);
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Gravação não confirmada.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">Assistente de trabalho</h1>
      <p className="text-sm text-muted-foreground">
        Consulte os cards e documentos cadastrados do cliente selecionado e prepare novas ações.
      </p>
      {companyId === "all" ? (
        <p role="status">Selecione um cliente no cabeçalho para começar.</p>
      ) : (
        <div className="flex gap-4">
          <Link href={`/clients/${encodeURIComponent(companyId)}`}>Documentos do cliente</Link>
          <Link href={`/action-plans?company=${encodeURIComponent(companyId)}`}>
            Cards e calendário
          </Link>
        </div>
      )}
      {configured === false && (
        <p role="status">A integração OpenAI aguarda configuração pela administração.</p>
      )}
      <details className="text-sm text-muted-foreground">
        <summary>O que o assistente pode acessar</summary>
        <p>
          São enviados à OpenAI sua mensagem, os nomes dos documentos e até 200 cards do cliente.
          PDFs, prontuários, e-mail e Drive não são lidos por esta integração. A conversa fica nesta
          tela; ao trocar de cliente, ela é encerrada. Novos cards exigem sua confirmação abaixo.
        </p>
      </details>
      <div role="log" aria-label="Conversa com o assistente" className="space-y-4">
        {messages.map((m, i) => (
          <div key={i} className="rounded-xl border p-4">
            <p className="mb-2 text-xs font-bold">{m.role === "user" ? "Você" : "NAI"}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {proposal && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-bold">Conferir ações propostas</h2>
          {proposal.actions.map((a, i) => (
            <div key={i} className="border-b pb-3">
              <h3 className="font-medium">{a.title}</h3>
              <p className="whitespace-pre-wrap text-sm">{a.instructions}</p>
              <p className="text-sm">
                Responsável: {a.responsibleName || "A definir"} · Prazo:{" "}
                {a.dueDate || "Depende de evento ou confirmação"} ·{" "}
                {a.deadlineBasis === "plan"
                  ? "Meta do plano"
                  : a.deadlineBasis === "legal_event"
                    ? "Obrigação por evento"
                    : "A confirmar"}
              </p>
              <p className="text-sm">Fonte: {a.source || "Não informada"}</p>
            </div>
          ))}
          <Button disabled={busy} onClick={() => void apply()}>
            Confirmar e criar {proposal.actions.length} cards
          </Button>
        </section>
      )}
      <label htmlFor="work-message" className="block font-medium">
        Sua solicitação
      </label>
      <Textarea
        id="work-message"
        maxLength={12000}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={busy || !configured || companyId === "all"}
        placeholder="Organize as próximas ações deste cliente e indique os prazos já registrados."
        rows={4}
      />
      <Button
        onClick={() => void send()}
        disabled={busy || !configured || companyId === "all" || !input.trim()}
      >
        {busy ? "Processando…" : "Enviar"}
      </Button>
    </main>
  );
}
