import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { AvpEvidenceSchema } from "@/lib/avp-evidence";
import { limitedFormData, limitedJson } from "@/lib/http/private-api";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Authorization",
};
const collection = () =>
  adminDb.collection("webhook_deliveries").doc("grupo-avp-evidence").collection("records");
const filePath = (hash: string) => `avp-evidence/v1/${hash}.pdf`;
async function access(req: NextRequest) {
  const user = await requireAuth(req);
  requireAvpAccess(user);
  if (!canAccessAvpEvidence(user))
    throw forbidden(
      "Evidências financeiras e ASOs são restritos à equipe operacional interna autorizada."
    );
  return user;
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível salvar ou consultar as evidências.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function GET(req: NextRequest) {
  try {
    await access(req);
    const id = req.nextUrl.searchParams.get("document");
    if (id) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw badRequest("Documento inválido.");
      const record = (await collection().doc(id).get()).data();
      if (!record || record.kind !== "aso" || !record.uploaded)
        throw new AuthError("ASO ainda não anexado.", 404);
      const [bytes] = await getStorage()
        .bucket(firebaseConfig.storageBucket)
        .file(filePath(record.fileHash))
        .download();
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline; filename=aso.pdf",
        },
      });
    }
    const cursor = req.nextUrl.searchParams.get("cursor");
    if (cursor !== null && !/^[a-f0-9]{64}$/.test(cursor)) throw badRequest("Cursor inválido.");
    let query = collection().orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(cursor);
    const docs = await query.limit(501).get();
    const page = docs.docs.slice(0, 500);
    return NextResponse.json(
      {
        records: page.map((d) => ({ ...d.data(), id: d.id })),
        nextCursor: docs.size > 500 ? page.at(-1)!.id : null,
      },
      { headers }
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await access(req);
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      if (Number(req.headers.get("content-length") || 0) > 16000000)
        throw badRequest("PDF excede 15 MB.");
      const form = await limitedFormData(req, 16000000);
      const file = form.get("file");
      const id = form.get("id");
      if (
        !(file instanceof File) ||
        file.size > 15000000 ||
        typeof id !== "string" ||
        !/^[a-f0-9]{64}$/.test(id)
      )
        throw badRequest("Arquivo inválido.");
      const ref = collection().doc(id);
      const record = (await ref.get()).data();
      if (!record || record.kind !== "aso")
        throw badRequest("Importe o índice do ASO antes de anexar o PDF.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (bytes.subarray(0, 5).toString() !== "%PDF-" || hash !== record.fileHash)
        throw badRequest("O conteúdo do PDF não corresponde ao ASO selecionado.");
      if (!record.uploaded) {
        try {
          await getStorage()
            .bucket(firebaseConfig.storageBucket)
            .file(filePath(hash))
            .save(bytes, {
              resumable: false,
              contentType: "application/pdf",
              preconditionOpts: { ifGenerationMatch: 0 },
              metadata: { cacheControl: "private, no-store" },
            });
        } catch (e) {
          if (!(e && typeof e === "object" && "code" in e && Number(e.code) === 412)) throw e;
        }
        await ref.update({
          uploaded: true,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.uid,
        });
      }
      return NextResponse.json({ saved: true, id }, { headers });
    }
    const payload = await limitedJson(req, 500000);
    let records;
    try {
      records = z.array(AvpEvidenceSchema).min(1).max(100).parse(payload.records);
    } catch {
      throw badRequest("Confira o índice: até 100 registros válidos por lote.");
    }
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw badRequest("IDs repetidos no lote.");
    const result = await adminDb.runTransaction(async (tx) => {
      const refs = records.map((r) => collection().doc(r.id));
      const previous = await tx.getAll(...refs);
      let added = 0,
        unchanged = 0;
      records.forEach((record, i) => {
        const contentHash = createHash("sha256").update(JSON.stringify(record)).digest("hex");
        if (previous[i].exists) {
          if (previous[i].data()?.contentHash !== contentHash)
            throw new AuthError(
              "Já existe uma versão diferente desta evidência. Confira o registro antes de alterar.",
              409
            );
          unchanged++;
          return;
        }
        tx.create(refs[i], {
          ...record,
          contentHash,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          uploaded: false,
        });
        added++;
      });
      return { added, unchanged };
    });
    return NextResponse.json({ saved: true, ...result }, { headers });
  } catch (e) {
    return failure(e);
  }
}
