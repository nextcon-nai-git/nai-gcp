import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessClinicalImport, requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, handleAuthError, badRequest, forbidden } from "@/lib/auth/errors";
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
    if (
      patch.dueDate &&
      (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(patch.dueDate) ||
        Number.isNaN(Date.parse(patch.dueDate)) ||
        new Date(patch.dueDate).toISOString().slice(0, 10) !== patch.dueDate.slice(0, 10))
    )
      throw badRequest("Prazo inválido.");
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
        throw badRequest("Card da importação não encontrado nesta empresa.");
      const current = snap.data()!;
      const restricted =
        current.restricted === true ||
        ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(current.documentType);
      const finalStatus = patch.status ?? current.status;
      if (patch.status === "done" && restricted && !canAccessClinicalImport(user))
        throw forbidden("A conclusão desta revisão exige um perfil de saúde autorizado.");

      // A mandatory source checklist cannot be removed to bypass completion.
      const originalChecklist = (current.checklist || []) as {
        id?: string;
        text: string;
        checked: boolean;
        mandatory?: boolean;
      }[];
      if (restricted) {
        const changedText = ["title", "lastComment"].some(
          (key) =>
            patch[key as "title" | "lastComment"] !== undefined &&
            patch[key as "title" | "lastComment"] !== (current[key] || "")
        );
        const changedChecklist =
          patch.checklist &&
          (patch.checklist.length !== originalChecklist.length ||
            patch.checklist.some(
              (item, index) =>
                item.id !== originalChecklist[index].id ||
                item.text !== originalChecklist[index].text
            ));
        if (changedText || changedChecklist)
          throw new AuthError(
            "O texto deste card é administrativo. Consulte a análise médica no registro restrito.",
            409
          );
      }
      if (patch.checklist) {
        for (const original of originalChecklist.filter((item) => item.mandatory)) {
          const item = patch.checklist.find((candidate) =>
            original.id ? candidate.id === original.id : candidate.text === original.text
          );
          if (!item || item.mandatory === false || item.text !== original.text)
            throw new AuthError("Preserve os itens obrigatórios do checklist de origem.", 409);
          item.mandatory = true;
        }
      }
      const checklist = patch.checklist || originalChecklist;
      if (
        finalStatus === "done" &&
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
