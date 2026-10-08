import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden, handleAuthError } from "@/lib/auth/errors";
import { APPROVED_PORTFOLIO, SANTANDER_RECORD, portfolioGroup } from "@/lib/client-portfolio";
export const dynamic = "force-dynamic";
const migrationId = "client-portfolio-approved-2026-10-07";
const headers = { "Cache-Control": "private, no-store" };
async function authorize(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== "SUPER_ADMIN") throw forbidden();
  return user;
}
function revision(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  return createHash("sha256")
    .update(
      docs
        .map((d) => `${d.id}:${d.updateTime.toMillis()}`)
        .sort()
        .join("|")
    )
    .digest("hex");
}
export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const [snapshot, audit] = await Promise.all([
      adminDb.collection("companies").get(),
      adminDb.collection("admin_migrations").doc(migrationId).get(),
    ]);
    return NextResponse.json(
      {
        revision: revision(snapshot.docs),
        applied: audit.exists,
        groups: APPROVED_PORTFOLIO.map((g) => ({ name: g.name, records: g.records.length })),
        records: snapshot.size,
        inactive: snapshot.docs.filter((d) => !portfolioGroup(d.id) && d.id !== SANTANDER_RECORD)
          .length,
        santander: snapshot.docs.some((d) => d.id === SANTANDER_RECORD),
      },
      { headers }
    );
  } catch (error) {
    return error instanceof AuthError
      ? handleAuthError(error)
      : NextResponse.json({ error: "Falha ao consultar a carteira." }, { status: 503, headers });
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await authorize(request);
    const body = await request.json();
    if (typeof body.revision !== "string")
      return NextResponse.json(
        { error: "Revise a carteira antes de aplicar." },
        { status: 400, headers }
      );
    const auditRef = adminDb.collection("admin_migrations").doc(migrationId);
    const result = await adminDb.runTransaction(async (tx) => {
      const audit = await tx.get(auditRef);
      if (audit.exists) return { applied: true, alreadyApplied: true };
      const snapshot = await tx.get(adminDb.collection("companies"));
      if (revision(snapshot.docs) !== body.revision)
        throw new AuthError("A base mudou. Atualize a revisão antes de aplicar.", 409);
      if (snapshot.size > 400) throw new AuthError("Carteira excede o limite desta operação.", 409);
      const ids = new Set(snapshot.docs.map((d) => d.id));
      const missing = APPROVED_PORTFOLIO.flatMap((g) => [...g.records]).filter(
        (id) => id !== "GRUPO_AVP" && !ids.has(id)
      );
      if (missing.length)
        throw new AuthError(
          "Cadastros esperados não encontrados. Nenhuma alteração aplicada.",
          409
        );
      const previous = snapshot.docs.map((d) => ({
        id: d.id,
        active: d.data().active ?? null,
        isDeleted: d.data().isDeleted ?? null,
        portfolioClientId: d.data().portfolioClientId ?? null,
        portfolioClientName: d.data().portfolioClientName ?? null,
        entityType: d.data().entityType ?? null,
      }));
      for (const d of snapshot.docs) {
        const group = portfolioGroup(d.id);
        tx.update(d.ref, {
          active: !!group,
          portfolioClientId: group?.id || FieldValue.delete(),
          portfolioClientName: group?.name || FieldValue.delete(),
          ...(group ? { isDeleted: false } : {}),
          ...(d.id === SANTANDER_RECORD ? { isDeleted: true, entityType: "bank" } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (!ids.has("GRUPO_AVP"))
        tx.create(adminDb.collection("companies").doc("GRUPO_AVP"), {
          name: "Grupo AVP",
          active: true,
          isDeleted: false,
          portfolioClientId: "avp",
          portfolioClientName: "Grupo AVP",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      tx.create(auditRef, {
        actorUid: user.uid,
        appliedAt: FieldValue.serverTimestamp(),
        previous,
        createdRecords: ids.has("GRUPO_AVP") ? [] : ["GRUPO_AVP"],
        approvedGroups: APPROVED_PORTFOLIO.map((g) => g.id),
      });
      return { applied: true, alreadyApplied: false };
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    return error instanceof AuthError
      ? handleAuthError(error)
      : NextResponse.json(
          { error: "Não foi possível aplicar. Nenhuma alteração parcial foi salva." },
          { status: 503, headers }
        );
  }
}
