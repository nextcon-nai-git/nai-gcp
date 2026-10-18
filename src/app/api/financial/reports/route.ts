import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { badRequest } from "@/lib/auth/errors";
import { limitedFormData, privateHeaders, privateFailure } from "@/lib/http/private-api";
import { listReports, saveReport } from "@/services/financial-reports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      { reports: await listReports(await requireAuth(request)) },
      { headers: privateHeaders }
    );
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    const form = await limitedFormData(request, 11 * 1024 * 1024);
    const source = form.get("source");
    if (!(source instanceof File) || source.size > 10 * 1024 * 1024)
      throw badRequest("Selecione um PDF de até 10 MB.");
    const data = {
      title: form.get("title"),
      periodStart: form.get("periodStart"),
      periodEnd: form.get("periodEnd"),
      description: form.get("description") || "",
    };
    return NextResponse.json(
      await saveReport(user, data, source.name, Buffer.from(await source.arrayBuffer())),
      { headers: privateHeaders }
    );
  } catch (e) {
    return privateFailure(e);
  }
}
