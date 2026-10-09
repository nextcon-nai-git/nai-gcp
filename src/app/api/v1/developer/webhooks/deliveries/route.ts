import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
  ApiGuardError,
} from "@/lib/developer-api-guard";
import { replayWebhookDelivery } from "@/services/webhooks/webhook-dispatcher";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const id = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !value.includes("/"));
const statusSchema = z.enum(["PENDING", "DELIVERED", "FAILED", "RETRYING", "DEAD_LETTER"]);
export async function GET(req: NextRequest) {
  try {
    const key = await requireApiKey(req);
    requireScope(key, "webhooks:manage");
    const clientId = req.nextUrl.searchParams.get("clientId") || key.clientId;
    requireClient(key, clientId);
    let query = adminDb.collection("webhook_deliveries").where("clientId", "==", clientId);
    const status = req.nextUrl.searchParams.get("status");
    if (status) {
      if (!statusSchema.safeParse(status).success) throw new ApiGuardError("Status inválido.", 400);
      query = query.where("status", "==", status);
    }
    const webhookId = req.nextUrl.searchParams.get("webhookId");
    if (webhookId) {
      if (!id.safeParse(webhookId).success) throw new ApiGuardError("ID do webhook inválido.", 400);
      query = query.where("webhookId", "==", webhookId);
    }
    const snapshot = await query.orderBy("createdAt", "desc").limit(50).get();
    return NextResponse.json(
      { deliveries: snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) },
      { headers }
    );
  } catch (error) {
    return handleApiGuardError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const key = await requireApiKey(req);
    requireScope(key, "webhooks:manage");
    const parsed = z.object({ deliveryId: id }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiGuardError("ID da entrega inválido.", 400);
    return NextResponse.json(await replayWebhookDelivery(parsed.data.deliveryId, key), { headers });
  } catch (error) {
    return handleApiGuardError(error);
  }
}
