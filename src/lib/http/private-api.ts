import { NextRequest, NextResponse } from "next/server";
import { AuthError, badRequest } from "@/lib/auth/errors";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
};
export function privateFailure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível concluir. Atualize para conferir antes de tentar novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers: privateHeaders }
  );
}
export async function limitedBytes(request: NextRequest, max: number) {
  if (!request.body) throw badRequest("Conteúdo obrigatório.");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new AuthError("Arquivo ou solicitação acima do limite.", 413);
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function limitedJson(request: NextRequest, max = 65536) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw badRequest("Envie JSON.");
  const bytes = await limitedBytes(request, max);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw badRequest("JSON inválido.");
  }
}
