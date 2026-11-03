"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { AvpPeriodicCityBrowser } from "./avp-periodic-city-browser";
import {
  PERIODIC_STAGES,
  PERIODIC_STAGE_LABELS,
  periodicActionEvidence,
  periodicEvidenceKind,
  type PeriodicEvidenceKind,
  type PeriodicPatch,
  type PeriodicStage,
  type PeriodicWorkCard,
} from "@/lib/avp-periodic-workflow";

const endpoint = "/api/clients/grupo-avp/periodic-work";
export function AvpPeriodicWork() {
  const { user } = useUser();
  const identity = useRef(user?.uid);
  const generation = useRef(0);
  const historyRequest = useRef(0);
  useLayoutEffect(() => {
    identity.current = user?.uid;
  }, [user?.uid]);
  const [snapshot, setSnapshot] = useState<{
    owner: string;
    cards: PeriodicWorkCard[];
    checkedAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{
    id: string;
    owner: string;
    entries: (PeriodicPatch & { updatedAt: string })[];
  } | null>(null);
  const [editor, setEditor] = useState<{
    id: string;
    owner: string;
    responsible: string;
    stage: PeriodicStage;
    nextDate: string;
    evidence: string;
    evidenceDate: string;
    evidenceKind: PeriodicEvidenceKind;
    clinic: string;
    appointmentTime: string;
    receiptNumber: string;
    nonApplicabilityReason: string;
  } | null>(null);
  const cards = snapshot && snapshot.owner === user?.uid ? snapshot.cards : [];
  function clearPrivate() {
    generation.current += 1;
    historyRequest.current += 1;
    setSnapshot(null);
    setHistory(null);
    setEditor(null);
  }
  async function load(signal?: AbortSignal) {
    if (!user) return;
    const uid = user.uid;
    const epoch = generation.current;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      if (identity.current !== uid || generation.current !== epoch || signal?.aborted) return;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      if (identity.current !== uid || generation.current !== epoch || signal?.aborted) return;
      if (!response.ok) {
        clearPrivate();
        setError(data.error || "Falha ao consultar cards.");
        return;
      }
      setSnapshot({ ...data, owner: uid });
    } catch (e) {
      if (identity.current === uid && generation.current === epoch && !signal?.aborted) {
        clearPrivate();
        setError(e instanceof Error ? e.message : "Falha na consulta.");
      }
    } finally {
      if (identity.current === uid && !signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    clearPrivate();
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // The identity key invalidates all private results and drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  const selected =
    editor && editor.owner === user?.uid ? cards.find((c) => c.id === editor.id) : undefined;
  async function showHistory(id: string) {
    if (!user) return;
    const uid = user.uid;
    const epoch = generation.current;
    const request = ++historyRequest.current;
    setHistory(null);
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      if (
        identity.current !== uid ||
        generation.current !== epoch ||
        historyRequest.current !== request
      )
        return;
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (identity.current !== uid || generation.current !== epoch) return;
      // Revocation invalidates the entire snapshot even if the user navigated
      // away from this history while the authorized request was in flight.
      if (!response.ok && [401, 403].includes(response.status)) {
        clearPrivate();
        setError(data.error || "Falha ao consultar histórico.");
        return;
      }
      if (historyRequest.current !== request) return;
      if (!response.ok) {
        setError(data.error || "Falha ao consultar histórico.");
        return;
      }
      setHistory({ id, owner: uid, entries: data.history });
    } catch (e) {
      if (
        identity.current === uid &&
        generation.current === epoch &&
        historyRequest.current === request
      )
        setError(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      if (identity.current === uid) setBusy(false);
    }
  }
  async function save() {
    if (!user || !editor || !selected || editor.owner !== user.uid) return;
    const uid = user.uid;
    const epoch = generation.current;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      if (identity.current !== uid || generation.current !== epoch) return;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          sourceVersion: selected.sourceVersion,
          revision: selected.revision,
          responsible: editor.responsible,
          stage: editor.stage,
          nextDate: editor.nextDate,
          evidence: editor.evidence,
          evidenceDate: editor.evidenceDate,
          evidenceKind: editor.evidenceKind,
          clinic: editor.clinic,
          appointmentTime: editor.appointmentTime,
          receiptNumber: editor.receiptNumber,
          nonApplicabilityReason: editor.nonApplicabilityReason,
        }),
      });
      const result = await response.json();
      if (identity.current !== uid || generation.current !== epoch) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) clearPrivate();
        setError(result.error || "Falha ao salvar.");
        return;
      }
      setEditor(null);
      await load();
    } catch (e) {
      if (identity.current === uid && generation.current === epoch)
        setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      if (identity.current === uid) setBusy(false);
    }
  }
  function closeDetails() {
    historyRequest.current += 1;
    setHistory(null);
    setEditor(null);
  }
  function editCard(card: PeriodicWorkCard) {
    if (!user) return;
    closeDetails();
    setEditor({
      id: card.id,
      owner: user.uid,
      responsible: card.state?.responsible || "",
      stage: card.stage,
      nextDate: card.state?.nextDate || "",
      evidence: "",
      evidenceDate: "",
      evidenceKind: periodicEvidenceKind(card.stage),
      clinic: "",
      appointmentTime: "",
      receiptNumber: "",
      nonApplicabilityReason: "",
    });
  }
  return (
    <section aria-label="Fila de trabalho dos periódicos" className="space-y-4 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">Periódicos por cidade</h3>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => {
            closeDetails();
            void load();
          }}
        >
          <RefreshCw aria-hidden="true" />
          {busy ? "Consultando..." : "Atualizar cards"}
        </Button>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Como avançar os registros</summary>
        <p className="mt-2">
          Cada vínculo começa em validação e avança com responsável e evidência. A agenda da fonte
          não confirma atendimento. Envios e integração automática SOC/RD não estão ativados nesta
          fila.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
      {snapshot && snapshot.owner === user?.uid && (
        <>
          <p className="text-xs text-muted-foreground">
            Consulta: {new Date(snapshot.checkedAt).toLocaleString("pt-BR")}
          </p>
          <AvpPeriodicCityBrowser
            key={snapshot.owner}
            cards={cards}
            busy={busy}
            onEdit={editCard}
            onHistory={(id) => void showHistory(id)}
            onNavigate={closeDetails}
          />
        </>
      )}
      {selected && editor && (
        <form
          className="rounded border p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h4 className="font-bold">Registrar: {selected.person.name}</h4>
          <label className="block">
            Responsável
            <Input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              value={editor.responsible}
              onChange={(e) => setEditor({ ...editor, responsible: e.target.value })}
            />
          </label>
          <label className="block">
            Etapa
            <select
              className="bg-background border rounded p-2 block"
              value={editor.stage}
              onChange={(e) => {
                const stage = e.target.value as PeriodicStage;
                setEditor({ ...editor, stage, evidenceKind: periodicEvidenceKind(stage) });
              }}
            >
              {PERIODIC_STAGES.filter((s, i) =>
                selected.blocked
                  ? i === 0
                  : i === 0 ||
                    s === selected.stage ||
                    i === PERIODIC_STAGES.indexOf(selected.stage) + 1
              ).map((s) => (
                <option key={s} value={s}>
                  {PERIODIC_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Data da próxima ação (opcional)
            <Input
              type="date"
              value={editor.nextDate}
              onChange={(e) => setEditor({ ...editor, nextDate: e.target.value })}
            />
          </label>
          <p className="text-sm">{periodicActionEvidence(editor.stage)}</p>
          <label className="block">
            Referência da evidência — sem dados clínicos
            <Input
              required
              minLength={10}
              maxLength={1000}
              value={editor.evidence}
              onChange={(e) => setEditor({ ...editor, evidence: e.target.value })}
            />
          </label>
          <label className="block">
            Data da evidência ou do evento confirmado
            <Input
              type="date"
              required
              value={editor.evidenceDate}
              onChange={(e) => setEditor({ ...editor, evidenceDate: e.target.value })}
            />
          </label>
          {editor.stage === "confirmar_realizacao" && (
            <>
              <label className="block">
                Clínica confirmada
                <Input
                  required
                  maxLength={240}
                  value={editor.clinic}
                  onChange={(e) => setEditor({ ...editor, clinic: e.target.value })}
                />
              </label>
              <label className="block">
                Horário confirmado
                <Input
                  required
                  type="time"
                  value={editor.appointmentTime}
                  onChange={(e) => setEditor({ ...editor, appointmentTime: e.target.value })}
                />
              </label>
            </>
          )}
          {editor.stage === "concluido" && (
            <>
              <label className="block">
                Fundamento da conclusão
                <select
                  className="bg-background border rounded p-2 block"
                  value={editor.evidenceKind}
                  onChange={(e) =>
                    setEditor({ ...editor, evidenceKind: e.target.value as PeriodicEvidenceKind })
                  }
                >
                  <option value="esocial_receipt">Recibo de aceitação no eSocial</option>
                  <option value="not_applicable">
                    Não aplicável com justificativa documentada
                  </option>
                </select>
              </label>
              {editor.evidenceKind === "esocial_receipt" ? (
                <label className="block">
                  Número do recibo de aceitação
                  <Input
                    required
                    minLength={5}
                    maxLength={120}
                    value={editor.receiptNumber}
                    onChange={(e) => setEditor({ ...editor, receiptNumber: e.target.value })}
                  />
                </label>
              ) : (
                <label className="block">
                  Justificativa de não aplicabilidade
                  <Input
                    required
                    minLength={20}
                    maxLength={1000}
                    value={editor.nonApplicabilityReason}
                    onChange={(e) =>
                      setEditor({ ...editor, nonApplicabilityReason: e.target.value })
                    }
                  />
                </label>
              )}
            </>
          )}
          <Button type="submit" disabled={busy}>
            Salvar registro
          </Button>{" "}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>
            Cancelar
          </Button>
        </form>
      )}
      {snapshot && snapshot.owner === user?.uid && history && history.owner === user?.uid && (
        <div className="rounded border p-4 space-y-2">
          <h4 className="font-bold">
            Histórico — {cards.find((c) => c.id === history.id)?.person.name || history.id}
          </h4>
          <p className="text-xs">
            Até 30 registros mais recentes. Evidências registradas pelos operadores, sem verificação
            automática do documento.
          </p>
          {history.entries.length ? (
            history.entries.map((h, i) => (
              <p key={i} className="text-sm">
                {new Date(h.updatedAt).toLocaleString("pt-BR")} · {h.responsible} ·{" "}
                {PERIODIC_STAGE_LABELS[h.stage]} · {h.evidence} · {h.evidenceDate}
                {h.clinic && ` · ${h.clinic} ${h.appointmentTime}`}
                {h.receiptNumber && ` · Recibo: ${h.receiptNumber}`}
                {h.nonApplicabilityReason && ` · Não aplicável: ${h.nonApplicabilityReason}`}
              </p>
            ))
          ) : (
            <p>Sem registros.</p>
          )}
        </div>
      )}
    </section>
  );
}
