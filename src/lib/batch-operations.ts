import { Firestore, writeBatch, DocumentReference, SetOptions } from "firebase/firestore";

export interface BatchWrite {
  type: "set" | "update" | "delete";
  ref: DocumentReference;
  data?: any;
  options?: SetOptions;
}

/**
 * Executa múltiplas operações Firestore em lotes otimizados.
 * Máximo de 500 operações por lote (limite do Firestore).
 * Retorna array de promises para cada lote.
 */
export async function batchWriteOptimized(db: Firestore, writes: BatchWrite[]): Promise<void[]> {
  const BATCH_SIZE = 450; // Deixa margem de segurança (limite é 500)
  const results: Promise<void>[] = [];

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = writes.slice(i, i + BATCH_SIZE);

    for (const write of chunk) {
      switch (write.type) {
        case "set":
          if (write.options) batch.set(write.ref, write.data || {}, write.options);
          else batch.set(write.ref, write.data || {});
          break;
        case "update":
          batch.update(write.ref, write.data || {});
          break;
        case "delete":
          batch.delete(write.ref);
          break;
      }
    }

    results.push(batch.commit());
  }

  return Promise.all(results);
}

/**
 * Helper para criar writes em batch de forma simplificada.
 */
export function createBatchWrites(
  operations: Array<{
    type: "set" | "update" | "delete";
    ref: DocumentReference;
    data?: any;
    options?: SetOptions;
  }>
): BatchWrite[] {
  return operations.map((op) => ({
    type: op.type,
    ref: op.ref,
    data: op.data,
    options: op.options,
  }));
}
