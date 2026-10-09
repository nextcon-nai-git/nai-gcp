"use client";

import { useState, useEffect } from "react";
import {
  queryEqual,
  onSnapshot,
  type Query,
  type DocumentData,
  type FirestoreError,
  type CollectionReference,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError, type SecurityRuleContext } from "@/firebase/errors";

export type WithId<T> = T & { id: string };
export interface UseCollectionDedupedResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

type Target = CollectionReference<DocumentData> | Query<DocumentData>;
type SharedResult = UseCollectionDedupedResult<DocumentData>;
interface Subscription {
  target: Target;
  result: SharedResult;
  listeners: Set<(result: SharedResult) => void>;
  unsubscribe: () => void;
  closed: boolean;
}

// Only retain state while at least one mounted consumer needs the subscription.
const subscriptions = new Set<Subscription>();
const emptyResult: SharedResult = { data: null, isLoading: false, error: null };

function broadcast(subscription: Subscription, result: SharedResult) {
  if (subscription.closed) return;
  subscription.result = result;
  subscription.listeners.forEach((listener) => listener(result));
}

function contextualizeError(target: Target, serverError: FirestoreError): Error {
  if (serverError.code !== "permission-denied") return serverError;
  let path = "collection-group";
  const reference = target as CollectionReference;
  if (reference.path) path = reference.path;
  try {
    const error = new FirestorePermissionError({
      operation: "list",
      path,
    } satisfies SecurityRuleContext);
    errorEmitter.emit("permission-error", error);
    return error;
  } catch {
    // Diagnostic context must never prevent all consumers from receiving the failure.
    return serverError;
  }
}

/** Shares the live listener and its latest data/error with every mounted consumer. */
export function useCollectionDeduped<T = any>(
  memoizedTargetRefOrQuery: Target | null | undefined
): UseCollectionDedupedResult<T> {
  const target = memoizedTargetRefOrQuery ?? null;
  const [state, setState] = useState<{ target: Target | null; result: SharedResult }>({
    target: null,
    result: emptyResult,
  });

  useEffect(() => {
    if (!target) {
      setState({ target: null, result: emptyResult });
      return;
    }

    // Public equality includes Firestore instance, query constraints and converter.
    // Serializing SDK internals loses that identity and may contain circular objects.
    let subscription = [...subscriptions].find((entry) => queryEqual(entry.target, target));
    const isNew = !subscription;
    if (!subscription) {
      subscription = {
        target,
        result: { data: null, isLoading: true, error: null },
        listeners: new Set(),
        unsubscribe: () => {},
        closed: false,
      };
      subscriptions.add(subscription);
    }
    const entry = subscription;
    const receive = (result: SharedResult) => setState({ target, result });
    entry.listeners.add(receive);
    // A late subscriber must not wait for another database change to leave loading.
    receive(entry.result);

    if (isNew) {
      try {
        entry.unsubscribe = onSnapshot(
          target,
          (snapshot) => {
            broadcast(entry, {
              data: snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
              isLoading: false,
              error: null,
            });
          },
          (serverError) => {
            if (entry.closed) return;
            broadcast(entry, {
              data: null,
              isLoading: false,
              error: contextualizeError(target, serverError),
            });
          }
        );
      } catch (error) {
        broadcast(entry, {
          data: null,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return () => {
      entry.listeners.delete(receive);
      if (entry.listeners.size === 0) {
        entry.closed = true;
        entry.unsubscribe();
        subscriptions.delete(entry);
      }
    };
  }, [target]);

  // Never render the previous company's records while the new effect is pending.
  if (state.target !== target) return { data: null, error: null, isLoading: !!target };
  return state.result as UseCollectionDedupedResult<T>;
}
