"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GRUPO_AVP_ASO_LIST, type GrupoAvpAso } from "@/lib/grupo-avp-asos-data";

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
  const [queue, setQueue] = useState<{ owner: string | null; items: GrupoAvpAso[] }>({
    owner: null,
    items: GRUPO_AVP_ASO_LIST,
  });
  const identity = useRef(userId);
  const current = useRef(queue);

  useLayoutEffect(() => {
    identity.current = userId;
    current.current = queue;
  }, [userId, queue]);

  useEffect(() => {
    setQueue({ owner: userId, items: readQueue(userId) });
  }, [userId]);

  const updateAsos = useCallback(
    (update: GrupoAvpAso[] | ((items: GrupoAvpAso[]) => GrupoAvpAso[])) => {
      if (!userId || identity.current !== userId) return false;
      const existing = current.current.owner === userId ? current.current.items : readQueue(userId);
      const items = typeof update === "function" ? update(existing) : update;
      const next = { owner: userId, items };
      current.current = next;
      setQueue(next);
      try {
        localStorage.setItem("nai_grupo_avp_asos_cache:" + userId, JSON.stringify(items));
        return true;
      } catch {
        return false;
      }
    },
    [userId]
  );

  return { asosList: queue.owner === userId ? queue.items : GRUPO_AVP_ASO_LIST, updateAsos };
}
