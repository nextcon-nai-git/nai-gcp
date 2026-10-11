import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { FINANCIAL_ACTION_IMPORT_MAX_BYTES } from "@/lib/financial/actions";
import {
  importFinancialActions,
  listFinancialActions,
  updateFinancialAction,
} from "@/services/financial-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível acessar as ações financeiras. Tente novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
async function json(request: NextRequest, limit: number): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    throw badRequest("Envie um arquivo JSON de ações financeiras.");
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw badRequest("A solicitação excede o tamanho permitido.");
  if (!request.body) throw badRequest("Arquivo vazio.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw badRequest("A solicitação excede o tamanho permitido.");
      }
      chunks.push(chunk.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw badRequest("O arquivo não contém JSON válido.");
    }
  } finally {
    reader.releaseLock();
  }
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    return NextResponse.json(
      await listFinancialActions(user, Object.fromEntries(request.nextUrl.searchParams)),
      { headers }
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    return NextResponse.json(
      await importFinancialActions(user, await json(request, FINANCIAL_ACTION_IMPORT_MAX_BYTES)),
      { headers }
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    return NextResponse.json(await updateFinancialAction(user, await json(request, 32 * 1024)), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
