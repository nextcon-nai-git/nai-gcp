import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { getFinanceBook, saveFinanceCommand } from "@/services/financial-operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível acessar o controle financeiro. Atualize para conferir o resultado antes de tentar novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    return NextResponse.json(await getFinanceBook(user), { headers });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    if (!request.headers.get("content-type")?.includes("application/json") || !request.body)
      throw badRequest("Envie uma operação JSON.");
    const reader = request.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 512 * 1024) {
          await reader.cancel();
          throw new AuthError("Operação acima de 512 KB.", 413);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw badRequest("JSON inválido.");
    }
    return NextResponse.json(await saveFinanceCommand(user, data), { headers });
  } catch (e) {
    return failure(e);
  }
}
