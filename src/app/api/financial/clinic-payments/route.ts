import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import {
  createClinicPaymentDrafts,
  previewClinicPaymentBatches,
} from "@/services/clinic-payment-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const dueDate = request.nextUrl.searchParams.get("dueDate") || undefined;
    return NextResponse.json(await previewClinicPaymentBatches(user, { dueDate }), {
      headers: privateHeaders,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return privateFailure(badRequest("Parâmetros do lote de pagamentos inválidos."));
    return privateFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await limitedJson(request);
    return NextResponse.json(await createClinicPaymentDrafts(user, body), {
      headers: privateHeaders,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return privateFailure(badRequest("Parâmetros do lote de pagamentos inválidos."));
    return privateFailure(error);
  }
}
