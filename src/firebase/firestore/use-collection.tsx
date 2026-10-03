"use client";

import type { CollectionReference, DocumentData, FirestoreError, Query } from "firebase/firestore";
import { useCollectionDeduped } from "./use-collection-deduped";

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useCollection<T = any>(
  memoizedTargetRefOrQuery:
    CollectionReference<DocumentData> | Query<DocumentData> | null | undefined
): UseCollectionResult<T> {
  return useCollectionDeduped<T>(memoizedTargetRefOrQuery);
}
