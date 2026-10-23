import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError } from "@/lib/auth/errors";
import { limitedJson } from "@/lib/http/private-api";
import { WorkflowSchema, workflowProblems } from "@/lib/avp-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const root = () => adminDb.collection("webhook_deliveries").doc("grupo-avp-workflow");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function access(req: NextRequest) {
  const user = await requireAuth(req);
  requireAvpAccess(user);
  if (!canAccessAvpEvidence(user))
    throw new AuthError("Esteira disponível à equipe interna AVP.", 403);
  return user;
}
function failure(e: unknown) {
  return NextResponse.json(
    { error: e instanceof AuthError ? e.message : "Não foi possível atualizar a esteira AVP." },
    { status: e instanceof AuthError ? e.status : 503, headers }
  );
}
export async function GET(req: NextRequest) {
  try {
    await access(req);
    const docs = await root().collection("cases").limit(10001).get();
    if (docs.size > 10000)
      throw new AuthError("Esteira excede o limite de consulta. Contate o suporte.", 503);
    return NextResponse.json(
      { records: docs.docs.map((d) => ({ ...d.data(), id: d.id })) },
      { headers }
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await access(req);
    const parsed = z
      .object({ record: WorkflowSchema, version: z.number().int().nonnegative() })
      .strict()
      .safeParse(await limitedJson(req, 20000));
    if (!parsed.success) throw new AuthError("Confira os campos e as datas da esteira.", 400);
    const { record, version } = parsed.data;
    const problems = workflowProblems(record);
    if (problems.length) throw new AuthError(problems.join(" "), 400);
    const id = hash(JSON.stringify([record.sourceId, record.unit, record.admission]));
    const ref = root().collection("cases").doc(id);
    const result = await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if ((current.data()?.version ?? 0) !== version)
        throw new AuthError("Outro usuário alterou este caso. Atualize antes de salvar.", 409);
      const previous = current.data();
      if (
        previous &&
        previous.evidenceId !== record.evidenceId &&
        (record.documentChecked ||
          record.deliveryReference ||
          ["ready", "delivered"].includes(record.stage))
      )
        throw new AuthError(
          "Ao substituir o PDF, salve em conferência e refaça a revisão e a entrega.",
          400
        );
      const previousOrder = typeof previous?.socOrder === "string" ? previous.socOrder : "";
      const previousOrderRef =
        previousOrder && previousOrder !== record.socOrder
          ? root().collection("orders").doc(hash(previousOrder))
          : null;
      const previousReservation = previousOrderRef ? await tx.get(previousOrderRef) : null;
      // Read every dependency before writing; evidence receipt is never inferred from sheet status.
      if (record.evidenceId) {
        const evidence = await tx.get(
          adminDb
            .collection("webhook_deliveries")
            .doc("grupo-avp-evidence")
            .collection("records")
            .doc(record.evidenceId)
        );
        const aso = evidence.data();
        if (!aso || aso.kind !== "aso" || aso.uploaded !== true || aso.review !== "Recebido")
          throw new AuthError(
            "Selecione um ASO com PDF anexado e sem pendência de vínculo ou retificação.",
            400
          );
        const norm = (s: string) =>
          s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        if (norm(String(aso.employee)) !== norm(record.employee))
          throw new AuthError("O nome do ASO diverge do caso. Confira o vínculo.", 400);
      }
      const orderRef = record.socOrder
        ? root().collection("orders").doc(hash(record.socOrder))
        : null;
      if (orderRef) {
        const order = await tx.get(orderRef);
        if (order.exists && order.data()?.caseId !== id)
          throw new AuthError(
            "Este pedido SOC já está vinculado a outro caso. Confira a duplicidade.",
            409
          );
      }
      const updatedAt = new Date().toISOString();
      const saved = { ...record, id, version: version + 1, updatedAt, updatedBy: user.uid };
      if (previousOrderRef && previousReservation?.data()?.caseId === id)
        tx.delete(previousOrderRef);
      tx.set(ref, saved);
      tx.create(ref.collection("history").doc(String(version + 1)), saved);
      if (orderRef) tx.set(orderRef, { caseId: id });
      return saved;
    });
    return NextResponse.json({ record: result }, { headers });
  } catch (e) {
    return failure(e);
  }
}
