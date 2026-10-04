import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, limit } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { unauthorized, forbidden } from "./errors";

export interface ApiKeyContext {
  id: string;
  clientId: string;
  scopes: string[];
  name?: string;
  rateLimit?: number;
}

/**
 * Validação segura de chaves de API M2M no lado do servidor
 */
export async function requireApiKey(request: NextRequest): Promise<ApiKeyContext> {
  const apiKey = request.headers.get("x-nai-api-key") || request.headers.get("x-api-key");

  if (!apiKey) {
    throw unauthorized("Chave de API ausente. Forneça o cabeçalho X-NAI-API-Key.");
  }

  const keyHash = createHash("sha256").update(apiKey.trim()).digest("hex");

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const q = query(
    collection(db, "api_keys"),
    where("keyHash", "==", keyHash),
    where("active", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw unauthorized("Chave de API inválida ou revogada.");
  }

  const docData = snapshot.docs[0].data();
  return {
    id: snapshot.docs[0].id,
    clientId: docData.clientId || "GLOBAL",
    scopes: Array.isArray(docData.scopes) ? docData.scopes : [],
    name: docData.name || "API Client",
    rateLimit: docData.rateLimit || 100,
  };
}

export function requireApiScope(context: ApiKeyContext, requiredScope: string): void {
  if (!context.scopes.includes("*") && !context.scopes.includes(requiredScope)) {
    throw forbidden(
      `Escopo de API insuficiente. Requer: '${requiredScope}'. Escopos ativos: [${context.scopes.join(", ")}].`
    );
  }
}

export function requireApiTenant(context: ApiKeyContext, targetTenantId: string): void {
  if (context.clientId !== "GLOBAL" && context.clientId !== targetTenantId) {
    throw forbidden(
      `Isolamento de API Key: Esta chave pertence ao cliente '${context.clientId}' e não pode acessar '${targetTenantId}'.`
    );
  }
}
