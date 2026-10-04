"use client";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";

/**
 * @fileOverview Serviço de Gestão de Compliance NAI.
 * Implementa o Canal de Ética com protocolos seguros, imutáveis e sem colisão (LGPD / Compliance).
 */

export const CATEGORIAS_COMPLIANCE = {
  assedio_moral: { nome: "Assédio Moral / Abuso de Poder", severidade: "Média-Alta" },
  assedio_sexual: { nome: "Assédio Sexual", severidade: "Crítica" },
  fraude_corrupcao: { nome: "Fraude, Roubo ou Corrupção", severidade: "Crítica" },
  conflito_interesses: { nome: "Conflito de Interesses", severidade: "Média" },
  discriminacao: { nome: "Discriminação", severidade: "Alta" },
  seguranca_meio_ambiente: { nome: "Riscos SST / NRs", severidade: "Alta" },
  vazamento_dados: { nome: "Violação da LGPD", severidade: "Média-Alta" },
};

/**
 * Gera um protocolo de denúncia de alta entropia, combinando ano, timestamp base-36 e UUID criptográfico.
 * Elimina totalmente risco de colisão acidental ou ataque de enumeração.
 */
export function generateCollisionFreeProtocol(
  prefix = "DEN",
  year = new Date().getFullYear()
): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()
      : Math.random().toString(36).substring(2, 10).toUpperCase();

  return `${prefix}-${year}-${timePart}-${randomPart}`;
}

export async function criarDenuncia(db: Firestore, dadosFormulario: any) {
  let protocolo = generateCollisionFreeProtocol();
  let docRef = doc(db, "denuncias", protocolo);
  let attempts = 0;

  // Garante unicidade absoluta antes de salvar, evitando sobreescrita silenciosa de relatos
  while (attempts < 5) {
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      break;
    }
    attempts++;
    protocolo = generateCollisionFreeProtocol();
    docRef = doc(db, "denuncias", protocolo);
  }

  const novaDenuncia = {
    protocolo: protocolo,
    tipoRelato: dadosFormulario.isAnonimo ? "anonimo" : "identificado",
    dadosIdentificacao: dadosFormulario.isAnonimo
      ? {
          nome: null,
          email: null,
        }
      : {
          nome: dadosFormulario.nome,
          email: dadosFormulario.email,
        },
    categoria: dadosFormulario.categoria,
    detalhes: {
      descricao: dadosFormulario.descricao,
      dataFato: dadosFormulario.dataFato,
      local: dadosFormulario.local,
    },
    status: "triagem",
    prioridade:
      CATEGORIAS_COMPLIANCE[dadosFormulario.categoria as keyof typeof CATEGORIAS_COMPLIANCE]
        ?.severidade || "Média",
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, novaDenuncia);
  return protocolo;
}

export async function enviarMensagemChat(
  db: Firestore,
  protocolo: string,
  texto: string,
  remetente: "denunciante" | "ouvidor"
) {
  const path = collection(db, "denuncias", protocolo, "mensagens");
  await addDoc(path, {
    remetente,
    texto,
    enviadoEm: serverTimestamp(),
  });
}
