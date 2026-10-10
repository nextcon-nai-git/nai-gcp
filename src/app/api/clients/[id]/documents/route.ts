import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrCompany, isPgrGlobalAdmin } from "@/lib/auth/require-pgr-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { ClientActions } from "@/lib/client-documents";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const pdfPath = (id: string, hash: string) =>
  `client-dossiers/v1/${encodeURIComponent(id)}/${hash}/source.pdf`;
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
    requirePgrCompany(user, id);
    const documents = adminDb.collection("companies").doc(id).collection("sourceDocuments");
    const pdf = request.nextUrl.searchParams.get("pdf");
    if (pdf) {
      if (!/^[a-f0-9]{64}$/.test(pdf)) throw badRequest("Documento inválido.");
      if (!(await documents.doc(pdf).get()).exists)
        throw new AuthError("Documento não encontrado.", 404);
      const [bytes] = await bucket().file(pdfPath(id, pdf)).download();
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
    requirePgrCompany(user, id);
    if (!isPgrGlobalAdmin(user))
      throw forbidden("Somente a administração pode importar documentos e ações.");
    if (Number(request.headers.get("content-length") || "0") > 16 * 1024 * 1024)
      throw badRequest("Limite de upload excedido.");
    const companyRef = adminDb.collection("companies").doc(id);
    const company = await companyRef.get();
    if (!company.exists) throw new AuthError("Cliente não encontrado.", 404);
    const form = await request.formData();
    const file = form.get("source");
    if (!(file instanceof File) || file.size > 15 * 1024 * 1024)
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
    if (previous.exists)
      return NextResponse.json(
        { alreadySaved: true, taskCount: previous.data()?.taskCount || 0 },
        { headers }
      );
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
    }
    const result = await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(sourceRef);
      if (existing.exists)
        return { alreadySaved: true, taskCount: existing.data()?.taskCount || 0 };
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
