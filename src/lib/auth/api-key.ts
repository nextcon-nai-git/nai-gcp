import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
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

  const snapshot = await adminDb
    .collection("api_keys")
    .where("keyHash", "==", keyHash)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (snapshot.empty) {
    throw unauthorized("Chave de API inválida ou revogada.");
  }

  const docData = snapshot.docs[0].data();
  if (
    typeof docData.clientId !== "string" ||
    !docData.clientId.trim() ||
    !Array.isArray(docData.scopes) ||
    docData.scopes.some((scope: unknown) => typeof scope !== "string")
  ) {
    throw unauthorized("Credencial de API sem vínculo ou escopos válidos.");
  }
  return {
    id: snapshot.docs[0].id,
    clientId: docData.clientId,
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
