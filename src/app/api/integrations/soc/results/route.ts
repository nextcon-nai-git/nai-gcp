import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { requireSocAccess } from "@/lib/integrations/soc";
import {
  SOC_EXAM_RESULTS_MAX_BYTES,
  hashSocExamResults,
  parseSocExamResults,
  summarizeSocExamResults,
} from "@/lib/integrations/soc-exam-results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const root = () => adminDb.collection("webhook_deliveries").doc("soc-exam-results");
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });

async function readLimitedJson(req: NextRequest) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new AuthError("Envie JSON.", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new AuthError("Arquivo vazio.", 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > SOC_EXAM_RESULTS_MAX_BYTES) {
        await reader.cancel();
        throw new AuthError("Lote SOC acima de 2 MB.", 413);
      }
      parts.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new AuthError("JSON inválido.", 400);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireSocAccess(user);
    const snapshot = await root().get();
    if (!snapshot.exists) return reply({ snapshot: null });
    const data = snapshot.data()!;
    return reply({
      snapshot: {
        importId: data.importId,
        importedAt: data.importedAt,
        importedBy: data.importedBy,
        source: data.source,
        summary: data.summary,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return reply({ error: e.message }, e.status);
    return reply({ error: "Não foi possível acessar os resultados SOC importados." }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireSocAccess(user);
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role))
      throw new AuthError("Somente administradores internos podem importar esta base.", 403);

    const input = await readLimitedJson(req);
    let parsed;
    try {
      parsed = parseSocExamResults(input);
    } catch (e) {
      throw new AuthError(e instanceof Error ? e.message : "Lote SOC inválido.", 400);
    }

    const hash = hashSocExamResults(parsed.rows);
    const active = await root().get();
    const activeData = active.data();
    if (activeData?.hash === hash)
      return reply({
        imported: false,
        duplicate: true,
        summary: activeData?.summary,
        importedAt: activeData?.importedAt,
      });
    const expectedImport = activeData?.importId || activeData?.hash || null;

    const metadata = {
      importId: randomUUID(),
      hash,
      importedAt: new Date().toISOString(),
      importedBy: user.uid,
      source: "SOC · Resultados de exames",
      identityScope: "SEM_IDENTIFICADOR_COLABORADOR",
      summary: summarizeSocExamResults(parsed.rows, parsed.sourceRows, parsed.duplicates),
    };

    const resultsRef = root();
    const importRef = resultsRef.collection("imports").doc(metadata.importId);
    await adminDb.runTransaction(async (transaction) => {
      const latest = await transaction.get(resultsRef);
      const current = latest.data();
      if ((current?.importId || current?.hash || null) !== expectedImport)
        throw new AuthError(
          "Outra importação foi publicada durante o envio. Recarregue e confira a base antes de tentar novamente.",
          409
        );

      for (let i = 0; i < parsed.rows.length; i += 100) {
        const index = i / 100;
        const chunk = importRef.collection("chunks").doc(String(index).padStart(4, "0"));
        transaction.set(chunk, { index, rows: parsed.rows.slice(i, i + 100) });
      }
      transaction.set(importRef, metadata);
      transaction.set(resultsRef, metadata);
    });

    return reply({ imported: true, summary: metadata.summary, importedAt: metadata.importedAt });
  } catch (e) {
    if (e instanceof AuthError) return reply({ error: e.message }, e.status);
    return reply({ error: "Não foi possível importar os resultados SOC." }, 500);
  }
}
