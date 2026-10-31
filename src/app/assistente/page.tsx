"use client";
import * as React from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WorkActionData } from "@/lib/work-assistant";
import { OperationsShortcuts } from "@/components/operations/operations-shortcuts";
import { OperationalKitPanel } from "@/components/operations/operational-kit-panel";
import { KitCompanySelector } from "@/components/operations/kit-company-selector";
import type { KitPreview, KitSelectionData } from "@/lib/operational-kits";
import {
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FolderOpen,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Unplug,
  Wifi,
} from "lucide-react";

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
  const [kitBusy, setKitBusy] = React.useState(false);
  const [kitSelection, setKitSelection] = React.useState<KitSelectionData>();
  const [kitProposal, setKitProposal] = React.useState<KitPreview | null>(null);
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
    if (lock.current || kitBusy || !input.trim() || !configured || companyId === "all") return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setProposal(null);
    const next: Message[] = [...messages, { role: "user", content: input.trim() }];
    try {
      const r = await request({
        action: "chat",
        companyId,
        messages: next.slice(-12),
        kitSelection,
      });
      if (!active.current) return;
      setMessages([...next, { role: "assistant", content: r.answer }]);
      setInput("");
      if (r.proposalId) setProposal({ id: r.proposalId, actions: r.actions });
      if (r.kitProposal) setKitProposal(r.kitProposal);
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
  async function probe() {
    if (lock.current || kitBusy || !configured || companyId === "all") return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request({ action: "probe", companyId });
      if (active.current)
        setNotice(
          `Conexão OpenAI e resposta estruturada verificadas em ${result.checkedAt}. A emissão e as ações SOC devem ser verificadas separadamente.`
        );
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Conexão não comprovada.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <main id="main-content" className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileCheck2 aria-hidden="true" className="h-6 w-6 text-primary" /> Clínicas e kits
        </h1>
        {configured !== null && (
          <span
            role="status"
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground"
          >
            {configured ? (
              <Bot aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Unplug aria-hidden="true" className="h-4 w-4" />
            )}
            {configured ? "IA · configuração presente" : "IA · configuração pendente"}
          </span>
        )}
      </div>
      {configured === null && !error && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Verificando acesso…
        </p>
      )}
      {configured !== null && <OperationsShortcuts includeAssistant={false} compact />}
      {configured !== null && <KitCompanySelector disabled={busy || kitBusy} />}
      {configured !== null && !["all", "unauthorized"].includes(companyId) && (
        <OperationalKitPanel
          companyId={companyId}
          preview={kitProposal}
          onPreview={setKitProposal}
          onSelection={setKitSelection}
          disabled={busy}
          onBusy={setKitBusy}
        />
      )}
      {configured !== null && companyId === "all" ? (
        <p
          role="status"
          className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
        >
          Escolha o cliente acima para preparar um kit.
        </p>
      ) : configured !== null && companyId !== "unauthorized" ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${encodeURIComponent(companyId)}`}>
              <FolderOpen aria-hidden="true" /> Documentos
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/action-plans?company=${encodeURIComponent(companyId)}`}>
              <CalendarDays aria-hidden="true" /> Cards e calendário
            </Link>
          </Button>
        </div>
      ) : null}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <details className="group rounded-xl border">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-4 font-semibold focus-visible:outline focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
          <Sparkles aria-hidden="true" className="h-5 w-5 text-primary" /> Conversar com o NAI
          <ChevronDown
            aria-hidden="true"
            className="ml-auto h-4 w-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="space-y-4 border-t p-4">
          {configured === false && (
            <p role="status" className="text-sm text-muted-foreground">
              IA ainda não configurada. Você já pode preparar kits pelo formulário.
            </p>
          )}
          {configured === true && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || kitBusy || companyId === "all"}
              onClick={() => void probe()}
            >
              <Wifi aria-hidden="true" /> Testar conexão OpenAI
            </Button>
          )}
          <details className="text-sm text-muted-foreground">
            <summary className="inline-flex cursor-pointer items-center gap-2">
              <CircleHelp aria-hidden="true" className="h-4 w-4" /> Privacidade e ajuda
            </summary>
            <p>
              São enviados à OpenAI sua mensagem, os nomes dos documentos e até 200 cards do
              cliente. PDFs, prontuários, e-mail e Drive não são lidos por esta integração. A
              conversa fica nesta tela; ao trocar de cliente, ela é encerrada. Novos cards exigem
              sua confirmação abaixo. Para kits, a OpenAI recebe somente a quantidade selecionada;
              cadastros e protocolo do formulário são validados no NAI. Não inclua dados clínicos na
              mensagem.
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
                <ShieldCheck aria-hidden="true" />
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
            disabled={busy || kitBusy || !configured || companyId === "all"}
            placeholder="Ex.: Prepare os kits selecionados"
            rows={2}
          />
          <p className="text-xs text-muted-foreground">Não inclua dados clínicos na mensagem.</p>
          <Button
            onClick={() => void send()}
            disabled={busy || kitBusy || !configured || companyId === "all" || !input.trim()}
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {busy ? "Processando…" : "Enviar"}
          </Button>
        </div>
      </details>
    </main>
  );
}
