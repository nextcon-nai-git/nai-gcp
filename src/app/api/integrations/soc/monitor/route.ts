import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { socCompanyIds, SocError } from "@/lib/integrations/soc";
import { monitoredSocRead } from "@/lib/integrations/soc-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: NextRequest) {
  const key = process.env.SOC_MONITOR_SECRET;
  const provided = req.headers.get("authorization") || "";
  if (
    !key ||
    key.length < 32 ||
    !timingSafeEqual(
      createHash("sha256").update(provided).digest(),
      createHash("sha256").update(`Bearer ${key}`).digest()
    )
  )
    return reply({ error: "Não autorizado." }, 401);
  const companies = socCompanyIds();
  if (!companies.length) return reply({ error: "Escopo SOC não configurado." }, 503);
  // Keep this endpoint within its 180s runtime. A larger manual scope must not
  // silently turn one scheduled request into thousands of sequential reads.
  if (companies.length > 5)
    return reply(
      {
        error:
          "A carteira excede 5 empresas. O monitoramento em lote precisa ser configurado antes da execução; nenhuma empresa foi consultada.",
      },
      503
    );
  const lock = adminDb.collection("webhook_deliveries").doc("soc-monitor");
  try {
    const acquired = await adminDb.runTransaction(async (tx) => {
      const prior = await tx.get(lock);
      if (Number(prior.data()?.lockedUntil || 0) > Date.now()) return false;
      tx.set(lock, { lockedUntil: Date.now() + 10 * 60000 }, { merge: true });
      return true;
    });
    if (!acquired)
      return reply(
        { error: "Monitoramento já executado ou em andamento. Aguarde 10 minutos." },
        429
      );
    const results = [];
    for (const companyId of companies) {
      try {
        const { summary, recorded } = await monitoredSocRead(
          "employees",
          { companyId },
          "schedule"
        );
        results.push({
          companyId,
          status: recorded ? "success" : "error",
          code: recorded ? summary.code : "AUDIT_UNAVAILABLE",
          records: summary.records,
          needsReview: summary.needsReview,
        });
      } catch (error) {
        results.push({
          companyId,
          status: "error",
          code: error instanceof SocError ? error.code : "INTERNAL_ERROR",
        });
      }
    }
    return reply(
      { results, checkedAt: new Date().toISOString() },
      results.some((r) => r.status === "error") ? 502 : 200
    );
  } catch {
    return reply({ error: "Não foi possível registrar o monitoramento." }, 500);
  }
}
