"use server";

import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface LeadNaiData {
  skillTitle: string;
  userText?: string;
  aiResponse?: string;
  name?: string;
  whatsapp?: string;
  location?: string;
  companyName?: string;
  summary?: string;
}

export async function salvarLeadNai(data: LeadNaiData) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await addDoc(collection(db, "nai_leads"), {
      ...data,
      createdAt: serverTimestamp(),
      source: "Widget Flutuante NAI",
      status: "novo",
    });

    return { sucesso: true };
  } catch (error: any) {
    console.warn("Erro ao salvar lead NAI no Firestore:", error?.message || error);
    return { sucesso: false, erro: error?.message || "Erro desconhecido" };
  }
}
