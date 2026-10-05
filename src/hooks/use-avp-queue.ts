"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GRUPO_AVP_ASO_LIST, type GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { useUser } from "@/firebase";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { avpElapsedDays } from "@/lib/avp-costs";

const stringFields: (keyof GrupoAvpAso)[] = [
  "id",
  "numero",
  "urgencia",
  "urgenciaRaw",
  "dataPedido",
  "dataPedidoIso",
  "cidadeRaw",
  "cidade",
  "uf",
  "colaborador",
  "tipoExame",
  "telefoneGestor",
  "oQueFazer",
  "status",
  "responsavel",
  "dataAgendada",
  "dataAgendadaIso",
  "tipoSolicitacao",
  "nomeClinica",
  "telefoneClinica",
  "emailClinica",
  "valorAso",
  "cnpjClinica",
  "chavePix",
  "pixRealizado",
  "enderecoClinica",
];

function readQueue(userId: string | null): GrupoAvpAso[] {
  if (!userId) return GRUPO_AVP_ASO_LIST;
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("nai_grupo_avp_asos_cache:" + userId) || "[]"
    );
    if (
      Array.isArray(parsed) &&
      parsed.length <= 10_000 &&
      parsed.every(
        (item) =>
          item &&
          stringFields.every((field) => typeof item[field] === "string") &&
          typeof item.diasParado === "number" &&
          Number.isFinite(item.diasParado)
      )
    )
      return parsed;
  } catch {
    /* A damaged local cache must not prevent a new import. */
  }
  return GRUPO_AVP_ASO_LIST;
}

export function useAvpQueue(userId: string | null) {
  const { user } = useUser();
  const [queue, setQueue] = useState<{ owner: string | null; items: GrupoAvpAso[] }>({
    owner: null,
    items: GRUPO_AVP_ASO_LIST,
  });
  const identity = useRef(userId);
  const current = useRef(queue);
  const identityEpoch = useRef(0);
  const revision = useRef("");
  const pendingWrites = useRef(0);
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());
  const refreshGeneration = useRef(0);
  const [syncState, setSyncState] = useState({
    status: "IDLE",
    checkedAt: null as string | null,
    error: null as string | null,
    conflicts: 0,
    saving: false,
  });
  const [clock, setClock] = useState(() => new Date());

  useLayoutEffect(() => {
    if (identity.current !== userId) identityEpoch.current++;
    identity.current = userId;
    current.current = queue;
  }, [userId, queue]);

  useEffect(() => {
    revision.current = "";
    pendingWrites.current = 0;
    writeChain.current = Promise.resolve();
    setSyncState({ status: "IDLE", checkedAt: null, error: null, conflicts: 0, saving: false });
    setQueue({ owner: userId, items: readQueue(userId) });
  }, [userId]);

  const refresh = useCallback(
    async (force = false) => {
      if (
        !userId ||
        user?.uid !== userId ||
        typeof user.getIdToken !== "function" ||
        pendingWrites.current
      )
        return;
      const generation = ++refreshGeneration.current;
      const epoch = identityEpoch.current;
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/clients/grupo-avp/queue" + (force ? "?force=1" : ""), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(60000),
        });
        const result = await response.json();
        if (
          identity.current !== userId ||
          epoch !== identityEpoch.current ||
          generation !== refreshGeneration.current ||
          pendingWrites.current
        )
          return;
        if (response.status === 401 || response.status === 403) {
          revision.current = "";
          const empty = { owner: userId, items: [] as GrupoAvpAso[] };
          current.current = empty;
          setQueue(empty);
          try {
            localStorage.removeItem("nai_grupo_avp_asos_cache:" + userId);
          } catch {
            /* Access revoked. */
          }
        }
        if (!response.ok)
          throw new Error(result.error || "A fonte compartilhada está indisponível.");
        setSyncState({
          status: result.status,
          checkedAt: result.checkedAt,
          error: result.error || null,
          conflicts: result.conflicts?.length || 0,
          saving: false,
        });
        if (result.revision && Array.isArray(result.items)) {
          revision.current = result.revision;
          const next = { owner: userId, items: result.items as GrupoAvpAso[] };
          current.current = next;
          setQueue(next);
          try {
            localStorage.setItem("nai_grupo_avp_asos_cache:" + userId, JSON.stringify(next.items));
          } catch {
            /* Server data remains authoritative. */
          }
        }
      } catch (error) {
        if (
          identity.current === userId &&
          epoch === identityEpoch.current &&
          generation === refreshGeneration.current
        )
          setSyncState((old) => ({
            ...old,
            status: "ERROR",
            error: error instanceof Error ? error.message : "Não foi possível atualizar a fila.",
          }));
      }
    },
    [userId, user]
  );

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      setClock(new Date());
      if (document.visibilityState !== "hidden") void refresh();
    }, AVP_SOURCE.intervalSeconds * 1000);
    const visible = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      refreshGeneration.current++;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  const updateAsos = useCallback(
    (update: GrupoAvpAso[] | ((items: GrupoAvpAso[]) => GrupoAvpAso[])) => {
      if (!userId || identity.current !== userId) return false;
      if (pendingWrites.current) {
        setSyncState((old) => ({
          ...old,
          error: "Aguarde a confirmação da alteração anterior antes de editar novamente.",
        }));
        return false;
      }
      const epoch = identityEpoch.current;
      const existing = current.current.owner === userId ? current.current.items : readQueue(userId);
      const items = typeof update === "function" ? update(existing) : update;
      if (revision.current && user?.uid === userId) {
        const allowed = [
          "urgencia",
          "status",
          "responsavel",
          "dataAgendada",
          "tipoSolicitacao",
          "nomeClinica",
          "telefoneClinica",
          "emailClinica",
          "valorAso",
          "cnpjClinica",
          "chavePix",
          "pixRealizado",
          "enderecoClinica",
          "oQueFazer",
          "observacoes",
        ] as const;
        const source = new Map(existing.map((item) => [item.id, item]));
        const identities = [
          "numero",
          "colaborador",
          "cidade",
          "uf",
          "cidadeRaw",
          "dataPedido",
          "tipoExame",
        ] as const;
        if (
          items.length !== existing.length ||
          new Set(items.map((item) => item.id)).size !== existing.length ||
          items.some(
            (item) =>
              !source.has(item.id) ||
              identities.some((field) => item[field] !== source.get(item.id)?.[field])
          )
        ) {
          setSyncState((old) => ({
            ...old,
            error:
              "A fila conectada segue a planilha original. Para adicionar ou remover solicitações, edite a fonte Google.",
          }));
          return false;
        }
        const changes = items
          .map((item) => ({
            id: item.id,
            fields: Object.fromEntries(
              allowed
                .filter(
                  (field) =>
                    String(item[field] ?? "") !== String(source.get(item.id)?.[field] ?? "")
                )
                .map((field) => [field, String(item[field] ?? "")])
            ),
          }))
          .filter((item) => Object.keys(item.fields).length);
        if (changes.length > 100) {
          setSyncState((old) => ({
            ...old,
            error: "Atualize até 100 solicitações de cada vez. Nenhuma alteração foi enviada.",
          }));
          return false;
        }
        if (changes.length) {
          pendingWrites.current++;
          setSyncState((old) => ({ ...old, saving: true, error: null }));
          writeChain.current = writeChain.current.then(async () => {
            try {
              if (identity.current !== userId || epoch !== identityEpoch.current) return;
              const token = await user.getIdToken();
              const response = await fetch("/api/clients/grupo-avp/queue", {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ revision: revision.current, changes }),
                signal: AbortSignal.timeout(30000),
              });
              const result = await response.json();
              if (identity.current !== userId || epoch !== identityEpoch.current) return;
              if (!response.ok)
                throw new Error(result.error || "Não foi possível salvar na fila compartilhada.");
              revision.current = result.revision;
            } catch (error) {
              if (identity.current === userId && epoch === identityEpoch.current) {
                const rollback = { owner: userId, items: existing };
                current.current = rollback;
                setQueue(rollback);
                try {
                  localStorage.setItem(
                    "nai_grupo_avp_asos_cache:" + userId,
                    JSON.stringify(existing)
                  );
                } catch {
                  /* Server error remains visible. */
                }
                setSyncState((old) => ({
                  ...old,
                  error: error instanceof Error ? error.message : "Não foi possível salvar.",
                }));
              }
            } finally {
              if (identity.current === userId && epoch === identityEpoch.current) {
                pendingWrites.current--;
                setSyncState((old) => ({ ...old, saving: pendingWrites.current > 0 }));
              }
            }
          });
        }
      }
      const next = { owner: userId, items };
      current.current = next;
      setQueue(next);
      try {
        localStorage.setItem("nai_grupo_avp_asos_cache:" + userId, JSON.stringify(items));
        return true;
      } catch {
        return !!revision.current;
      }
    },
    [userId, user]
  );

  const items = queue.owner === userId ? queue.items : GRUPO_AVP_ASO_LIST;
  const visibleItems = useMemo(
    () => items.map((item) => ({ ...item, diasParado: avpElapsedDays(item, clock) })),
    [items, clock]
  );
  return { asosList: visibleItems, updateAsos, syncState, refresh, source: AVP_SOURCE };
}
