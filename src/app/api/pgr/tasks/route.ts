import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, handleAuthError, badRequest } from "@/lib/auth/errors";
const Patch = z
  .object({
    title: z.string().min(3).max(180).optional(),
    status: z.enum(["todo", "doing", "review", "done", "archived", "started"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    responsibleId: z.string().max(128).optional(),
    responsibleName: z.string().max(180).optional(),
    dueDate: z.string().max(30).optional(),
    checklist: z
      .array(
        z.object({
          id: z.string().max(100).optional(),
          text: z.string().min(3).max(350),
          checked: z.boolean(),
          mandatory: z.boolean().optional(),
        })
      )
      .max(50)
      .optional(),
    lastComment: z.string().max(5000).optional(),
  })
  .strict();
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const companyId = request.nextUrl.searchParams.get("companyId") || "";
    requirePgrCompany(user, companyId);
    const snap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("tasks")
      .where("sourceType", "==", "pgr")
      .limit(500)
      .get();
    return NextResponse.json(
      { tasks: snap.docs.map((d) => ({ ...d.data(), id: d.id })), limited: snap.size === 500 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return e instanceof AuthError
      ? handleAuthError(e)
      : NextResponse.json({ error: "Cards indisponíveis." }, { status: 503 });
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const text = await request.text();
    if (Buffer.byteLength(text) > 30000) throw badRequest("Alteração acima do limite.");
    const data = JSON.parse(text);
    requirePgrCompany(user, data.companyId);
    if (typeof data.taskId !== "string" || !/^pgr_[a-f0-9_]+$/.test(data.taskId))
      throw badRequest("Card inválido.");
    const patch = Patch.parse(data.patch);
    const ref = adminDb
      .collection("companies")
      .doc(data.companyId)
      .collection("tasks")
      .doc(data.taskId);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (
        !snap.exists ||
        snap.data()?.sourceType !== "pgr" ||
        snap.data()?.companyId !== data.companyId
      )
        throw badRequest("Card PGR não encontrado nesta empresa.");
      const checklist = patch.checklist || snap.data()?.checklist || [];
      if (
        patch.status === "done" &&
        checklist.some((c: { mandatory?: boolean; checked: boolean }) => c.mandatory && !c.checked)
      )
        throw new AuthError("Conclua o checklist obrigatório antes de finalizar o card.", 409);
      tx.update(ref, {
        ...patch,
        progress: checklist.length
          ? Math.round(
              (checklist.filter((c: { checked: boolean }) => c.checked).length / checklist.length) *
                100
            )
          : 0,
        updatedAt: FieldValue.serverTimestamp(),
        modifiedBy: user.uid,
      });
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return e instanceof AuthError
      ? handleAuthError(e)
      : NextResponse.json({ error: "Alteração inválida ou não concluída." }, { status: 422 });
  }
}
