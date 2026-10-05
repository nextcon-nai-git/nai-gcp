"use client";

import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeNaiAppCheck } from "./app-check";

/**
 * Inicializa os serviços do Firebase de forma resiliente para o ambiente de produção.
 * Isolado para suportar o Hydration e o ciclo de vida do Next.js 15.
 */
export function initializeFirebase() {
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  initializeNaiAppCheck(firebaseApp);
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    // Força o uso do bucket definido no config para garantir persistência de documentos SST
    storage: getStorage(firebaseApp, firebaseConfig.storageBucket),
  };
}
