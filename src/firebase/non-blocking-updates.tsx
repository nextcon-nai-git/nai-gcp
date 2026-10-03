"use client";

import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  DocumentData,
  Firestore,
  SetOptions,
  writeBatch,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  setDoc(docRef, data, options).catch((error) => {
    errorEmitter.emit(
      "permission-error",
      new FirestorePermissionError({
        path: docRef.path,
        operation: "write", // or 'create'/'update' based on options
        requestResourceData: data,
      })
    );
  });
  // Execution continues immediately
}

/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data).catch((error) => {
    errorEmitter.emit(
      "permission-error",
      new FirestorePermissionError({
        path: colRef.path,
        operation: "create",
        requestResourceData: data,
      })
    );
  });
  return promise;
}

/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data).catch((error) => {
    errorEmitter.emit(
      "permission-error",
      new FirestorePermissionError({
        path: docRef.path,
        operation: "update",
        requestResourceData: data,
      })
    );
  });
}

/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef).catch((error) => {
    errorEmitter.emit(
      "permission-error",
      new FirestorePermissionError({
        path: docRef.path,
        operation: "delete",
      })
    );
  });
}

export type OptimizedBatchWrite =
  | { type: "set"; ref: DocumentReference; data: DocumentData; options?: SetOptions }
  | { type: "update"; ref: DocumentReference; data: DocumentData }
  | { type: "delete"; ref: DocumentReference };

export async function batchWriteOptimized(
  db: Firestore,
  writes: OptimizedBatchWrite[]
): Promise<void> {
  for (let start = 0; start < writes.length; start += 500) {
    const chunk = writes.slice(start, start + 500);
    const batch = writeBatch(db);
    for (const write of chunk) {
      if (write.type === "set") {
        batch.set(write.ref, write.data, write.options ?? {});
      } else if (write.type === "update") {
        batch.update(write.ref, write.data);
      } else {
        batch.delete(write.ref);
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: chunk[0]?.ref.path || "batch",
          operation: "write",
          requestResourceData: chunk.map(({ type }) => ({ type })),
        })
      );
      throw error;
    }
  }
}
