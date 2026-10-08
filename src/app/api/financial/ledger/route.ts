import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { listLedgers, saveLedger } from "@/services/financial-ledger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof AuthError
          ? e.message
          : "Não foi possível acessar o acervo financeiro. Tente novamente.",
    },
    { status: e instanceof AuthError ? e.status : 503, headers }
  );
}
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ books: await listLedgers(await requireAuth(request)) }, { headers });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 24 * 1024 * 1024) throw badRequest("Limite de 24 MB excedido.");
    const form = await request.formData();
    const data = form.get("data"),
      source = form.get("source");
    if (
      !(data instanceof File) ||
      !(source instanceof File) ||
      data.size > 12 * 1024 * 1024 ||
      source.size > 10 * 1024 * 1024
    )
      throw badRequest("Selecione o arquivo NAI e o PDF original (máximo 12 MB e 10 MB).");
    let payload: unknown;
    try {
      payload = JSON.parse(await data.text());
    } catch {
      throw badRequest("O arquivo NAI não contém dados válidos.");
    }
    return NextResponse.json(
      await saveLedger(user, payload, Buffer.from(await source.arrayBuffer())),
      { headers }
    );
  } catch (e) {
    return failure(e);
  }
}
