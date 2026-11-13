import { limitedFormData, privateHeaders } from "@/lib/http/private-api";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  sourceBucket as bucket,
  pdfPath,
  verifiedPdf,
  maxPdfBytes,
} from "@/services/client-source-pdf";
import { adminDb } from "@/lib/firebase-admin";

import { requireAuth } from "@/lib/auth/require-auth";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requirePgrCompany, isPgrGlobalAdmin } from "@/lib/auth/require-pgr-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { ClientActions } from "@/lib/client-documents";
import { BRITANIA_ANCHOR } from "@/lib/britania-group";
import { isBritaniaFapAdmin } from "@/lib/auth/britania-fap-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = privateHeaders;

type Context = { params: Promise<{ id: string }> };
function requireDocumentAccess(user: AuthContext, id: string, write = false) {
  // Consolidated HR sources require internal access even for a site-scoped admin.
  if (id === BRITANIA_ANCHOR) {
    if (!isBritaniaFapAdmin(user))
      throw forbidden("O acervo consolidado exige administração interna.");
  } else requirePgrCompany(user, id);
  if (write && !(id === BRITANIA_ANCHOR ? isBritaniaFapAdmin(user) : isPgrGlobalAdmin(user)))
    throw forbidden("Somente a administração pode importar documentos e ações.");
}
function requireDocumentCompany(data: Record<string, unknown> | undefined, id: string) {
  if (data?.companyId !== id)
    throw new AuthError("O vínculo do documento exige revisão administrativa.", 409);
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
    requireDocumentAccess(user, id);
    const documents = adminDb.collection("companies").doc(id).collection("sourceDocuments");
    const pdf = request.nextUrl.searchParams.get("pdf");
    if (pdf) {
      if (!/^[a-f0-9]{64}$/.test(pdf)) throw badRequest("Documento inválido.");
      const document = await documents.doc(pdf).get();
      if (!document.exists) throw new AuthError("Documento não encontrado.", 404);
      requireDocumentCompany(document.data(), id);
      const bytes = await verifiedPdf(id, pdf, request.signal);
      requireDocumentAccess(await requireAuth(request), id);
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
    requireDocumentAccess(await requireAuth(request), id);
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
    requireDocumentAccess(user, id, true);
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
    requireDocumentAccess(await requireAuth(request), id, true);
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
