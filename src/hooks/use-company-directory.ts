"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  documentId,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

export interface DirectoryCompany {
  id: string;
  name: string;
  displayName?: string;
  razaoSocial?: string;
  city?: string;
  state?: string;
  active?: boolean;
  isDeleted?: boolean;
}

/** Keep every subscription within the caller's current company scope. */
export function useCompanyDirectory(
  db: Firestore | null,
  uid: string | undefined,
  global: boolean,
  companyIds: string[],
  enabled = true
) {
  const idsKey = JSON.stringify(
    [
      ...new Set(
        companyIds.filter((id) => typeof id === "string" && id.length > 0 && !id.includes("/"))
      ),
    ].sort()
  );
  const target = useMemo(
    () => ({ db, uid, global, enabled, ids: JSON.parse(idsKey) as string[] }),
    [db, uid, global, enabled, idsKey]
  );
  const ready =
    !!target.db && !!target.uid && target.enabled && (target.global || target.ids.length > 0);
  const [state, setState] = useState<{
    target: typeof target;
    data: DirectoryCompany[];
    error: Error | null;
  } | null>(null);
  useEffect(() => {
    if (!ready || !target.db) return;
    let closed = false,
      failed = false;
    const results = new Map<number, DirectoryCompany[]>();
    const unsubscribers: Array<() => void> = [];
    const root = collection(target.db, "companies");
    const queries = target.global
      ? [query(root, orderBy("name", "asc"))]
      : Array.from({ length: Math.ceil(target.ids.length / 30) }, (_, index) =>
          query(root, where(documentId(), "in", target.ids.slice(index * 30, (index + 1) * 30)))
        );
    const fail = (error: Error) => {
      if (closed || failed) return;
      failed = true;
      setState({ target, data: [], error });
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    try {
      for (const [index, source] of queries.entries()) {
        if (failed) break;
        const unsubscribe = onSnapshot(
          source,
          (snapshot) => {
            if (closed || failed) return;
            const data = snapshot.docs.flatMap((document) => {
              const item = document.data();
              if (item.isDeleted === true) return [];
              return [
                {
                  id: document.id,
                  name: typeof item.name === "string" ? item.name : document.id,
                  displayName: typeof item.displayName === "string" ? item.displayName : undefined,
                  razaoSocial: typeof item.razaoSocial === "string" ? item.razaoSocial : undefined,
                  city: typeof item.city === "string" ? item.city : undefined,
                  state: typeof item.state === "string" ? item.state : undefined,
                  active: typeof item.active === "boolean" ? item.active : undefined,
                },
              ];
            });
            results.set(index, data);
            if (results.size === queries.length)
              setState({
                target,
                error: null,
                data: Array.from(results.values())
                  .flat()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
              });
          },
          fail
        );
        unsubscribers.push(unsubscribe);
        if (failed) unsubscribe();
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Consulta de unidades indisponível."));
    }
    return () => {
      closed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [target, ready]);
  if (!ready) return { data: [] as DirectoryCompany[], isLoading: false, error: null };
  if (state?.target !== target)
    return { data: [] as DirectoryCompany[], isLoading: true, error: null };
  return { data: state.data, isLoading: false, error: state.error };
}
