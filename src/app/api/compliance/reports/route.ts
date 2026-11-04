import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppCheck } from "firebase-admin/app-check";
import { z } from "zod/v3";
import { firebaseConfig } from "@/firebase/config";
import { AuthError, forbidden } from "@/lib/auth/errors";
import { limitedJson } from "@/lib/http/private-api";
import {
  complianceBadRequest,
  createComplianceReport,
} from "@/services/compliance-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const source = forwarded || direct;
  return source ? createHash("sha256").update(source).digest("hex").slice(0, 24) : null;
}

function rateLimit(request: NextRequest) {
  const key = clientKey(request);
  if (!key) return;
  const now = Date.now();
  if (buckets.size > 5000)
    for (const [entry, value] of buckets) if (value.resetAt <= now) buckets.delete(entry);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= MAX_REPORTS)
    throw new AuthError(
      "Muitas tentativas de envio. Aguarde alguns minutos antes de tentar novamente.",
      429
    );
  bucket.count++;
}

async function verifyAppCheck(request: NextRequest) {
  const token = request.headers.get("X-Firebase-AppCheck");
  if (!token) {
    if (process.env.COMPLIANCE_APP_CHECK_ENFORCE === "true")
      throw forbidden("Atualize a página para validar o acesso seguro ao canal.");
    return;
  }
  try {
    const decoded = await getAppCheck().verifyToken(token);
    if (decoded.appId !== firebaseConfig.appId) throw new Error("App não autorizado");
  } catch {
    throw forbidden("Não foi possível validar o aplicativo. Atualize a página e tente novamente.");
  }
}

function failure(error: unknown) {
  if (error instanceof z.ZodError) error = complianceBadRequest(error);
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "Não foi possível registrar o relato. Tente novamente.",
    },
    {
      status: error instanceof AuthError ? error.status : 503,
      headers,
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    rateLimit(request);
    await verifyAppCheck(request);
    const input = await limitedJson(request, 16 * 1024);
    const protocol = await createComplianceReport(input);
    return NextResponse.json({ protocol }, { status: 201, headers });
  } catch (error) {
    return failure(error);
  }
}
