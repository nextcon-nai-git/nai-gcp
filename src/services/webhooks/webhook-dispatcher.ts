import { createHmac, randomUUID } from "crypto";
import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiGuardError, requireClient } from "@/lib/developer-api-guard";
import type { DeveloperPrincipal, WebhookRecord, WebhookEvent } from "@/types/developer";
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
  leaseToken?: string | null;
  leaseUntil?: string | null;
}
type Delivery = Omit<WebhookDeliveryRecord, "id">;
const DEFAULT_MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10000;
const LEASE_MS = 120000;
const timestamp = () => FieldValue.serverTimestamp();

export function signWebhookPayload(payloadString: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadString).digest("hex");
}

/** Persist before returning. Only the scheduled worker performs network delivery. */
export async function emitWebhookEvent(
  eventType: WebhookEvent,
  clientId: string,
  eventData: Record<string, unknown>
): Promise<{ eventId: string; deliveriesCount: number }> {
  const eventId = `evt_${randomUUID()}`;
  const snapshot = await adminDb
    .collection("webhooks")
    .where("clientId", "==", clientId)
    .where("active", "==", true)
    .get();
  const webhooks = snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }) as WebhookRecord)
    .filter(
      (webhook) =>
        webhook.events.includes(eventType) || (webhook.events as readonly string[]).includes("*")
    );
  const createdAt = new Date().toISOString();
  await Promise.all(
    webhooks.map(async (webhook) => {
      const payload = { id: eventId, event: eventType, createdAt, clientId, data: eventData };
      await adminDb.collection("webhook_deliveries").add({
        eventId,
        webhookId: webhook.id,
        clientId,
        eventType,
        targetUrl: webhook.url,
        attempt: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        status: "PENDING",
        httpStatus: null,
        lastError: null,
        nextRetryAt: createdAt,
        createdAt,
        deliveredAt: null,
        payload,
        signature: `sha256=${signWebhookPayload(JSON.stringify(payload), webhook.secret)}`,
        leaseToken: null,
        leaseUntil: null,
        serverTimestamp: timestamp(),
      });
    })
  );
  return { eventId, deliveriesCount: webhooks.length };
}

/** Claim atomically. Expired leases are retryable after a process interruption. */
async function claimDelivery(ref: DocumentReference) {
  const now = new Date().toISOString();
  const leaseToken = randomUUID();
  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;
    const delivery = snapshot.data() as Delivery;
    if (!["PENDING", "RETRYING"].includes(delivery.status)) return null;
    if (delivery.leaseUntil && delivery.leaseUntil > now) return null;
    if (delivery.nextRetryAt && delivery.nextRetryAt > now) return null;
    const maxAttempts = delivery.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    if (delivery.attempt >= maxAttempts) {
      tx.update(ref, {
        status: "DEAD_LETTER",
        nextRetryAt: null,
        leaseToken: null,
        leaseUntil: null,
        lastError: "Limite de tentativas atingido após interrupção da entrega.",
        updatedAt: timestamp(),
      });
      return null;
    }
    const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
    const claimed = {
      ...delivery,
      attempt: (delivery.attempt || 0) + 1,
      maxAttempts,
      leaseToken,
      leaseUntil,
    };
    tx.update(ref, {
      status: "RETRYING",
      attempt: claimed.attempt,
      leaseToken,
      leaseUntil,
      nextRetryAt: leaseUntil,
      updatedAt: timestamp(),
    });
    return claimed;
  });
}

/** A late worker must not overwrite the state of a newer attempt. */
async function finishDelivery(
  ref: DocumentReference,
  leaseToken: string,
  update: Record<string, unknown>
) {
  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.data()?.leaseToken !== leaseToken) return false;
    tx.update(ref, { ...update, leaseToken: null, leaseUntil: null, updatedAt: timestamp() });
    return true;
  });
}

export async function executeWebhookDelivery(deliveryId: string): Promise<void> {
  const ref = adminDb.collection("webhook_deliveries").doc(deliveryId);
  const delivery = await claimDelivery(ref);
  if (!delivery) return;
  let httpStatus: number | null = null;
  let lastError = "Falha de conexão com o endpoint.";
  let permanent = false;
  let signature = delivery.signature;
  let delivered = false;
  try {
    // Recheck revocation, tenant and destination on every attempt, including retries.
    const webhook = (await adminDb.collection("webhooks").doc(delivery.webhookId).get()).data();
    if (
      !webhook ||
      !webhook.active ||
      webhook.clientId !== delivery.clientId ||
      webhook.url !== delivery.targetUrl ||
      typeof webhook.secret !== "string" ||
      !webhook.secret
    ) {
      permanent = true;
      throw new Error("Webhook inativo, inexistente ou incompatível com a entrega.");
    }
    const url = await validateWebhookTargetUrl(delivery.targetUrl);
    if (!url.valid) {
      permanent = !url.retryable;
      throw new Error(`Disparo bloqueado por Egress Guard: ${url.error}`);
    }
    const body = JSON.stringify(delivery.payload);
    signature = `sha256=${signWebhookPayload(body, webhook.secret)}`;
    const response = await postWebhook(
      url.normalizedUrl!,
      url.resolvedIps!,
      {
        "Content-Type": "application/json",
        "User-Agent": "NAI-Webhook-Dispatcher/2.0",
        "X-NAI-Event": delivery.eventType,
        "X-NAI-Event-Id": delivery.eventId,
        "X-NAI-Delivery-Id": deliveryId,
        "X-NAI-Signature": signature,
        "X-NAI-Attempt": String(delivery.attempt),
      },
      body,
      REQUEST_TIMEOUT_MS
    );
    httpStatus = response.status;
    delivered = response.ok;
    lastError = `HTTP ${httpStatus}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
  }
  // Persistence failures must reach the scheduler; preserve the lease for recovery.
  if (delivered) {
    await finishDelivery(ref, delivery.leaseToken, {
      status: "DELIVERED",
      httpStatus,
      signature,
      deliveredAt: new Date().toISOString(),
      lastError: null,
      nextRetryAt: null,
    });
    return;
  }
  const exhausted = permanent || delivery.attempt >= delivery.maxAttempts;
  await finishDelivery(ref, delivery.leaseToken, {
    status: exhausted ? "DEAD_LETTER" : "RETRYING",
    httpStatus,
    lastError,
    signature,
    nextRetryAt: exhausted
      ? null
      : new Date(Date.now() + Math.pow(2, delivery.attempt) * 30000).toISOString(),
  });
}

/** Bounded work; await all sends before the authenticated HTTP invocation ends. */
export async function processWebhookQueue() {
  const queue = adminDb.collection("webhook_deliveries");
  const [pending, retrying] = await Promise.all([
    // Also picks up legacy PENDING records whose nextRetryAt is null.
    queue.where("status", "==", "PENDING").orderBy("createdAt").limit(10).get(),
    queue
      .where("status", "==", "RETRYING")
      .where("nextRetryAt", "<=", new Date().toISOString())
      .orderBy("nextRetryAt")
      .limit(10)
      .get(),
  ]);
  const docs = [...pending.docs, ...retrying.docs];
  let failures = 0;
  for (let offset = 0; offset < docs.length; offset += 5) {
    const results = await Promise.allSettled(
      docs.slice(offset, offset + 5).map((doc) => executeWebhookDelivery(doc.id))
    );
    failures += results.filter((result) => result.status === "rejected").length;
  }
  if (failures)
    throw new Error("Não foi possível processar todas as entregas. A fila foi preservada.");
  return { examined: docs.length };
}

/** Requeue a failed delivery atomically, resetting its retry budget. */
export async function replayWebhookDelivery(
  deliveryId: string,
  authKey: DeveloperPrincipal
): Promise<{ success: boolean; message: string }> {
  const ref = adminDb.collection("webhook_deliveries").doc(deliveryId);
  await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ApiGuardError("Entrega não encontrada.", 404);
    const delivery = snapshot.data() as Delivery;
    if (typeof delivery.clientId !== "string" || !delivery.clientId)
      throw new ApiGuardError("Entrega sem empresa válida.", 409);
    requireClient(authKey, delivery.clientId);
    if (!["DEAD_LETTER", "FAILED"].includes(delivery.status))
      throw new ApiGuardError(
        "Somente entregas com falha definitiva podem ser reenfileiradas.",
        409
      );
    const webhook = (await tx.get(adminDb.collection("webhooks").doc(delivery.webhookId))).data();
    if (!webhook || !webhook.active || webhook.clientId !== delivery.clientId || !webhook.secret)
      throw new ApiGuardError("Webhook inexistente, inativo ou incompatível com a entrega.", 409);
    if (webhook.url !== delivery.targetUrl)
      throw new ApiGuardError("O destino mudou. O replay da entrega antiga foi bloqueado.", 409);
    tx.update(ref, {
      status: "PENDING",
      attempt: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      lastError: null,
      httpStatus: null,
      deliveredAt: null,
      nextRetryAt: new Date().toISOString(),
      leaseToken: null,
      leaseUntil: null,
      updatedAt: timestamp(),
    });
  });
  return { success: true, message: `Replay da entrega ${deliveryId} enfileirado com sucesso.` };
}
