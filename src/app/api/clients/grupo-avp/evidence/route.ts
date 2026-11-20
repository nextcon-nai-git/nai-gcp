import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import {
  AVP_ASO_MAX_BYTES,
  AvpAsoEvidenceSchema,
  AvpAsoReceiptSchema,
  AvpLinkConfirmationSchema,
  AvpEvidenceSchema,
  type AvpAsoEvidence,
} from "@/lib/avp-evidence";
import { limitedFormData, limitedJson } from "@/lib/http/private-api";
import { z } from "zod/v3";

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
      if (typeof record.fileHash !== "string" || !/^[a-f0-9]{64}$/.test(record.fileHash))
        throw new AuthError("Referência do ASO inválida. Confira o documento de origem.", 409);
      const [bytes] = await getStorage()
        .bucket(firebaseConfig.storageBucket)
        .file(filePath(record.fileHash))
        .download();
      // The Storage read may outlive an account or AVP-scope revocation.
      await access(req);
      if (createHash("sha256").update(bytes).digest("hex") !== record.fileHash)
        throw new AuthError(
          "Integridade do ASO não confirmada. Confira o documento de origem.",
          409
        );
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
// Older imports may use a source ID unrelated to the PDF hash. Keep those indexes intact.
async function reserveReceipt(record: AvpAsoEvidence, uid: string) {
  const ref = collection().doc(record.id);
  const contentHash = createHash("sha256").update(JSON.stringify(record)).digest("hex");
  return adminDb.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (current.exists) {
      const existing = current.data();
      if (existing?.contentHash !== contentHash)
        throw new AuthError(
          "Documento já indexado. Confira o cadastro existente em ASOs recebidos antes de anexar outra via.",
          409
        );
      return existing.uploaded === true;
    }
    const matches = await tx.get(collection().where("fileHash", "==", record.fileHash).limit(1));
    if (!matches.empty)
      throw new AuthError(
        "Este PDF já tem cadastro. Localize o colaborador e use Anexar PDF na linha existente.",
        409
      );
    tx.create(ref, {
      ...record,
      contentHash,
      uploaded: false,
      createdAt: new Date().toISOString(),
      createdBy: uid,
    });
    return false;
  });
}
async function attachPdf(id: string, hash: string, bytes: Buffer, uid: string) {
  const object = getStorage().bucket(firebaseConfig.storageBucket).file(filePath(hash));
  try {
    await object.save(bytes, {
      resumable: false,
      contentType: "application/pdf",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "private, no-store" },
    });
  } catch (e) {
    if (!(e && typeof e === "object" && "code" in e && Number(e.code) === 412)) throw e;
    const [stored] = await object.download();
    if (createHash("sha256").update(stored).digest("hex") !== hash)
      throw new AuthError("O arquivo armazenado diverge do ASO selecionado.", 409);
  }
  // Concurrent attempts can reuse the same object. Preserve the first confirmed receipt.
  const ref = collection().doc(id);
  await adminDb.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data();
    if (current?.kind !== "aso" || current.fileHash !== hash)
      throw new AuthError("O cadastro do ASO mudou. Atualize a consulta.", 409);
    if (!current.uploaded)
      tx.update(ref, { uploaded: true, uploadedAt: new Date().toISOString(), uploadedBy: uid });
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await access(req);
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      if (Number(req.headers.get("content-length") || 0) > 16000000)
        throw badRequest("PDF excede 15 MB.");
      const form = await limitedFormData(req, 16000000);
      const file = form.get("file");
      if (!(file instanceof File) || file.size > AVP_ASO_MAX_BYTES)
        throw badRequest("Selecione um PDF de até 15 MB.");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.subarray(0, 5).toString() !== "%PDF-") throw badRequest("O arquivo não é um PDF.");
      const hash = createHash("sha256").update(bytes).digest("hex");
      const receipt = form.get("receipt");
      let id = form.get("id");
      let uploaded: boolean;
      if (receipt !== null) {
        if (typeof receipt !== "string" || receipt.length > 12000 || id !== null)
          throw badRequest("Dados de recebimento inválidos.");
        let fields;
        try {
          fields = AvpAsoReceiptSchema.parse(JSON.parse(receipt));
        } catch {
          throw badRequest("Confira o empregador, o CNPJ, as datas e a seleção do ASO assinado.");
        }
        const record = AvpAsoEvidenceSchema.safeParse({
          employee: fields.employee,
          company: fields.company,
          companyCnpj: fields.companyCnpj,
          ...(fields.socEmployeeCode && { socEmployeeCode: fields.socEmployeeCode }),
          examType: fields.examType,
          examDate: fields.examDate,
          receivedDate: fields.receivedDate,
          source: fields.source,
          notes: fields.notes,
          review: fields.review,
          kind: "aso",
          id: hash,
          sourceHash: hash,
          fileHash: hash,
          fileName: file.name,
          city: "",
          uf: "",
        });
        if (!record.success) throw badRequest("Confira o nome do arquivo PDF e os dados do ASO.");
        id = hash;
        uploaded = await reserveReceipt(record.data, user.uid);
      } else {
        if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
          throw badRequest("Arquivo inválido.");
        const record = (await collection().doc(id).get()).data();
        if (!record || record.kind !== "aso")
          throw badRequest("Importe o índice do ASO antes de anexar o PDF.");
        if (hash !== record.fileHash)
          throw badRequest("O conteúdo do PDF não corresponde ao ASO selecionado.");
        uploaded = record.uploaded === true;
      }
      if (!uploaded) {
        try {
          await attachPdf(id, hash, bytes, user.uid);
        } catch (error) {
          if (error instanceof AuthError) throw error;
          throw new AuthError(
            "Cadastro localizado. A gravação do PDF não foi confirmada. Atualize a lista e confira o anexo antes de tentar novamente.",
            503
          );
        }
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
      const ids = new Set(records.map((r) => r.id));
      const asoIdsInBatch = new Set(
        records.filter((r) => r.kind === "aso" && r.id === r.fileHash).map((r) => r.id)
      );
      for (const record of records) if (record.kind === "aso") ids.add(record.fileHash);
      const keys = [...ids];
      const snapshots = await tx.getAll(...keys.map((id) => collection().doc(id)));
      const previous = new Map(keys.map((id, index) => [id, snapshots[index]]));
      let added = 0,
        unchanged = 0;
      records.forEach((record) => {
        const contentHash = createHash("sha256").update(JSON.stringify(record)).digest("hex");
        const existing = previous.get(record.id);
        if (existing?.exists) {
          if (existing.data()?.contentHash !== contentHash)
            throw new AuthError(
              "Já existe uma versão diferente desta evidência. Confira o registro antes de alterar.",
              409
            );
          unchanged++;
          return;
        }
        if (record.kind === "aso" && record.id !== record.fileHash) {
          const canonical = previous.get(record.fileHash)?.data();
          if (
            (canonical?.kind === "aso" && canonical.fileHash === record.fileHash) ||
            asoIdsInBatch.has(record.fileHash)
          )
            throw new AuthError(
              "Este PDF já tem cadastro em ASOs recebidos. Confira as vias antes de importar.",
              409
            );
        }
        tx.create(collection().doc(record.id), {
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await access(req);
    const input = AvpLinkConfirmationSchema.safeParse(await limitedJson(req, 4000));
    if (!input.success)
      throw badRequest("Confira o CNPJ e informe a referência que comprova o vínculo.");
    const { id, companyCnpj, reference } = input.data;
    const ref = collection().doc(id);
    await adminDb.runTransaction(async (tx) => {
      const record = (await tx.get(ref)).data();
      if (!record || record.kind !== "aso" || record.uploaded !== true)
        throw badRequest("Anexe e confira o PDF antes de confirmar o vínculo.");
      if (
        record.review === "Recebido" &&
        record.linkConfirmation?.reference === reference &&
        record.companyCnpj === companyCnpj
      )
        return;
      if (record.review !== "Conferir vínculo")
        throw new AuthError(
          "A situação do ASO mudou ou exige uma via retificada. Atualize a consulta.",
          409
        );
      if (record.companyCnpj && record.companyCnpj !== companyCnpj)
        throw new AuthError(
          "O CNPJ diverge do ASO cadastrado. Confira a via retificada antes de prosseguir.",
          409
        );
      tx.update(ref, {
        review: "Recebido",
        companyCnpj,
        linkConfirmation: {
          previousReview: record.review,
          reference,
          uid: user.uid,
          at: new Date().toISOString(),
        },
      });
    });
    return NextResponse.json({ saved: true, id }, { headers });
  } catch (error) {
    return failure(error);
  }
}
