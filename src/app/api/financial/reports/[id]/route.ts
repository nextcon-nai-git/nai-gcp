import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { readReport, readReportPdf } from "@/services/financial-reports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request),
      { id } = await context.params;
    if (request.nextUrl.searchParams.get("source") === "1") {
      const pdf = await readReportPdf(user, id);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="relatorio-financeiro.pdf"',
          "Content-Security-Policy": "sandbox",
        },
      });
    }
    return NextResponse.json(await readReport(user, id), { headers: privateHeaders });
  } catch (e) {
    return privateFailure(e);
  }
}
