"use client";

import { useState, useEffect, useMemo } from "react";
import {
  onSnapshot,
  type DocumentReference,
  type DocumentData,
  type FirestoreError,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

type WithId<T> = T & { id: string };
export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/** Keep each result bound to its document so changing clients cannot display stale data. */
export function useDoc<T = DocumentData>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined
): UseDocResult<T> {
  const target = memoizedDocRef ?? null;
  const subscriptionKey = useMemo(() => ({ target }), [target]);
  const [state, setState] = useState<{
    key: typeof subscriptionKey | null;
    result: UseDocResult<T>;
  }>({
    key: null,
    result: { data: null, isLoading: false, error: null },
  });

  useEffect(() => {
    if (!target) return;
    let closed = false;
    let unsubscribe = () => {};
    const receive = (result: UseDocResult<T>) => {
      if (!closed) setState({ key: subscriptionKey, result });
    };
    try {
      unsubscribe = onSnapshot(
        target,
        (snapshot) =>
          receive({
            data: snapshot.exists() ? { ...(snapshot.data() as T), id: snapshot.id } : null,
            isLoading: false,
            error: null,
          }),
        (serverError) => {
          if (closed) return;
          let error: Error = serverError;
          if (serverError.code === "permission-denied") {
            try {
              error = new FirestorePermissionError({ operation: "get", path: target.path });
              errorEmitter.emit("permission-error", error as FirestorePermissionError);
            } catch {
              // A diagnostic listener must not hide the original database failure.
              error = serverError;
            }
          }
          receive({ data: null, isLoading: false, error });
        }
      );
    } catch (error) {
      receive({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
    return () => {
      closed = true;
      unsubscribe();
    };
  }, [target, subscriptionKey]);

  if (!target) return { data: null, isLoading: false, error: null };
  if (state.key !== subscriptionKey) return { data: null, isLoading: true, error: null };
  return state.result;
}
