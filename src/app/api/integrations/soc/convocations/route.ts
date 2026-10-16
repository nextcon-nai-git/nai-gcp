import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { requireSocAccess } from "@/lib/integrations/soc";
import {
  CONVOCATION_MAX_BYTES,
  parseConvocations,
  summarizeConvocations,
  type ConvocationRow,
} from "@/lib/integrations/soc-convocations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const root = () => adminDb.collection("webhook_deliveries").doc("soc-convocations-avp");
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
const fail = (e: unknown) =>
  e instanceof AuthError
    ? reply({ error: e.message }, e.status)
    : reply({ error: "Não foi possível acessar a base de convocações." }, 500);
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireSocAccess(user);
    const head = await root().get();
    if (!head.exists) return reply({ snapshot: null });
    const metadata = head.data()!;
    const chunks = await root()
      .collection("imports")
      .doc(metadata.hash)
      .collection("chunks")
      .orderBy("index")
      .get();
    const rows = chunks.docs.flatMap((doc) => doc.data().rows as ConvocationRow[]);
    return reply({ snapshot: { ...metadata, rows } });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireSocAccess(user);
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role))
      throw new AuthError("Somente administradores internos podem importar esta base.", 403);
    if (!req.headers.get("content-type")?.startsWith("text/csv"))
      throw new AuthError("Envie um CSV.", 415);
    const reader = req.body?.getReader();
    if (!reader) throw new AuthError("Arquivo vazio.", 400);
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > CONVOCATION_MAX_BYTES) {
          await reader.cancel();
          throw new AuthError("CSV acima de 4 MB.", 413);
        }
        parts.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(parts);
    let rows: ConvocationRow[];
    try {
      rows = parseConvocations(bytes.toString("utf8"));
    } catch (e) {
      throw new AuthError(e instanceof Error ? e.message : "CSV inválido.", 400);
    }
    const hash = createHash("sha256").update(bytes).digest("hex");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date()
    );
    const metadata = {
      hash,
      importedAt: new Date().toISOString(),
      importedBy: user.uid,
      group: "GRUPO_AVP",
      source: "CSV SOC · Convocação de Exames",
      summary: summarizeConvocations(rows, today),
    };
    // Immutable import chunks are committed atomically, then the active pointer is updated.
    const batch = adminDb.batch();
    for (let i = 0; i < rows.length; i += 100)
      batch.set(
        root()
          .collection("imports")
          .doc(hash)
          .collection("chunks")
          .doc(String(i / 100).padStart(4, "0")),
        { index: i / 100, rows: rows.slice(i, i + 100) }
      );
    batch.set(root().collection("imports").doc(hash), metadata);
    await batch.commit();
    await root().set(metadata);
    return reply({ imported: true, summary: metadata.summary, importedAt: metadata.importedAt });
  } catch (e) {
    return fail(e);
  }
}
