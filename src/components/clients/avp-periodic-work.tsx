"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PERIODIC_STAGES,
  PERIODIC_STAGE_LABELS,
  periodicActionEvidence,
  type PeriodicStage,
  type PeriodicWorkCard,
} from "@/lib/avp-periodic-workflow";

const endpoint = "/api/clients/grupo-avp/periodic-work";
export function AvpPeriodicWork() {
  const { user } = useUser();
  const identity = useRef(user?.uid);
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
  const [city, setCity] = useState("");
  const [owner, setOwner] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<{
    id: string;
    owner: string;
    entries: { updatedAt: string; responsible: string; stage: PeriodicStage; evidence: string }[];
  } | null>(null);
  const [editor, setEditor] = useState<{
    id: string;
    owner: string;
    responsible: string;
    stage: PeriodicStage;
    nextDate: string;
    evidence: string;
  } | null>(null);
  const cards = snapshot && snapshot.owner === user?.uid ? snapshot.cards : [];
  async function load(signal?: AbortSignal) {
    if (!user) return;
    const uid = user.uid;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      if (identity.current !== uid || signal?.aborted) return;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      if (identity.current !== uid || signal?.aborted) return;
      if (!response.ok) {
        setSnapshot(null);
        throw new Error(data.error || "Falha ao consultar cards.");
      }
      setSnapshot({ owner: uid, ...data });
    } catch (e) {
      if (identity.current === uid && !signal?.aborted) {
        setSnapshot(null);
        setError(e instanceof Error ? e.message : "Falha na consulta.");
      }
    } finally {
      if (identity.current === uid && !signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    setSnapshot(null);
    setEditor(null);
    setHistory(null);
    setCity("");
    setOwner("");
    setFilter("");
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // The identity key invalidates all private results and drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  useEffect(() => setPage(0), [city, owner, filter]);
  const filtered = cards.filter(
    (c) =>
      (!city || c.person.cityKey === city) &&
      (!owner ||
        (owner === "unassigned" ? !c.state?.responsible : c.state?.responsible === owner)) &&
      (!filter ||
        (filter === "overdue" ? c.overdue : filter === "blocked" ? c.blocked : c.stage === filter))
  );
  const selected =
    editor && editor.owner === user?.uid ? cards.find((c) => c.person.id === editor.id) : undefined;
  async function showHistory(id: string) {
    if (!user) return;
    const uid = user.uid;
    setHistory(null);
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      if (identity.current !== uid) return;
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (identity.current !== uid) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setSnapshot(null);
          setEditor(null);
        }
        throw new Error(data.error || "Falha ao consultar histórico.");
      }
      setHistory({ id, owner: uid, entries: data.history });
    } catch (e) {
      if (identity.current === uid) setError(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      if (identity.current === uid) setBusy(false);
    }
  }
  async function save() {
    if (!user || !editor || !selected || editor.owner !== user.uid) return;
    const uid = user.uid;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      if (identity.current !== uid) return;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.person.id,
          sourceVersion: selected.sourceVersion,
          revision: selected.state?.revision || 0,
          responsible: editor.responsible,
          stage: editor.stage,
          nextDate: editor.nextDate,
          evidence: editor.evidence,
        }),
      });
      const result = await response.json();
      if (identity.current !== uid) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setSnapshot(null);
          setEditor(null);
        }
        throw new Error(result.error || "Falha ao salvar.");
      }
      setEditor(null);
      await load();
    } catch (e) {
      if (identity.current === uid) setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      if (identity.current === uid) setBusy(false);
    }
  }
  return (
    <section aria-label="Fila de trabalho dos periódicos" className="space-y-4 rounded border p-4">
      <h3 className="text-xl font-bold">Fila de trabalho dos periódicos</h3>
      <p className="text-sm">
        Cards gerados da campanha. Todos começam em validação; a conferência da fonte não equivale à
        liberação para convocar. Cada avanço exige responsável e evidência. Envios e integração
        automática SOC/RD não estão ativados nesta fila.
      </p>
      <Button
        disabled={busy}
        variant="outline"
        onClick={() => {
          setEditor(null);
          void load();
        }}
      >
        {busy ? "Consultando..." : "Atualizar cards"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {snapshot && snapshot.owner === user?.uid && (
        <>
          <p className="text-xs">
            Consulta: {new Date(snapshot.checkedAt).toLocaleString("pt-BR")} · {cards.length} cards
            · {cards.filter((c) => !c.state?.responsible && !c.blocked).length} sem responsável ·{" "}
            {cards.filter((c) => c.overdue).length} ações com prazo vencido ·{" "}
            {cards.filter((c) => c.blocked).length} bloqueados
          </p>
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Cidade dos cards"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-background border rounded p-2"
            >
              <option value="">Todas as cidades</option>
              {[...new Map(cards.map((c) => [c.person.cityKey, c.person])).values()]
                .sort((a, b) => a.city.localeCompare(b.city))
                .map((p) => (
                  <option key={p.cityKey} value={p.cityKey}>
                    {p.city}/{p.uf}
                  </option>
                ))}
            </select>
            <select
              aria-label="Responsável dos cards"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="bg-background border rounded p-2"
            >
              <option value="">Todos os responsáveis</option>
              <option value="unassigned">Sem responsável</option>
              {[...new Set(cards.map((c) => c.state?.responsible).filter(Boolean))].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              aria-label="Etapa dos cards"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-background border rounded p-2"
            >
              <option value="">Todas as etapas</option>
              <option value="blocked">Bloqueados na fonte</option>
              <option value="overdue">Próxima ação vencida</option>
              {PERIODIC_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PERIODIC_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <p>{filtered.length} cards filtrados</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(page * 30, page * 30 + 30).map((c) => (
              <article className="rounded border p-3 space-y-2" key={c.person.id}>
                <strong>{c.person.name}</strong>
                <p className="text-sm">
                  {c.person.unit || "Unidade ausente"} · {c.person.city}/{c.person.uf}
                </p>
                <p>
                  {c.blocked
                    ? "Bloqueado: conferir cancelamento, unidade ou duplicidade"
                    : PERIODIC_STAGE_LABELS[c.stage]}
                </p>
                <p className="text-xs">
                  Fonte: {c.person.status} · {c.person.review || "Sem conferência"}
                </p>
                <p className="text-xs">
                  Último exame na base: {c.person.lastExam || "Não informado"} · Periodicidade:{" "}
                  {c.person.periodicityMonths || "A confirmar"} meses
                </p>
                {c.person.reviewDetail && <p className="text-xs">{c.person.reviewDetail}</p>}
                {c.sourceChanged && (
                  <p className="text-sm font-bold">
                    Fonte alterada: validar novamente. Histórico anterior preservado.
                  </p>
                )}
                <p className="text-sm">
                  Responsável: {c.state?.responsible || "Não informado"}
                  <br />
                  Próxima ação: {c.state?.nextDate || "Prazo a definir"}
                  {c.overdue ? " · VENCIDA" : ""}
                </p>
                {c.state && (
                  <p className="text-xs">
                    Último registro: {new Date(c.state.updatedAt).toLocaleString("pt-BR")}
                  </p>
                )}
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() =>
                    setEditor({
                      id: c.person.id,
                      owner: user!.uid,
                      responsible: c.state?.responsible || "",
                      stage: c.stage,
                      nextDate: c.state?.nextDate || "",
                      evidence: "",
                    })
                  }
                >
                  Registrar próxima ação
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void showHistory(c.person.id)}
                >
                  Histórico
                </Button>
              </article>
            ))}
          </div>
          <div className="flex gap-3">
            <Button disabled={!page} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span>
              Página {page + 1} de {Math.max(1, Math.ceil(filtered.length / 30))}
            </span>
            <Button
              disabled={(page + 1) * 30 >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
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
              onChange={(e) => setEditor({ ...editor, stage: e.target.value as PeriodicStage })}
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
            Referência da evidência e data — sem dados clínicos
            <Input
              required
              minLength={10}
              maxLength={1000}
              value={editor.evidence}
              onChange={(e) => setEditor({ ...editor, evidence: e.target.value })}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Salvar registro
          </Button>{" "}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>
            Cancelar
          </Button>
        </form>
      )}
      {history && history.owner === user?.uid && (
        <div className="rounded border p-4 space-y-2">
          <h4 className="font-bold">
            Histórico — {cards.find((c) => c.person.id === history.id)?.person.name || history.id}
          </h4>
          <p className="text-xs">
            Até 30 registros mais recentes. Evidências registradas pelos operadores, sem verificação
            automática do documento.
          </p>
          {history.entries.length ? (
            history.entries.map((h, i) => (
              <p key={i} className="text-sm">
                {new Date(h.updatedAt).toLocaleString("pt-BR")} · {h.responsible} ·{" "}
                {PERIODIC_STAGE_LABELS[h.stage]} · {h.evidence}
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
