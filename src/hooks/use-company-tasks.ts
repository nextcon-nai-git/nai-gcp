"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, type Firestore } from "firebase/firestore";
import type { OpsTask } from "@/types/schema";
export function useCompanyTasks(
  db: Firestore | null,
  uid: string | undefined,
  companyIds: string[],
  enabled: boolean
) {
  const key = JSON.stringify([...new Set(companyIds)].sort());
  const target = useMemo(() => ({ db, uid, key, enabled }), [db, uid, key, enabled]);
  const [state, setState] = useState<{
    target: typeof target;
    data: OpsTask[];
    error: Error | null;
  } | null>(null);
  useEffect(() => {
    if (!target.enabled || !target.uid || !target.db) return;
    const ids: string[] = JSON.parse(target.key);
    const slices = new Map<string, OpsTask[]>();
    let closed = false,
      failed = false;
    const stop = ids.map((id) =>
      onSnapshot(
        query(collection(target.db!, "companies", id, "tasks"), orderBy("dueDate", "asc")),
        (snap) => {
          if (closed || failed) return;
          slices.set(
            id,
            snap.docs.map((d) => ({ ...d.data(), id: d.id, companyId: id }) as OpsTask)
          );
          if (slices.size === ids.length)
            setState({
              target,
              data: [...slices.values()]
                .flat()
                .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")),
              error: null,
            });
        },
        (error) => {
          if (!closed) {
            failed = true;
            setState({ target, data: [], error });
          }
        }
      )
    );
    return () => {
      closed = true;
      stop.forEach((s) => s());
    };
  }, [target]);
  if (!enabled || !uid || !db || !companyIds.length)
    return { data: [], isLoading: false, error: null };
  return state?.target === target
    ? { data: state.data, isLoading: false, error: state.error }
    : { data: [], isLoading: true, error: null };
}
