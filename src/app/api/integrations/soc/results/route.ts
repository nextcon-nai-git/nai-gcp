import { FieldPath, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { requireSocAccess } from "@/lib/integrations/soc";
import {
  SOC_EXAM_RESULTS_MAX_BYTES,
  type SocExamResultRow,
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

const historicalReplay = () =>
  new AuthError("Este lote já consta no histórico SOC. A base ativa foi preservada.", 409);

// Older imports used UUIDs and an order-dependent hash. Read their immutable
// chunks only for matching row counts. New content-addressed IDs are outside this range.
async function matchLegacyImport(hash: string, count: number, activeId: string | null) {
  const imports = root().collection("imports");
  const candidates = await imports.where(FieldPath.documentId(), "<", "v2-").select("summary.uniqueRows", "hash").get();
  let historical = false;
  for (const doc of candidates.docs) {
    if (doc.get("summary.uniqueRows") !== count) continue;
    const chunks = await doc.ref.collection("chunks").get();
    const rows: SocExamResultRow[] = chunks.docs.flatMap((chunk) => chunk.get("rows"));
    if (rows.length !== count) throw new AuthError("Lote histórico SOC incompleto. Confira a base antes de importar.", 409);
    if (hashSocExamResults(rows) !== hash) continue;
    if (doc.id === activeId || doc.get("hash") === activeId) return "active";
    historical = true;
  }
  return historical ? "historical" : null;
}

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
    const resultsRef = root();
    const importId = `v2-${hash}`;
    const importRef = resultsRef.collection("imports").doc(importId);
    const activeData = (await resultsRef.get()).data();
    const expectedImport = activeData?.importId || activeData?.hash || null;
    const duplicate = (data: DocumentData) => ({
      imported: false,
      duplicate: true,
      summary: data.summary,
      importedAt: data.importedAt,
    });
    if (activeData?.importId === importId) return reply(duplicate(activeData));
    const legacy = await matchLegacyImport(hash, parsed.rows.length, expectedImport);
    if (legacy === "active" && activeData) return reply(duplicate(activeData));
    if (legacy === "historical") throw historicalReplay();

    const metadata = {
      importId,
      hash,
      importedAt: new Date().toISOString(),
      importedBy: user.uid,
      source: "SOC · Resultados de exames",
      identityScope: "SEM_IDENTIFICADOR_COLABORADOR",
      summary: summarizeSocExamResults(parsed.rows, parsed.sourceRows, parsed.duplicates),
    };

    const result = await adminDb.runTransaction(async (transaction) => {
      const latest = await transaction.get(resultsRef);
      const current = latest.data();
      if (current?.importId === importId) return duplicate(current);
      if ((current?.importId || current?.hash || null) !== expectedImport)
        throw new AuthError(
          "Outra importação foi publicada durante o envio. Recarregue e confira a base antes de tentar novamente.",
          409
        );

      if ((await transaction.get(importRef)).exists) throw historicalReplay();
      for (let i = 0; i < parsed.rows.length; i += 100) {
        const index = i / 100;
        const chunk = importRef.collection("chunks").doc(String(index).padStart(4, "0"));
        transaction.set(chunk, { index, rows: parsed.rows.slice(i, i + 100) });
      }
      transaction.set(importRef, metadata);
      transaction.set(resultsRef, metadata);
      return { imported: true, summary: metadata.summary, importedAt: metadata.importedAt };
    });

    return reply(result);
  } catch (e) {
    if (e instanceof AuthError) return reply({ error: e.message }, e.status);
    return reply({ error: "Não foi possível importar os resultados SOC." }, 500);
  }
}
