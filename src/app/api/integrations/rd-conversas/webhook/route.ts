import { completedRdAsoText, rdAsoRequestFromText } from "@/lib/integrations/rd-aso-request";
import { adminDb } from "@/lib/firebase-admin";
import { receiveRdWebhook } from "@/lib/integrations/rd-conversas-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let lastDiagnosticMs = 0;

export async function POST(req: Request) {
  return receiveRdWebhook(req, {
    secret: process.env.RD_CONVERSAS_WEBHOOK_SECRET,
    parseCompletedAso: completedRdAsoText,
    diagnose: (fields) => {
      const now = Date.now();
      const until = Date.parse(process.env.RD_CONVERSAS_DIAGNOSTICS_UNTIL || "");
      if (until > now && until - now <= 86400000 && now - lastDiagnosticMs >= 60000) {
        lastDiagnosticMs = now;
        console.info("NAI_RD_WEBHOOK_SCHEMA", JSON.stringify({ fields }));
      }
    },
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
