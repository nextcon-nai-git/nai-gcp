"use client";

import { useState, useEffect, useRef } from "react";
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError, type SecurityRuleContext } from "@/firebase/errors";

export type WithId<T> = T & { id: string };

export interface UseCollectionDedupedResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

// WeakMap global para armazenar subscriptions ativas por query string
const queryCache = new Map<string, { unsubscribe: () => void; count: number }>();
const queryListeners = new Map<string, Set<(data: any[]) => void>>();

/**
 * Hook para subscrição em tempo real com deduplicação automática.
 * Se a mesma query já está subscrita, reutiliza a subscription existente.
 */
export function useCollectionDeduped<T = any>(
  memoizedTargetRefOrQuery:
    (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined
): UseCollectionDedupedResult<T> {
  type ResultItemType = WithId<T>;
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const queryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Gera chave única para esta query
    const queryKey = JSON.stringify(
      (memoizedTargetRefOrQuery as any)?._query || memoizedTargetRefOrQuery
    );
    queryKeyRef.current = queryKey;

    setIsLoading(true);
    setError(null);

    // Callback para atualizar dados
    const updateData = (results: ResultItemType[]) => {
      setData(results);
      setError(null);
      setIsLoading(false);
    };

    // Se já existe subscription para esta query, reutiliza
    if (queryCache.has(queryKey)) {
      const cached = queryCache.get(queryKey)!;
      cached.count += 1;

      // Inscreve o callback aos listeners
      if (!queryListeners.has(queryKey)) {
        queryListeners.set(queryKey, new Set());
      }
      queryListeners.get(queryKey)!.add(updateData);

      // Cleanup
      return () => {
        queryListeners.get(queryKey)?.delete(updateData);
        cached.count -= 1;

        // Remove subscription se ninguém mais está ouvindo
        if (cached.count === 0) {
          cached.unsubscribe();
          queryCache.delete(queryKey);
          queryListeners.delete(queryKey);
        }
      };
    }

    // Primeira subscription para esta query
    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        updateData(results);

        // Notifica todos os listeners
        queryListeners.get(queryKey)?.forEach((listener) => {
          listener(results);
        });
      },
      (serverError: FirestoreError) => {
        let path = "collection-group";
        try {
          const anyQuery = memoizedTargetRefOrQuery as any;
          if (anyQuery?._query?.collectionGroup) {
            path = `group:${anyQuery._query.collectionGroup}`;
          } else if (anyQuery?.path) {
            path = anyQuery.path;
          } else if (anyQuery?._query?.path?.segments) {
            path = anyQuery._query.path.segments.join("/");
          }
        } catch (e) {
          path = "complex-query";
        }

        if (serverError.code === "permission-denied") {
          try {
            const contextualError = new FirestorePermissionError({
              operation: "list",
              path: path || "collection-group",
            } satisfies SecurityRuleContext);
            setError(contextualError);
            errorEmitter.emit("permission-error", contextualError);
          } catch (e) {
            setError(serverError);
          }
        } else {
          setError(serverError);
        }

        setData(null);
        setIsLoading(false);
      }
    );

    // Registra subscription
    queryCache.set(queryKey, { unsubscribe, count: 1 });
    if (!queryListeners.has(queryKey)) {
      queryListeners.set(queryKey, new Set());
    }
    queryListeners.get(queryKey)!.add(updateData);

    return () => {
      queryListeners.get(queryKey)?.delete(updateData);
      const cached = queryCache.get(queryKey);
      if (cached) {
        cached.count -= 1;
        if (cached.count === 0) {
          unsubscribe();
          queryCache.delete(queryKey);
          queryListeners.delete(queryKey);
        }
      }
    };
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}
