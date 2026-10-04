import { NextRequest } from "next/server";
import { AuthContext } from "./auth-context";
import { ApiKeyContext, requireApiKey } from "./api-key";
import { requireAuth } from "./require-auth";

export type SecurityContext =
  { type: "USER"; context: AuthContext } | { type: "API_KEY"; context: ApiKeyContext };

/**
 * Autentica uma requisição aceitando ou Firebase User Token (Bearer) ou API Key (X-NAI-API-Key)
 */
export async function authenticateRequest(request: NextRequest): Promise<SecurityContext> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const user = await requireAuth(request);
    return { type: "USER", context: user };
  }

  const apiKey = await requireApiKey(request);
  return { type: "API_KEY", context: apiKey };
}

export function getTenantFromContext(ctx: SecurityContext): string | null {
  if (ctx.type === "USER") {
    return ctx.context.tenantId;
  }
  return ctx.context.clientId === "GLOBAL" ? null : ctx.context.clientId;
}
