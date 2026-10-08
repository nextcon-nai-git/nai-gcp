import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden, handleAuthError } from "@/lib/auth/errors";
import {
  dailyReportSchema,
  activityLines,
  normalizedEmployeeName,
} from "@/lib/daily-activity-report";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function authorize(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== "SUPER_ADMIN" && !(user.role === "ADMIN" && !user.tenantId)) throw forbidden();
  return user;
}
export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const date = request.nextUrl.searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return NextResponse.json({ error: "Informe a data do relato." }, { status: 400, headers });
    const snapshot = await adminDb
      .collection("nxc_daily_reports")
      .where("date", "==", date)
      .limit(100)
      .get();
    return NextResponse.json(
      {
        reports: snapshot.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            employeeName: v.employeeName,
            contractType: v.contractType,
            date: v.date,
            activities: v.activities,
            reportText: v.reportText,
          };
        }),
      },
      { headers }
    );
  } catch (error) {
    return error instanceof AuthError
      ? handleAuthError(error)
      : NextResponse.json(
          { error: "Não foi possível consultar os relatos." },
          { status: 503, headers }
        );
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await authorize(request);
    const parsed = dailyReportSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Confira nome, regime, data e descrição das atividades." },
        { status: 400, headers }
      );
    const report = parsed.data;
    const id = createHash("sha256")
      .update(
        `${normalizedEmployeeName(report.employeeName)}|${report.contractType}|${report.date}`
      )
      .digest("hex");
    const ref = adminDb.collection("nxc_daily_reports").doc(id);
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.reportText === report.reportText) return;
        throw new AuthError(
          "Já existe um relato para esta pessoa e data. O registro anterior foi preservado.",
          409
        );
      }
      tx.create(ref, {
        ...report,
        activities: activityLines(report.reportText),
        recordedBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
        source: "Relato informado pela gestão",
      });
    });
    return NextResponse.json({ id, saved: true }, { headers });
  } catch (error) {
    return error instanceof AuthError
      ? handleAuthError(error)
      : NextResponse.json({ error: "Não foi possível salvar o relato." }, { status: 503, headers });
  }
}
