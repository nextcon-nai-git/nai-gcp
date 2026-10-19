import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { getProductionBook } from "@/services/production-central";
import { getFinanceBook } from "@/services/financial-operations";
import {
  billingQueue,
  billingQueueSummary,
  type BillingQueueSnapshot,
} from "@/lib/production/billing-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    const version = req.nextUrl.searchParams.get("expectedVersion");
    if (!version || !/^(0|[1-9]\d{0,15})$/.test(version) || !Number.isSafeInteger(Number(version)))
      throw badRequest("Informe a versão da Central para conferir o faturamento.");
    const central = await getProductionBook(user);
    if (central.version !== Number(version))
      throw new AuthError("A Central mudou. Atualize a Central e consulte a fila novamente.", 409);
    const finance = await getFinanceBook(user);
    const items = billingQueue(central, finance);
    const snapshot: BillingQueueSnapshot = {
      centralVersion: central.version,
      financeVersion: finance.version,
      generatedAt: new Date().toISOString(),
      items,
      summary: billingQueueSummary(items),
    };
    return NextResponse.json(snapshot, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
