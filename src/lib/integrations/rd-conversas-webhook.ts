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
  diagnose?: (diagnostic: RdWebhookDiagnostic) => void | Promise<void>;
  parseCompletedAso?: (value: unknown) => string | null;
  save: (key: string, message: RdIncomingMessage) => Promise<boolean>;
};
export type RdWebhookDiagnostic = {
  code:
    | "invalid_envelope"
    | "invalid_aso"
    | "outgoing"
    | "unknown_direction"
    | "invalid_phone"
    | "outside_avp"
    | "invalid_request_id"
    | "invalid_message"
    | "stored"
    | "duplicate"
    | "storage_unavailable";
  status: number;
  fields: string[];
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

/** Bounded field/type inventory; primitive values and credential subtrees are omitted. */
export function rdPayloadShape(value: unknown): string[] {
  const fields: string[] = [];
  const visit = (item: unknown, path: string, depth: number) => {
    if (fields.length >= 100 || depth > 5) return;
    if (Array.isArray(item)) {
      fields.push(path + ":array");
      if (item.length) visit(item[0], path + "[]", depth + 1);
    } else if (item && typeof item === "object") {
      fields.push(path + ":object");
      for (const [key, child] of Object.entries(item)) {
        if (fields.length >= 100) break;
        const safe = /^[a-zA-Z_]{1,40}$/.test(key) ? key : "[other]";
        const next = path + "." + safe;
        if (/token|secret|authorization|password|credential|api.?key/i.test(key)) {
          fields.push(next + ":redacted");
        } else visit(child, next, depth + 1);
      }
    } else fields.push(path + ":" + (item === null ? "null" : typeof item));
  };
  visit(value, "$", 0);
  return fields;
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return response(400, { error: "JSON inválido." });
  }
  const fields = rdPayloadShape(parsed);
  const finish = async (
    status: number,
    body: Record<string, unknown>,
    code: RdWebhookDiagnostic["code"]
  ) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (config.diagnose)
        await Promise.race([
          config.diagnose({ code, status, fields }),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 1000);
          }),
        ]);
    } catch {
      /* Diagnostics must not change receipt or cause a provider retry. */
    } finally {
      if (timer) clearTimeout(timer);
    }
    return response(status, body);
  };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return finish(422, { error: "Envelope da mensagem inválido." }, "invalid_envelope");
  const body = record(parsed);
  const data = Object.keys(record(body.data)).length ? record(body.data) : body;
  const message = record(data.message);
  const customer = record(data.customer);
  const completedAso = data.event === "aso.request.completed";
  const completedText = completedAso ? config.parseCompletedAso?.(data.aso_request) : null;
  if (completedAso && !completedText)
    return finish(
      422,
      {
        error: "Solicitação de ASO incompleta ou inválida.",
      },
      "invalid_aso"
    );
  // Explicit outgoing signals are ignored. Do not infer incoming from absence.
  const direction = data.direction ?? message.direction;
  const sentBy = data.sent_by ?? message.sent_by;
  if (!completedAso && (direction === "outbound" || sentBy === "operator" || sentBy === "bot"))
    return finish(200, { accepted: false, reason: "outgoing" }, "outgoing");
  if (!completedAso && direction !== "inbound" && sentBy !== "customer")
    return finish(422, { error: "Direção da mensagem não reconhecida." }, "unknown_direction");
  const phone = normalizeRdPhone(customer.cel_phone ?? data.phone);
  if (!phone) return finish(422, { error: "Telefone inválido." }, "invalid_phone");
  if (!allowed.has(phone))
    return finish(200, { accepted: false, reason: "outside_avp" }, "outside_avp");
  const requestId = data.request_id;
  if (
    completedAso &&
    (typeof requestId !== "string" || !requestId.trim() || requestId.length > 400)
  )
    return finish(422, { error: "Identificador da solicitação inválido." }, "invalid_request_id");
  const id = completedAso
    ? "aso-request:" + requestId
    : (message.id ?? message._id ?? data.message_id);
  const text = completedAso
    ? completedText
    : typeof data.message === "string"
      ? data.message
      : (message.text ?? message.content);
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 512 ||
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 16000
  )
    return finish(
      422,
      {
        error: "Identificador ou texto da mensagem inválido.",
      },
      "invalid_message"
    );
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
    return finish(200, { accepted: true, duplicate: !created }, created ? "stored" : "duplicate");
  } catch {
    return finish(
      503,
      {
        error: "Recebimento indisponível. Tente novamente.",
      },
      "storage_unavailable"
    );
  }
}
