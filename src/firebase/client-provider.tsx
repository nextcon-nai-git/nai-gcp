"use client";

import React, { useMemo, type ReactNode } from "react";
import { FirebaseProvider } from "./provider";
import { initializeFirebase } from "./init";

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Provider de cliente que garante a inicialização única do Firebase.
 * Importa diretamente de ./init para evitar ciclos com o index.ts.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
