import { createHash, timingSafeEqual } from "node:crypto";

export type RdIncomingMessage = {
  provider: "rd-conversas";
  messageId: string;
  phone: string;
  text: string;
  receivedAt: string;
};
export type RdWebhookConfig = {
  secret?: string;
  allowedPhones: string[];
  save: (key: string, message: RdIncomingMessage) => Promise<boolean>;
};

export function normalizeRdPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const phone = value.replace(/[+\s().-]/g, "");
  return /^55\d{10,11}$/.test(phone) ? phone : "";
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function authenticated(value: string | null, secret: string) {
  if (!value || value.length > 1024) return false;
  const left = createHash("sha256").update(value).digest();
  const right = createHash("sha256").update(secret).digest();
  return timingSafeEqual(left, right);
}
const response = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Accepted adapter contracts are documented and provisional until verified
 * against an actual RD webhook. Unknown payloads fail without storing raw data.
 */
export async function receiveRdWebhook(req: Request, config: RdWebhookConfig): Promise<Response> {
  if (!config.secret || config.secret.length < 32)
    return response(503, { error: "Webhook não configurado." });
  if (!authenticated(req.headers.get("x-nai-webhook-secret"), config.secret))
    return response(401, { error: "Webhook não autorizado." });
  const allowed = new Set(config.allowedPhones.map(normalizeRdPhone).filter(Boolean));
  if (!allowed.size) return response(503, { error: "Contatos AVP não configurados." });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return response(415, { error: "Envie JSON." });
  const maxBytes = 65536;
  const reader = req.body?.getReader();
  if (!reader) return response(400, { error: "Corpo ausente." });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return response(413, { error: "Mensagem excede o limite." });
      }
      chunks.push(value);
    }
  } catch {
    return response(400, { error: "Corpo inválido." });
  } finally {
    reader.releaseLock();
  }
  let body: Record<string, unknown>;
  try {
    body = record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return response(400, { error: "JSON inválido." });
  }
  const data = Object.keys(record(body.data)).length ? record(body.data) : body;
  const message = record(data.message);
  const customer = record(data.customer);
  // Explicit outgoing signals are ignored. Do not infer incoming from absence.
  const direction = data.direction ?? message.direction;
  const sentBy = data.sent_by ?? message.sent_by;
  if (direction === "outbound" || sentBy === "operator" || sentBy === "bot")
    return response(200, { accepted: false, reason: "outgoing" });
  if (direction !== "inbound" && sentBy !== "customer")
    return response(422, { error: "Direção da mensagem não reconhecida." });
  const phone = normalizeRdPhone(customer.cel_phone ?? data.phone);
  if (!phone) return response(422, { error: "Telefone inválido." });
  if (!allowed.has(phone)) return response(200, { accepted: false, reason: "outside_avp" });
  const id = message.id ?? message._id ?? data.message_id;
  const text = typeof data.message === "string" ? data.message : (message.text ?? message.content);
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 512 ||
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 16000
  )
    return response(422, { error: "Identificador ou texto da mensagem inválido." });
  const incoming: RdIncomingMessage = {
    provider: "rd-conversas",
    messageId: id,
    phone,
    text,
    receivedAt: new Date().toISOString(),
  };
  const key = createHash("sha256")
    .update("rd-conversas\0" + id)
    .digest("hex");
  try {
    const created = await config.save(key, incoming);
    return response(200, { accepted: true, duplicate: !created });
  } catch {
    return response(503, { error: "Recebimento indisponível. Tente novamente." });
  }
}
