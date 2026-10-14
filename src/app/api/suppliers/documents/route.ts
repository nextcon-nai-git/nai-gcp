import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireSupplierAccess } from "@/lib/suppliers/qualification";
import { badRequest } from "@/lib/auth/errors";
import {
  downloadSupplierDocument,
  uploadSupplierDocument,
} from "@/services/supplier-qualification";
import { privateHeaders, privateFailure, limitedBytes } from "@/lib/http/private-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: NextRequest) {
  try {
    const u = await requireAuth(r);
    requireSupplierAccess(u);
    const p = r.nextUrl.searchParams;
    const { bytes, document } = await downloadSupplierDocument(
      u,
      p.get("applicationId") || "",
      p.get("documentId") || ""
    );
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": document.mime,
        "Content-Disposition": `attachment; filename="documento-${document.id}.${document.mime === "application/pdf" ? "pdf" : document.mime === "image/png" ? "png" : "jpg"}"`,
      },
    });
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    const u = await requireAuth(r);
    requireSupplierAccess(u);
    const raw = r.headers.get("x-document-info") || "";
    if (raw.length > 4096) throw badRequest("Metadados muito grandes.");
    let info;
    try {
      info = JSON.parse(decodeURIComponent(raw));
    } catch {
      throw badRequest("Metadados inválidos.");
    }
    return NextResponse.json(
      await uploadSupplierDocument(u, info, await limitedBytes(r, 8 * 1024 * 1024)),
      { headers: privateHeaders }
    );
  } catch (e) {
    return privateFailure(e);
  }
}
