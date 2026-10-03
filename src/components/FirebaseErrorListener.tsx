"use client";

import { useState, useEffect } from "react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/**
 * Listener global para erros de permissão do Firestore.
 * Conecta o motor de dados do Firebase com os Error Boundaries do Next.js.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      setError(error);
    };

    errorEmitter.on("permission-error", handleError);

    return () => {
      errorEmitter.off("permission-error", handleError);
    };
  }, []);

  // Ao detectar um erro, lança para ser capturado pelo error.tsx mais próximo
  if (error) {
    throw error;
  }

  return null;
}
