"use client";

import { useEffect, useState } from "react";
import {
  onSnapshot,
  type CollectionReference,
  type DocumentData,
  type FirestoreError,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError, type SecurityRuleContext } from "@/firebase/errors";
import type { UseCollectionResult, WithId } from "./use-collection";

type CollectionTarget = CollectionReference<DocumentData> | Query<DocumentData>;
type Listener<T> = (data: WithId<T>[] | null, error: FirestoreError | Error | null) => void;

interface SharedSubscription {
  listeners: Set<Listener<unknown>>;
  unsubscribe: () => void;
}

const subscriptions = new WeakMap<object, SharedSubscription>();

function getQueryPath(target: CollectionTarget): string {
  try {
    const queryTarget = target as Query<DocumentData> & {
      _query?: { collectionGroup?: string; path?: { segments?: string[] } };
      path?: string;
    };
    if (queryTarget._query?.collectionGroup) {
      return `group:${queryTarget._query.collectionGroup}`;
    }
    if (queryTarget.path) return queryTarget.path;
    return queryTarget._query?.path?.segments?.join("/") || "complex-query";
  } catch {
    return "complex-query";
  }
}

function subscribe<T>(target: CollectionTarget, listener: Listener<T>): () => void {
  const key = target as object;
  let subscription = subscriptions.get(key);

  if (!subscription) {
    subscription = { listeners: new Set(), unsubscribe: () => {} };
    subscriptions.set(key, subscription);
    subscription.listeners.add(listener as Listener<unknown>);

    const currentSubscription = subscription;
    currentSubscription.unsubscribe = onSnapshot(
      target,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map((document) => ({
          ...(document.data() as object),
          id: document.id,
        }));
        currentSubscription.listeners.forEach((notify) => notify(data, null));
      },
      (serverError: FirestoreError) => {
        let error: FirestoreError | Error = serverError;
        if (serverError.code === "permission-denied") {
          const permissionError = new FirestorePermissionError({
            operation: "list",
            path: getQueryPath(target),
          } satisfies SecurityRuleContext);
          error = permissionError;
          errorEmitter.emit("permission-error", permissionError);
        }
        currentSubscription.listeners.forEach((notify) => notify(null, error));
      }
    );
  } else {
    subscription.listeners.add(listener as Listener<unknown>);
  }

  return () => {
    const activeSubscription = subscriptions.get(key);
    if (!activeSubscription) return;
    activeSubscription.listeners.delete(listener as Listener<unknown>);
    if (activeSubscription.listeners.size === 0) {
      activeSubscription.unsubscribe();
      subscriptions.delete(key);
    }
  };
}

export function useCollectionDeduped<T = unknown>(
  memoizedTargetRefOrQuery: CollectionTarget | null | undefined
): UseCollectionResult<T> {
  const [result, setResult] = useState<{
    target: CollectionTarget | null | undefined;
    data: WithId<T>[] | null;
    error: FirestoreError | Error | null;
  }>({ target: null, data: null, error: null });

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) return;

    return subscribe<T>(memoizedTargetRefOrQuery, (nextData, nextError) => {
      setResult({
        target: memoizedTargetRefOrQuery,
        data: nextData,
        error: nextError,
      });
    });
  }, [memoizedTargetRefOrQuery]);

  if (result.target !== memoizedTargetRefOrQuery) {
    return { data: null, isLoading: Boolean(memoizedTargetRefOrQuery), error: null };
  }

  return {
    data: result.data,
    isLoading: Boolean(memoizedTargetRefOrQuery) && result.data === null && !result.error,
    error: result.error,
  };
}
