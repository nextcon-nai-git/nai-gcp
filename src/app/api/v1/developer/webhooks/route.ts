import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
} from "@/lib/developer-api-guard";
import { validateWebhookTargetUrl } from "@/lib/webhook-security-guard";

/**
 * GET /api/v1/developer/webhooks
 * Lista endpoints de webhook registrados para o tenant
 */
export async function GET(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "webhooks:manage");

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("clientId") || authKey.clientId;
    requireClient(authKey, companyId);

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const q = query(
      collection(db, "webhooks"),
      where("clientId", "==", companyId),
      where("active", "==", true)
    );

    const snapshot = await getDocs(q);
    const webhooks = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        clientId: data.clientId,
        url: data.url,
        events: data.events,
        active: data.active,
        createdAt: data.createdAt,
        secretPrefix: `${(data.secret || "").slice(0, 10)}...`, // Oculta o segredo completo
      };
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    return handleApiGuardError(error);
  }
}

/**
 * POST /api/v1/developer/webhooks
 * Cadastra um novo Webhook de Integração com segredo HMAC-SHA256
 */
export async function POST(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "webhooks:manage");

    const body = await req.json();
    const { clientId, url, events } = body;

    const targetClientId = clientId || authKey.clientId;
    requireClient(authKey, targetClientId);

    // Validação Estrita de Segurança de URL (SSRF & Egress Protection)
    const urlValidation = await validateWebhookTargetUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        {
          error: urlValidation.error,
        },
        { status: 400 }
      );
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        {
          error:
            'Forneça ao menos um evento no array de eventos (ex: ["employee.clearance_changed", "aso.expired"]).',
        },
        { status: 400 }
      );
    }

    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const payload = {
      clientId: targetClientId,
      url: url.trim(),
      secret,
      events,
      active: true,
      createdAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "webhooks"), payload);

    return NextResponse.json(
      {
        id: docRef.id,
        clientId: payload.clientId,
        url: payload.url,
        secret, // Retorna o segredo no momento do cadastro para que o cliente configure a validação HMAC
        events: payload.events,
        createdAt: payload.createdAt,
        message: "Webhook cadastrado com sucesso. Guarde o segredo de validação HMAC.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiGuardError(error);
  }
}

/**
 * DELETE /api/v1/developer/webhooks?id=...
 * Remove/desativa webhook
 */
export async function DELETE(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "webhooks:manage");

    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get("id");

    if (!webhookId) {
      return NextResponse.json({ error: "ID do Webhook é obrigatório." }, { status: 400 });
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await deleteDoc(doc(db, "webhooks", webhookId));

    return NextResponse.json({ success: true, message: "Webhook removido com sucesso." });
  } catch (error) {
    return handleApiGuardError(error);
  }
}
