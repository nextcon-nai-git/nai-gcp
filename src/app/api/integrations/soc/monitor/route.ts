import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { socCompanyIds, socConfiguration, SocError } from "@/lib/integrations/soc";
import {
  monitorSocBatch,
  planSocMonitoring,
  validateBatch,
  type BatchInput,
} from "@/lib/integrations/soc-scheduled-batch";
import { recordSocBatchFailure } from "@/lib/integrations/soc-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: NextRequest) {
  const key = process.env.SOC_MONITOR_SECRET;
  if (
    !key ||
    key.length < 32 ||
    !timingSafeEqual(
      createHash("sha256")
        .update(req.headers.get("authorization") || "")
        .digest(),
      createHash("sha256").update(`Bearer ${key}`).digest()
    )
  )
    return reply({ error: "Não autorizado." }, 401);
  if (
    !socCompanyIds().length ||
    Object.values(socConfiguration().resources).some((r) => !r.configured)
  )
    return reply(
      {
        error: "Configure o escopo e as três chaves SOC antes de iniciar.",
        code: "CONFIGURATION_REQUIRED",
      },
      503
    );
  let lock: ReturnType<typeof adminDb.doc> | undefined;
  let auditedBatch: BatchInput | undefined;
  let batchStarted = false;
  const owner = randomUUID();
  try {
    // Bound streamed input before parsing; never accept provider URLs or credentials in the body.
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.length;
          if (size > 2048) {
            await reader.cancel();
            return reply({ error: "Solicitação excessiva." }, 413);
          }
          chunks.push(next.value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    let body;
    try {
      body = size ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : { action: "plan" };
    } catch {
      return reply({ error: "JSON inválido." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply({ error: "Solicitação inválida." }, 400);
    if (body.action === "plan") return reply(await planSocMonitoring());
    if (
      body.action !== "batch" ||
      typeof body.companyId !== "string" ||
      typeof body.start !== "string" ||
      typeof body.end !== "string" ||
      typeof body.offset !== "number" ||
      (body.rosterHash !== undefined && typeof body.rosterHash !== "string")
    )
      return reply({ error: "Informe empresa, período e lote." }, 400);
    const input: BatchInput = {
      companyId: body.companyId,
      start: body.start,
      end: body.end,
      offset: body.offset,
      ...(body.rosterHash ? { rosterHash: body.rosterHash } : {}),
    };
    validateBatch(input);
    auditedBatch = input;
    lock = adminDb.collection("webhook_deliveries").doc(`soc-monitor-company-${input.companyId}`);
    const acquired = await adminDb.runTransaction(async (tx) => {
      const prior = await tx.get(lock!);
      if (Number(prior.data()?.lockedUntil || 0) > Date.now()) return false;
      tx.set(lock!, { lockedUntil: Date.now() + 5 * 60000, owner }, { merge: true });
      return true;
    });
    if (!acquired)
      return reply({ error: "Consulta desta empresa em andamento.", code: "BUSY" }, 429);
    batchStarted = true;
    return reply(await monitorSocBatch(input));
  } catch (error) {
    if (batchStarted && auditedBatch) {
      const code = error instanceof SocError ? error.code : "INTERNAL_ERROR";
      const recorded = await recordSocBatchFailure({
        companyId: auditedBatch.companyId,
        start: auditedBatch.start,
        end: auditedBatch.end,
        offset: auditedBatch.offset,
        code,
      });
      if (!recorded)
        return reply(
          {
            error: "A falha ocorreu, mas não pôde ser registrada no histórico operacional.",
            code: "AUDIT_UNAVAILABLE",
          },
          503
        );
    }
    if (error instanceof SocError)
      return reply({ error: error.message, code: error.code }, error.status);
    return reply({ error: "O lote não foi concluído.", code: "INTERNAL_ERROR" }, 500);
  } finally {
    if (lock) {
      try {
        await adminDb.runTransaction(async (tx) => {
          const snapshot = await tx.get(lock!);
          if (snapshot.data()?.owner === owner) tx.set(lock!, { lockedUntil: 0 }, { merge: true });
        });
      } catch {
        /* A failed release expires naturally; it never grants overlapping access. */
      }
    }
  }
}
