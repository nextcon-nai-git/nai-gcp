import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { createHash, randomBytes } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { extractBearerToken, requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden, badRequest } from "@/lib/auth/errors";
import { grantFor, portalId, type PortalRecord } from "@/lib/clinic-portal/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const MAX = 5 * 1024 * 1024;
type RecordWithDocument = PortalRecord & {
  signedDocument?: { path: string; sha256: string; uploadedAt: string; uploadedBy: string };
};
type ReceivedDocument = NonNullable<RecordWithDocument["signedDocument"]>;
const unconfirmedReceipt =
  "Recebimento não confirmado. Consulte o estado do convite antes de reenviar o documento.";

function requireProfileAccess(profile: Record<string, unknown> | undefined) {
  if (profile?.accessEnabled === false) throw forbidden("Acesso suspenso pelo administrador.");
  if (profile?.role === "SCOPED_PROVIDER")
    throw forbidden("Este perfil possui somente consulta de CNPJs e cards.");
}

function matchesReceipt(record: RecordWithDocument | undefined, expected: ReceivedDocument) {
  const received = record?.signedDocument;
  return (
    received?.path === expected.path &&
    received.sha256 === expected.sha256 &&
    received.uploadedBy === expected.uploadedBy &&
    received.uploadedAt === expected.uploadedAt
  );
}

function fail(error: unknown) {
  return NextResponse.json(
    { error: error instanceof AuthError ? error.message : "Não foi possível acessar o documento." },
    { status: error instanceof AuthError ? error.status : 500, headers }
  );
}
async function identity(request: NextRequest) {
  const token = extractBearerToken(request);
  if (!token) throw new AuthError("Entre com sua conta.");
  let actor;
  try {
    actor = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new AuthError("Sessão inválida.");
  }
  const profile = (await adminDb.collection("users").doc(actor.uid).get()).data();
  requireProfileAccess(profile);
  return actor;
}

async function requireDocumentReader(
  request: NextRequest,
  actor: Parameters<typeof grantFor>[1],
  record: RecordWithDocument
) {
  if (grantFor(record, actor)?.role === "doctor") return;
  const owner = await requireAuth(request);
  if (
    owner.uid !== record.ownerUid ||
    !["SUPER_ADMIN", "ADMIN", "OPERATIONS", "DOCTOR", "HR", "RH"].includes(owner.role)
  )
    throw forbidden();
}

export async function POST(request: NextRequest) {
  if (process.env.CLINIC_PORTAL_ENABLED !== "true")
    return NextResponse.json({ error: "Portal em preparação." }, { status: 503, headers });
  let storedPath = "";
  // Once writes have been staged, a lost acknowledgement cannot prove rollback.
  // Keep that object until its receipt or an operator can establish its outcome.
  let mayBeReferenced = false;
  try {
    const actor = await identity(request);
    const length = Number(request.headers.get("content-length"));
    if (!length || length > MAX + 20000) throw badRequest("Envie um PDF com até 5 MB.");
    const form = await request.formData();
    const parsed = portalId.safeParse(form.get("id"));
    if (!parsed.success || form.get("attestation") !== "true")
      throw badRequest("Confirme a revisão e assinatura do ASO.");
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      file.size < 100 ||
      file.size > MAX
    )
      throw badRequest("Envie um PDF com até 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw badRequest("Arquivo PDF inválido.");
    const ref = adminDb.collection("clinic_portal_private").doc(parsed.data);
    const first = (await ref.get()).data() as RecordWithDocument | undefined;
    if (
      !first ||
      grantFor(first, actor)?.role !== "doctor" ||
      first.state !== "awaiting_signature" ||
      first.signedDocument
    )
      throw forbidden();
    storedPath = `clinic-portal-private/${parsed.data}/${randomBytes(24).toString("hex")}.pdf`;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const object = getStorage().bucket(firebaseConfig.storageBucket).file(storedPath);
    await object.save(bytes, {
      resumable: false,
      contentType: "application/pdf",
      metadata: { cacheControl: "private, no-store" },
    });
    const received: ReceivedDocument = {
      path: storedPath,
      sha256,
      uploadedAt: new Date().toISOString(),
      uploadedBy: actor.uid,
    };
    const profileRef = adminDb.collection("users").doc(actor.uid);
    try {
      await adminDb.runTransaction(async (tx) => {
        const [profile, snapshot] = await Promise.all([tx.get(profileRef), tx.get(ref)]);
        requireProfileAccess(profile.data());
        const current = snapshot.data() as RecordWithDocument | undefined;
        if (
          !current ||
          grantFor(current, actor)?.role !== "doctor" ||
          current.state !== "awaiting_signature" ||
          current.signedDocument
        )
          throw forbidden();
        mayBeReferenced = true;
        tx.update(ref, { signedDocument: received, updatedAt: received.uploadedAt });
        tx.update(adminDb.doc(current.sourcePath), {
          clinicPortalStatus: "signed_document_received",
          updatedAt: received.uploadedAt,
        });
        tx.create(ref.collection("events").doc(), {
          action: "signed_pdf_received",
          uid: actor.uid,
          at: received.uploadedAt,
          sha256,
        });
      });
    } catch (error) {
      if (!mayBeReferenced) throw error;
      // The exact, randomly named receipt below is the only proof of this commit.
      // A missing receipt never authorizes deleting a possibly referenced PDF.
    }
    try {
      await adminDb.runTransaction(async (tx) => {
        const [profile, snapshot] = await Promise.all([tx.get(profileRef), tx.get(ref)]);
        requireProfileAccess(profile.data());
        const current = snapshot.data() as RecordWithDocument | undefined;
        if (!current || grantFor(current, actor)?.role !== "doctor") throw forbidden();
        if (!matchesReceipt(current, received)) throw new AuthError(unconfirmedReceipt, 503);
      });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(unconfirmedReceipt, 503);
    }
    return NextResponse.json(
      { message: "ASO recebido para conferência. A assinatura não foi validada automaticamente." },
      { headers }
    );
  } catch (error) {
    return fail(error);
  } finally {
    if (storedPath && !mayBeReferenced)
      await getStorage()
        .bucket(firebaseConfig.storageBucket)
        .file(storedPath)
        .delete({ ignoreNotFound: true })
        .catch(() => undefined);
  }
}
export async function GET(request: NextRequest) {
  if (process.env.CLINIC_PORTAL_ENABLED !== "true")
    return NextResponse.json({ error: "Portal em preparação." }, { status: 503, headers });
  try {
    const parsed = portalId.safeParse(request.nextUrl.searchParams.get("id"));
    if (!parsed.success) throw badRequest();
    const actor = await identity(request);
    const ref = adminDb.collection("clinic_portal_private").doc(parsed.data);
    const record = (await ref.get()).data() as RecordWithDocument | undefined;
    if (!record?.signedDocument) throw forbidden();
    await requireDocumentReader(request, actor, record);
    const [bytes] = await getStorage()
      .bucket(firebaseConfig.storageBucket)
      .file(record.signedDocument.path)
      .download();
    // The upload hash binds this download to the reviewed, immutable document.
    // This checks integrity only; it does not validate a digital certificate.
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (
      !/^[a-f0-9]{64}$/.test(record.signedDocument.sha256 ?? "") ||
      actualHash !== record.signedDocument.sha256
    ) {
      await ref.collection("events").add({
        action: "signed_pdf_integrity_failed",
        uid: actor.uid,
        at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Integridade do documento não confirmada. Solicite conferência ao responsável." },
        { status: 409, headers }
      );
    }
    const currentActor = await identity(request);
    const current = (await ref.get()).data() as RecordWithDocument | undefined;
    if (!current?.signedDocument) throw forbidden();
    await requireDocumentReader(request, currentActor, current);
    if (!matchesReceipt(current, record.signedDocument))
      throw new AuthError("O documento mudou durante a consulta. Atualize o convite.", 409);
    await ref.collection("events").add({
      action: "signed_pdf_read",
      uid: actor.uid,
      at: new Date().toISOString(),
      sha256: actualHash,
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="ASO-NAI.pdf"',
      },
    });
  } catch (error) {
    return fail(error);
  }
}
