import { limitedFormData, privateHeaders } from "@/lib/http/private-api";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrCompany, isPgrGlobalAdmin } from "@/lib/auth/require-pgr-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { ClientActions } from "@/lib/client-documents";
import { BRITANIA_ANCHOR } from "@/lib/britania-group";
import { isBritaniaFapAdmin } from "@/lib/auth/britania-fap-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = privateHeaders;
const maxPdfBytes = 15 * 1024 * 1024;
type Context = { params: Promise<{ id: string }> };
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const pdfPath = (id: string, hash: string) =>
  `client-dossiers/v1/${encodeURIComponent(id)}/${hash}/source.pdf`;
function requireDocumentCompany(data: Record<string, unknown> | undefined, id: string) {
  if (data?.companyId !== id)
    throw new AuthError("O vínculo do documento exige revisão administrativa.", 409);
}
async function verifiedPdf(id: string, hash: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error("Leitura de documento cancelada.");
  // Request a bounded range, but also enforce the cap locally: Storage may
  // ignore Range when transcoding an object with unexpected encoding metadata.
  const stream = bucket().file(pdfPath(id, hash)).createReadStream({
    start: 0,
    end: maxPdfBytes,
    validation: false,
    decompress: false,
  });
  const abort = () => stream.destroy(new Error("Leitura de documento cancelada."));
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    if (signal.aborted) abort();
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxPdfBytes)
        throw new AuthError("O PDF armazenado excede o limite permitido.", 409);
      chunks.push(bytes);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    stream.destroy();
  }
  const bytes = Buffer.concat(chunks, size);
  if (
    bytes.subarray(0, 5).toString() !== "%PDF-" ||
    createHash("sha256").update(bytes).digest("hex") !== hash
  )
    throw new AuthError(
      "A integridade do PDF não foi confirmada. Revise o documento original.",
      409
    );
  return bytes;
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível concluir a operação. Tente novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    // This archive contains the consolidated group's HR sources. Site-only
    // grants cannot expose other establishments through the original PDFs.
    if (id === BRITANIA_ANCHOR) {
      if (!isBritaniaFapAdmin(user))
        throw forbidden("O acervo consolidado exige administração interna.");
    } else requirePgrCompany(user, id);
    const documents = adminDb.collection("companies").doc(id).collection("sourceDocuments");
    const pdf = request.nextUrl.searchParams.get("pdf");
    if (pdf) {
      if (!/^[a-f0-9]{64}$/.test(pdf)) throw badRequest("Documento inválido.");
      const document = await documents.doc(pdf).get();
      if (!document.exists) throw new AuthError("Documento não encontrado.", 404);
      requireDocumentCompany(document.data(), id);
      const bytes = await verifiedPdf(id, pdf, request.signal);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline; filename=documento.pdf",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const snapshot = await documents.orderBy("createdAt", "desc").limit(100).get();
    return NextResponse.json(
      { documents: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) },
      { headers }
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    if (id === BRITANIA_ANCHOR) {
      if (!isBritaniaFapAdmin(user))
        throw forbidden("O acervo consolidado exige administração interna.");
    } else requirePgrCompany(user, id);
    if (!(id === BRITANIA_ANCHOR ? isBritaniaFapAdmin(user) : isPgrGlobalAdmin(user)))
      throw forbidden("Somente a administração pode importar documentos e ações.");
    if (Number(request.headers.get("content-length") || "0") > 16 * 1024 * 1024)
      throw badRequest("Limite de upload excedido.");
    const companyRef = adminDb.collection("companies").doc(id);
    const company = await companyRef.get();
    if (!company.exists) throw new AuthError("Cliente não encontrado.", 404);
    const form = await limitedFormData(request, 16 * 1024 * 1024);
    const file = form.get("source");
    if (!(file instanceof File) || file.size > maxPdfBytes)
      throw badRequest("Selecione um PDF de até 15 MB.");
    const raw = form.get("actions");
    if (typeof raw !== "string" || raw.length > 180000) throw badRequest("Plano de ação inválido.");
    let actions;
    try {
      actions = ClientActions.parse(JSON.parse(raw));
    } catch {
      throw badRequest("Confira os títulos e orientações das ações (até 50 cards).");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw badRequest("Arquivo PDF inválido.");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const sourceRef = companyRef.collection("sourceDocuments").doc(hash);
    const previous = await sourceRef.get();
    if (previous.exists) requireDocumentCompany(previous.data(), id);
    // An identical reimport may restore a missing original without recreating
    // tasks or resetting their progress. Existing objects are never overwritten.
    try {
      await bucket()
        .file(pdfPath(id, hash))
        .save(bytes, {
          resumable: false,
          contentType: "application/pdf",
          preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { cacheControl: "private, no-store" },
        });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && Number(error.code) === 412))
        throw error;
      await verifiedPdf(id, hash, request.signal);
    }
    const result = await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(sourceRef);
      if (existing.exists) {
        requireDocumentCompany(existing.data(), id);
        return { alreadySaved: true, taskCount: existing.data()?.taskCount || 0 };
      }
      const now = new Date().toISOString();
      tx.create(sourceRef, {
        name: file.name.slice(0, 240),
        createdAt: now,
        createdBy: user.uid,
        taskCount: actions.length,
        companyId: id,
      });
      actions.forEach((action, index) => {
        tx.create(companyRef.collection("tasks").doc(`document_${hash}_${index}`), {
          title: action.title,
          companyId: id,
          companyName: company.data()?.name || "Unidade",
          type: "vistoria",
          status: "todo",
          priority: "medium",
          dueDate: "",
          progress: 0,
          sourceDocumentId: hash,
          sourceDocumentName: file.name.slice(0, 240),
          lastComment: `Fonte: ${file.name}\n${action.instructions}\nPrazo e responsável nominal: confirmar com a gestão do contrato.`,
          checklist: [
            {
              id: "review",
              text: "Conferir requisito, prazo aplicável e responsável no documento original",
              checked: false,
              mandatory: true,
            },
            {
              id: "evidence",
              text: "Registrar evidência de execução e validação pela gestão do contrato",
              checked: false,
              mandatory: true,
            },
          ],
          createdAt: now,
          createdBy: user.uid,
          updatedAt: now,
        });
      });
      return { alreadySaved: false, taskCount: actions.length };
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
