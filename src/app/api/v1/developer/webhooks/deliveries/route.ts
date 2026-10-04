import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
} from "@/lib/developer-api-guard";
import { replayWebhookDelivery } from "@/services/webhooks/webhook-dispatcher";

/**
 * GET /api/v1/developer/webhooks/deliveries
 * Consulta o histórico de entregas e Dead-Letter Queue (DLQ)
 */
export async function GET(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "webhooks:manage");

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || authKey.clientId;
    const status = searchParams.get("status"); // PENDING | DELIVERED | FAILED | RETRYING | DEAD_LETTER
    const webhookId = searchParams.get("webhookId");

    requireClient(authKey, clientId);

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    let q = query(
      collection(db, "webhook_deliveries"),
      where("clientId", "==", clientId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    if (status) {
      q = query(
        collection(db, "webhook_deliveries"),
        where("clientId", "==", clientId),
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        limit(50)
      );
    }

    const snapshot = await getDocs(q);
    const deliveries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ deliveries });
  } catch (error) {
    return handleApiGuardError(error);
  }
}

/**
 * POST /api/v1/developer/webhooks/deliveries
 * Replay manual de uma entrega em Dead-Letter Queue (DLQ Replay)
 */
export async function POST(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "webhooks:manage");

    const body = await req.json();
    const { deliveryId } = body;

    if (!deliveryId) {
      return NextResponse.json(
        { error: "deliveryId é obrigatório para execução do replay." },
        { status: 400 }
      );
    }

    const result = await replayWebhookDelivery(deliveryId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiGuardError(error);
  }
}
