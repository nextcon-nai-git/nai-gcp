import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { ApiKeyRecord } from "@/types/developer";

export const VALID_DEVELOPER_SCOPES = [
  "*",
  "access_control:read",
  "employees:read",
  "employees:write",
  "medical:read",
  "medical:write",
  "esocial:read",
  "esocial:write",
  "incidents:read",
  "incidents:write",
  "pgr:read",
  "pgr:write",
  "webhooks:manage",
] as const;

export type DeveloperScope = (typeof VALID_DEVELOPER_SCOPES)[number];

// Rate Limiting in-memory sliding window cache (120 requests per minute per key)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(keyIdentifier: string): {
  allowed: boolean;
  remaining: number;
  resetMs: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(keyIdentifier) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
    rateLimitMap.set(keyIdentifier, entry);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetMs: RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.count += 1;
  rateLimitMap.set(keyIdentifier, entry);
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
  };
}

/**
 * Erro Padronizado de Governança de API
 */
export class ApiGuardError extends Error {
  constructor(
    public message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = "ApiGuardError";
  }
}

/**
 * Utilitário de tratamento de erro para rotas Next.js
 */
export function handleApiGuardError(error: unknown): NextResponse {
  if (error instanceof ApiGuardError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erro interno de autorização." }, { status: 500 });
}

/**
 * Gera uma nova chave de API M2M aleatória criptograficamente segura.
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const secretBytes = randomBytes(24).toString("hex");
  const rawKey = `nai_live_${secretBytes}`;
  const keyPrefix = rawKey.substring(0, 16);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  return { rawKey, keyHash, keyPrefix };
}

/**
 * 1. requireApiKey(req)
 * Extrai, valida hash SHA-256, aplica rate limit e registra trilha de auditoria.
 */
export async function requireApiKey(req: NextRequest): Promise<ApiKeyRecord> {
  const authHeader = req.headers.get("authorization") || "";
  const customKeyHeader = req.headers.get("x-api-key") || req.headers.get("x-nai-api-key") || "";

  let rawKey = "";
  if (customKeyHeader) {
    rawKey = customKeyHeader.trim();
  } else if (authHeader.startsWith("Bearer nai_live_")) {
    rawKey = authHeader.replace("Bearer ", "").trim();
  }

  if (!rawKey || !rawKey.startsWith("nai_live_")) {
    throw new ApiGuardError(
      "Autenticação de API ausente ou inválida. Forneça o header x-api-key.",
      401
    );
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const snap = await adminDb
    .collection("api_keys")
    .where("keyHash", "==", keyHash)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new ApiGuardError("Chave de API inexistente, inativa ou revogada.", 401);
  }

  const docSnap = snap.docs[0];
  const keyRecord = { id: docSnap.id, ...docSnap.data() } as ApiKeyRecord;

  if (
    typeof keyRecord.clientId !== "string" ||
    !keyRecord.clientId.trim() ||
    !Array.isArray(keyRecord.scopes) ||
    keyRecord.scopes.some((scope) => typeof scope !== "string")
  ) {
    throw new ApiGuardError("Credencial de API sem vínculo ou escopos válidos.", 401);
  }

  // Rate Limiting
  const rateLimit = checkRateLimit(keyRecord.id);
  if (!rateLimit.allowed) {
    throw new ApiGuardError(
      `Limite de taxa excedido (120 req/min). Tente novamente em ${Math.ceil(rateLimit.resetMs / 1000)}s.`,
      429
    );
  }

  // Auditoria M2M Assíncrona
  adminDb
    .collection("api_keys")
    .doc(docSnap.id)
    .update({
      lastUsedAt: new Date().toISOString(),
    })
    .catch(() => {});

  adminDb
    .collection("developer_api_logs")
    .add({
      keyId: keyRecord.id,
      keyPrefix: keyRecord.keyPrefix,
      clientId: keyRecord.clientId,
      endpoint: req.nextUrl.pathname,
      method: req.method,
      ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
      timestamp: FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return keyRecord;
}

/**
 * 2. requireScope(authKey, scope)
 * Garante que a chave possua o escopo necessário para a operação.
 */
export function requireScope(authKey: ApiKeyRecord, scope: DeveloperScope): void {
  if (!authKey || !Array.isArray(authKey.scopes)) {
    throw new ApiGuardError("Estrutura de credencial de API corrompida.", 401);
  }

  const hasScope = authKey.scopes.includes("*") || authKey.scopes.includes(scope);
  if (!hasScope) {
    throw new ApiGuardError(
      `Escopo insuficiente. Esta operação requer '${scope}', sua chave possui [${authKey.scopes.join(", ")}].`,
      403
    );
  }
}

/**
 * 3. requireClient(authKey, companyId)
 * Garante que a chave pertença estritamente à empresa/tenant solicitado (Zero Cross-Tenant Leak).
 */
export function requireClient(authKey: ApiKeyRecord, companyId: string): void {
  if (!authKey) {
    throw new ApiGuardError("Credencial de API não autenticada.", 401);
  }

  if (authKey.clientId === "GLOBAL" || authKey.clientId === "ALL_TENANTS") {
    return; // Chave master administrativa
  }

  if (!companyId || authKey.clientId !== companyId) {
    throw new ApiGuardError(
      `Isolamento Tenant: A chave de API vinculada ao clientId '${authKey.clientId}' não tem autorização para acessar dados da empresa '${companyId}'.`,
      403
    );
  }
}

/**
 * Helper unificado compatível com pipeline monolítico
 */
export async function authenticateApiKeyRequest(
  req: NextRequest,
  requiredScope?: DeveloperScope
): Promise<{
  success: boolean;
  status: number;
  error?: string;
  clientId?: string;
  keyRecord?: ApiKeyRecord;
}> {
  try {
    const keyRecord = await requireApiKey(req);
    if (requiredScope) {
      requireScope(keyRecord, requiredScope);
    }
    return {
      success: true,
      status: 200,
      clientId: keyRecord.clientId,
      keyRecord,
    };
  } catch (err) {
    if (err instanceof ApiGuardError) {
      return { success: false, status: err.status, error: err.message };
    }
    return {
      success: false,
      status: 500,
      error: "Falha de autenticação.",
    };
  }
}
