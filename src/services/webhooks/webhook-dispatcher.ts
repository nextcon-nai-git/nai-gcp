import { createHmac, randomUUID } from "crypto";
import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiGuardError, requireClient } from "@/lib/developer-api-guard";
import type { ApiKeyRecord } from "@/types/developer";
import { WebhookRecord, WebhookEvent } from "@/types/developer";
import { postWebhook } from "./post-webhook";
import { validateWebhookTargetUrl } from "@/lib/webhook-security-guard";

export type WebhookDeliveryStatus = "PENDING" | "DELIVERED" | "FAILED" | "RETRYING" | "DEAD_LETTER";

export interface WebhookDeliveryRecord {
  id: string;
  eventId: string;
  webhookId: string;
  clientId: string;
  eventType: WebhookEvent | string;
  targetUrl: string;
  attempt: number;
  maxAttempts: number;
  status: WebhookDeliveryStatus;
  httpStatus: number | null;
  lastError: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  payload: Record<string, unknown>;
  signature: string;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10000; // 10s timeout por tentativa

/**
 * Calcula a assinatura HMAC-SHA256 do payload do webhook
 */
export function signWebhookPayload(payloadString: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadString).digest("hex");
}

/**
 * Dispara um evento para todos os webhooks cadastrados para o tenant.
 * Cria os registros na coleção `webhook_deliveries` e inicia o ciclo de entrega assíncrono.
 */
export async function emitWebhookEvent(
  eventType: WebhookEvent,
  clientId: string,
  eventData: Record<string, unknown>
): Promise<{ eventId: string; deliveriesCount: number }> {
  const eventId = `evt_${randomUUID()}`;
  const db = adminDb;

  // 1. Localiza os endpoints de Webhook ativos para este tenant que escutam este evento
  const snapshot = await db
    .collection("webhooks")
    .where("clientId", "==", clientId)
    .where("active", "==", true)
    .get();
  if (snapshot.empty) {
    return { eventId, deliveriesCount: 0 };
  }

  const matchingWebhooks = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WebhookRecord)
    .filter((w) => w.events.includes(eventType) || (w.events as any[]).includes("*"));

  if (matchingWebhooks.length === 0) {
    return { eventId, deliveriesCount: 0 };
  }

  const createdAt = new Date().toISOString();

  // 2. Enfileira as entregas na coleção `webhook_deliveries`
  const deliveryPromises = matchingWebhooks.map(async (wh) => {
    const rawPayload = {
      id: eventId,
      event: eventType,
      createdAt,
      clientId,
      data: eventData,
    };

    const payloadString = JSON.stringify(rawPayload);
    const signature = signWebhookPayload(payloadString, wh.secret);

    const deliveryData = {
      eventId,
      webhookId: wh.id,
      clientId,
      eventType,
      targetUrl: wh.url,
      attempt: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      status: "PENDING" as WebhookDeliveryStatus,
      httpStatus: null,
      lastError: null,
      nextRetryAt: null,
      createdAt,
      deliveredAt: null,
      payload: rawPayload,
      signature: `sha256=${signature}`,
      serverTimestamp: FieldValue.serverTimestamp(),
    };

    const deliveryDoc = await db.collection("webhook_deliveries").add(deliveryData);

    // Inicia entrega imediata em background
    executeWebhookDelivery(deliveryDoc.id, wh.secret, deliveryData).catch((err) => {
      console.error(`[Webhook Dispatcher Error ${deliveryDoc.id}]`, err);
    });

    return deliveryDoc.id;
  });

  await Promise.all(deliveryPromises);

  return { eventId, deliveriesCount: matchingWebhooks.length };
}

/**
 * Executa uma tentativa de envio HTTP com tratamento de timeout, retries exponenciais e Dead-Letter Queue
 */
export async function executeWebhookDelivery(
  deliveryId: string,
  secret: string,
  initialData?: any
): Promise<{
  success: boolean;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  error?: string;
}> {
  const db = adminDb;

  const deliveryRef = db.collection("webhook_deliveries").doc(deliveryId);
  let delivery = initialData;

  if (!delivery) {
    const snap = await deliveryRef.get();
    if (!snap.exists) {
      throw new Error(`Entrega ${deliveryId} não encontrada.`);
    }
    delivery = snap.data();
  }

  const currentAttempt = (delivery.attempt || 0) + 1;
  const maxAttempts = delivery.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const payloadString = JSON.stringify(delivery.payload);
  const signature = `sha256=${signWebhookPayload(payloadString, secret)}`;

  // Validação Estrita contra SSRF e DNS Rebinding antes do disparo
  const urlCheck = await validateWebhookTargetUrl(delivery.targetUrl);
  if (!urlCheck.valid) {
    const errorMsg = `Disparo Bloqueado por Egress Guard: ${urlCheck.error}`;
    return await handleDeliveryFailure(
      db,
      deliveryRef,
      delivery,
      maxAttempts,
      maxAttempts,
      400,
      errorMsg
    );
  }

  try {
    const response = await postWebhook(
      urlCheck.normalizedUrl!,
      urlCheck.resolvedIps!,
      {
        "Content-Type": "application/json",
        "User-Agent": "NAI-Webhook-Dispatcher/2.0",
        "X-NAI-Event": delivery.eventType,
        "X-NAI-Event-Id": delivery.eventId,
        "X-NAI-Delivery-Id": deliveryId,
        "X-NAI-Signature": signature,
        "X-NAI-Attempt": String(currentAttempt),
      },
      payloadString,
      REQUEST_TIMEOUT_MS
    );

    if (response.ok) {
      // Sucesso na Entrega
      const deliveredAt = new Date().toISOString();
      await deliveryRef.update({
        attempt: currentAttempt,
        status: "DELIVERED",
        httpStatus: response.status,
        deliveredAt,
        lastError: null,
        nextRetryAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true, status: "DELIVERED", httpStatus: response.status };
    } else {
      const errMsg = `HTTP ${response.status}`;
      return await handleDeliveryFailure(
        db,
        deliveryRef,
        delivery,
        currentAttempt,
        maxAttempts,
        response.status,
        errMsg
      );
    }
  } catch (error: any) {
    const isTimeout = error.name === "AbortError";
    const errMsg = isTimeout
      ? `Timeout excedido (${REQUEST_TIMEOUT_MS / 1000}s)`
      : error.message || "Falha de conexão com o endpoint";
    return await handleDeliveryFailure(
      db,
      deliveryRef,
      delivery,
      currentAttempt,
      maxAttempts,
      null,
      errMsg
    );
  }
}

/**
 * Trata falha de envio calculando backoff exponencial ou encaminhando para Dead-Letter
 */
async function handleDeliveryFailure(
  db: typeof adminDb,
  deliveryRef: DocumentReference,
  delivery: any,
  currentAttempt: number,
  maxAttempts: number,
  httpStatus: number | null,
  errorMessage: string
): Promise<{
  success: boolean;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  error?: string;
}> {
  if (currentAttempt >= maxAttempts) {
    // Excedeu o limite de tentativas -> Encaminha para Dead-Letter Queue (DLQ)
    await deliveryRef.update({
      attempt: currentAttempt,
      status: "DEAD_LETTER",
      httpStatus,
      lastError: errorMessage,
      nextRetryAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: false,
      status: "DEAD_LETTER",
      httpStatus: httpStatus || undefined,
      error: errorMessage,
    };
  }

  // Backoff Exponencial: (2 ^ attempt) * 30 segundos
  const backoffSeconds = Math.pow(2, currentAttempt) * 30;
  const nextRetryDate = new Date(Date.now() + backoffSeconds * 1000);

  await deliveryRef.update({
    attempt: currentAttempt,
    status: "RETRYING",
    httpStatus,
    lastError: errorMessage,
    nextRetryAt: nextRetryDate.toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: false,
    status: "RETRYING",
    httpStatus: httpStatus || undefined,
    error: errorMessage,
  };
}

/**
 * Re-executa uma entrega em Dead-Letter manualmente (Replay DLQ)
 */
export async function replayWebhookDelivery(
  deliveryId: string,
  authKey: ApiKeyRecord
): Promise<{ success: boolean; message: string }> {
  const db = adminDb;

  const deliveryRef = db.collection("webhook_deliveries").doc(deliveryId);
  const snap = await deliveryRef.get();
  if (!snap.exists) {
    throw new ApiGuardError("Entrega não encontrada.", 404);
  }

  const delivery = snap.data()!;
  if (typeof delivery.clientId !== "string" || !delivery.clientId)
    throw new ApiGuardError("Entrega sem empresa válida.", 409);
  requireClient(authKey, delivery.clientId);
  const webhookSnap = await db.collection("webhooks").doc(delivery.webhookId).get();
  const webhook = webhookSnap.data();
  if (!webhook || !webhook.active || webhook.clientId !== delivery.clientId || !webhook.secret)
    throw new ApiGuardError("Webhook inexistente, inativo ou incompatível com a entrega.", 409);
  if (webhook.url !== delivery.targetUrl)
    throw new ApiGuardError("O destino mudou. O replay da entrega antiga foi bloqueado.", 409);
  const secret = webhook.secret;

  await deliveryRef.update({
    status: "PENDING",
    lastError: null,
    nextRetryAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Executa imediatamente
  executeWebhookDelivery(deliveryId, secret, delivery).catch(() => {});

  return { success: true, message: `Replay da entrega ${deliveryId} enfileirado com sucesso.` };
}
