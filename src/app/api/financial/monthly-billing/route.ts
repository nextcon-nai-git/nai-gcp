import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden } from "@/lib/auth/errors";
import { MonthlyBillingImportSchema } from "@/lib/monthly-billing";
import { listMonthlyBilling, saveMonthlyBilling } from "@/services/monthly-billing";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível acessar o faturamento mensal. Tente novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "SUPER_ADMIN") throw forbidden();
    const id = request.nextUrl.searchParams.get("group") || "";
    if (id.length > 128 || /[\/\u0000]/.test(id)) throw new AuthError("Grupo inválido.", 400);
    return NextResponse.json(await listMonthlyBilling(user, id), { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "SUPER_ADMIN") throw forbidden();
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 65536)
      throw new AuthError("Lote acima do limite de 64 KB.", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AuthError("Lote inválido.", 400);
    }
    const parsed = MonthlyBillingImportSchema.safeParse(body);
    if (!parsed.success) throw new AuthError(parsed.error.issues[0].message, 400);
    return NextResponse.json(await saveMonthlyBilling(user, parsed.data), { headers });
  } catch (error) {
    return failure(error);
  }
}
