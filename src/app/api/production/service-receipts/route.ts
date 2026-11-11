import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { FinanceCommandSchema } from "@/lib/financial/operations";
import { isServiceAllocationCommand } from "@/lib/financial/service-allocations";
import { buildServiceReceiptsSnapshot } from "@/lib/production/service-receipts";
import { getProductionBook } from "@/services/production-central";
import { getFinanceBook, saveFinanceCommand } from "@/services/financial-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    const version = req.nextUrl.searchParams.get("expectedVersion");
    if (!version || !/^(0|[1-9]\d{0,15})$/.test(version) || !Number.isSafeInteger(Number(version)))
      throw badRequest("Informe a versão da Central para consultar os serviços.");
    const central = await getProductionBook(user);
    if (central.version !== Number(version))
      throw new AuthError("A Central mudou. Atualize os serviços e consulte novamente.", 409);
    const finance = await getFinanceBook(user);
    return NextResponse.json(
      buildServiceReceiptsSnapshot(central, finance, new Date().toISOString()),
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    const parsed = FinanceCommandSchema.safeParse(await limitedJson(req, 256 * 1024));
    if (!parsed.success || !isServiceAllocationCommand(parsed.data))
      throw badRequest("Selecione uma operação válida de associação dos serviços.");
    const book = await saveFinanceCommand(user, parsed.data);
    return NextResponse.json({ book }, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
