import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden } from "@/lib/auth/errors";
import { fapDossierSchema } from "@/lib/britania-dossier";
import { isBritaniaFapAdmin } from "@/lib/auth/britania-fap-access";
import { BRITANIA_ANCHOR, BRITANIA_GROUP_NAME, isBritaniaSite } from "@/lib/britania-group";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const ref = () =>
  adminDb
    // This existing private root is excluded from both Firestore client
    // fallbacks, including internal staff. Only authenticated server APIs read it.
    .collection("clinic_portal_private")
    .doc("britania_group_fap_2027");
async function authorize(request: NextRequest) {
  const user = await requireAuth(request);
  if (!isBritaniaFapAdmin(user)) throw forbidden();
  return user;
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível consultar ou salvar o dossiê. Tente novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function GET(request: NextRequest) {
  try {
    await authorize(request);
    const saved = await ref().get();
    return NextResponse.json({ dossier: saved.exists ? saved.data()?.dossier : null }, { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await authorize(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 850000)
      throw new AuthError("Dossiê excede o limite. Divida a revisão em lotes.", 413);
    let parsed;
    try {
      parsed = fapDossierSchema.safeParse(JSON.parse(raw));
    } catch {
      throw new AuthError("Arquivo de revisão inválido.", 400);
    }
    if (!parsed.success)
      throw new AuthError("Dossiê inválido; confira o pacote e o controle.", 400);
    const dossier = parsed.data;
    const contentHash = createHash("sha256").update(JSON.stringify(dossier)).digest("hex");
    const result = await adminDb.runTransaction(async (tx) => {
      const target = ref();
      const current = await tx.get(target);
      if (current.exists) {
        if (current.data()?.contentHash === contentHash) return { alreadyImported: true };
        throw new AuthError(
          "Já existe um dossiê diferente. Preserve a versão atual e revise a substituição com a administração.",
          409
        );
      }
      const companies = await tx.get(adminDb.collection("companies"));
      if (companies.size > 1000)
        throw new AuthError("Diretório excede o limite de conciliação.", 409);
      const existing = companies.docs;
      const createdSites: string[] = [];
      for (const cnpj of new Set(dossier.cases.map((c) => c.sourceCnpj))) {
        const matching = existing.filter(
          (d) => String(d.data().cnpj || d.id).replace(/\D/g, "") === cnpj
        );
        if (matching.length > 1)
          throw new AuthError(
            "CNPJ com mais de um cadastro. Concilie as sedes antes de importar.",
            409
          );
        if (!matching.length) {
          // Source establishes a historical site, not its current commercial status.
          if (existing.some((d) => d.id === cnpj))
            throw new AuthError("Identificador de sede em conflito.", 409);
          tx.create(adminDb.collection("companies").doc(cnpj), {
            name: `${BRITANIA_GROUP_NAME} - Sede ${cnpj}`,
            cnpj,
            active: false,
            portfolioClientId: "britania",
            portfolioClientName: BRITANIA_GROUP_NAME,
            entityType: "branch",
            sourceStatus: "historical_pending_reconciliation",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          createdSites.push(cnpj);
        }
      }
      for (const company of existing.filter((d) =>
        isBritaniaSite({ id: d.id, cnpj: d.data().cnpj })
      )) {
        tx.update(company.ref, {
          portfolioClientId: "britania",
          portfolioClientName: BRITANIA_GROUP_NAME,
          entityType: "branch",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.create(target, {
        companyId: BRITANIA_ANCHOR,
        type: "fap_group_dossier",
        dossier,
        contentHash,
        importedBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(adminDb.collection("audit_logs").doc(), {
        action: "britania_fap_import",
        actorUid: user.uid,
        companyId: BRITANIA_ANCHOR,
        cases: dossier.cases.length,
        createdSites,
        contentHash,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { alreadyImported: false };
    });
    return NextResponse.json({ ...result, cases: dossier.cases.length }, { headers });
  } catch (error) {
    return failure(error);
  }
}
