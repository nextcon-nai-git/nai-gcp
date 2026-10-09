import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
  ApiGuardError,
} from "@/lib/developer-api-guard";
import { validateWebhookTargetUrl } from "@/lib/webhook-security-guard";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const id = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !value.includes("/"));
const input = z.object({
  clientId: id.optional(),
  url: z.string().max(2048),
  events: z
    .array(
      z.enum([
        "employee.clearance_changed",
        "aso.expired",
        "training.expired",
        "certificate.fraud_detected",
        "*",
      ])
    )
    .min(1)
    .max(5),
});
export async function GET(req: NextRequest) {
  try {
    const key = await requireApiKey(req);
    requireScope(key, "webhooks:manage");
    const company = id.safeParse(req.nextUrl.searchParams.get("clientId") || key.clientId);
    if (!company.success) throw new ApiGuardError("Empresa inválida.", 400);
    requireClient(key, company.data);
    const snapshot = await adminDb
      .collection("webhooks")
      .where("clientId", "==", company.data)
      .where("active", "==", true)
      .limit(501)
      .get();
    if (snapshot.size > 500)
      throw new ApiGuardError("Limite de 500 webhooks por consulta excedido.", 422);
    const webhooks = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        clientId: data.clientId,
        url: data.url,
        events: data.events,
        active: data.active,
        createdAt: data.createdAt,
        secretPrefix: `${(data.secret || "").slice(0, 10)}...`,
      };
    });
    return NextResponse.json({ webhooks }, { headers });
  } catch (error) {
    return handleApiGuardError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const key = await requireApiKey(req);
    requireScope(key, "webhooks:manage");
    const parsed = input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiGuardError("Informe empresa, URL e eventos válidos.", 400);
    const { url, events } = parsed.data;
    const clientId = parsed.data.clientId || key.clientId;
    requireClient(key, clientId);
    const validation = await validateWebhookTargetUrl(url);
    if (!validation.valid) throw new ApiGuardError(validation.error || "Destino inválido.", 400);
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const payload = {
      clientId,
      url: validation.normalizedUrl!,
      secret,
      events: [...new Set(events)],
      active: true,
      createdAt: new Date().toISOString(),
      serverTimestamp: FieldValue.serverTimestamp(),
    };
    const ref = await adminDb.collection("webhooks").add(payload);
    return NextResponse.json(
      {
        id: ref.id,
        clientId,
        url: payload.url,
        secret,
        events: payload.events,
        createdAt: payload.createdAt,
        message: "Webhook cadastrado. Guarde o segredo de validação HMAC.",
      },
      { status: 201, headers }
    );
  } catch (error) {
    return handleApiGuardError(error);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const key = await requireApiKey(req);
    requireScope(key, "webhooks:manage");
    const parsed = id.safeParse(req.nextUrl.searchParams.get("id"));
    if (!parsed.success) throw new ApiGuardError("ID do webhook inválido.", 400);
    const ref = adminDb.collection("webhooks").doc(parsed.data);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new ApiGuardError("Webhook não encontrado.", 404);
    const clientId = snapshot.data()?.clientId;
    if (typeof clientId !== "string" || !clientId)
      throw new ApiGuardError("Webhook sem empresa válida.", 409);
    requireClient(key, clientId);
    // Preserve delivery history and audit evidence instead of physically deleting the endpoint.
    await ref.update({
      active: false,
      revokedAt: new Date().toISOString(),
      revokedByKeyId: key.id,
    });
    return NextResponse.json({ success: true, message: "Webhook desativado." }, { headers });
  } catch (error) {
    return handleApiGuardError(error);
  }
}
