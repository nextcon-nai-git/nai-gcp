import { completedRdAsoText, rdAsoRequestFromText } from "@/lib/integrations/rd-aso-request";
import { adminDb } from "@/lib/firebase-admin";
import { receiveRdWebhook } from "@/lib/integrations/rd-conversas-webhook";
import { createRdWebhookDiagnostics } from "@/lib/integrations/rd-conversas-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const diagnose = createRdWebhookDiagnostics({
  until: () => process.env.RD_CONVERSAS_DIAGNOSTICS_UNTIL,
  write: async (observation) => {
    // Structured operational event, deliberately free of message/credential values.
    // eslint-disable-next-line no-console
    console.info("NAI_RD_WEBHOOK_RESULT", JSON.stringify(observation));
    await adminDb
      .collection("webhook_deliveries")
      .doc("rd-conversas-diagnostics")
      .collection("outcomes")
      .doc(observation.code)
      .set(observation);
  },
});

export async function POST(req: Request) {
  return receiveRdWebhook(req, {
    secret: process.env.RD_CONVERSAS_WEBHOOK_SECRET,
    parseCompletedAso: completedRdAsoText,
    diagnose,
    allowedPhones: (process.env.RD_CONVERSAS_AVP_PHONES || "").split(","),
    save: async (key, message) => {
      const ref = adminDb
        .collection("integrations")
        .doc("rd-conversas-avp")
        .collection("messages")
        .doc(key);
      const aso = rdAsoRequestFromText(message.text, key, message.messageId, message.receivedAt);
      const asoRef = aso
        ? adminDb
            .collection("integrations")
            .doc("rd-conversas-avp")
            .collection("asoRequests")
            .doc(aso.id)
        : null;
      return adminDb.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return false;
        tx.create(ref, {
          ...message,
          status: aso ? "ASO_REQUEST_CREATED" : "RECEIVED",
          clientGroup: "AVP",
          ...(aso ? { asoRequestId: aso.id } : {}),
        });
        if (aso && asoRef) tx.create(asoRef, aso);
        return true;
      });
    },
  });
}
