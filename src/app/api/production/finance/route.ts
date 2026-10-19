import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { badRequest } from "@/lib/auth/errors";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { getProductionBook } from "@/services/production-central";
import { getFinanceBook } from "@/services/financial-operations";
import { normalizeCnpj } from "@/lib/cnpj";
import { checkCycleFinance, receiptIndex, emptyReceipts } from "@/lib/production/finance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    const recordId = req.nextUrl.searchParams.get("recordId");
    if (!recordId || !/^[a-zA-Z0-9_-]{1,100}$/.test(recordId))
      throw badRequest("Selecione um registro da central.");
    const central = await getProductionBook(user);
    const record = central.records.find((r) => r.id === recordId);
    if (!record) throw badRequest("Registro não encontrado.");
    const book = await getFinanceBook(user);
    const receipts = receiptIndex(book);
    const contracts = book.contracts
      .filter(
        (c) =>
          c.active &&
          book.contractFlows.some(
            (f) => f.contractId === c.id && normalizeCnpj(f.customerDocument) === record.cnpj
          )
      )
      .map((c) => ({ id: c.id, name: c.name, client: c.client, monthlyCents: c.monthlyCents }));
    const titles = book.titles
      .filter(
        (t) =>
          record.financeContractId &&
          t.contractId === record.financeContractId &&
          t.kind === "receivable" &&
          t.status === "approved"
      )
      .map((t) => {
        const summary = receipts.get(t.id) || emptyReceipts();
        return {
          id: t.id,
          description: t.description,
          competence: t.competence,
          amountCents: t.amountCents,
          receivedCents: summary.receivedCents,
          adjustmentCents: summary.adjustmentCents,
          unreconciledCount: summary.unreconciledCount,
        };
      });
    return NextResponse.json(
      {
        contracts,
        titles,
        version: book.version,
        cycles: record.cycles.map((c) => checkCycleFinance(record, c, book, receipts)),
      },
      { headers: privateHeaders }
    );
  } catch (e) {
    return privateFailure(e);
  }
}
