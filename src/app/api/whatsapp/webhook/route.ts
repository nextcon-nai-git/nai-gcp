import { NextRequest, NextResponse } from "next/server";
import { processWhatsappMessage } from "@/ai/flows/whatsapp-agent-flow";
import { NEXTCON_WHATSAPP_DISPLAY } from "@/lib/whatsapp-routing";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_MESSAGE_LENGTH = 16_000;

class InvalidWebhook extends Error {
  constructor(readonly status: number) {
    super("Payload inválido.");
  }
}

async function readPayload(req: NextRequest): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > MAX_WEBHOOK_BYTES) throw new InvalidWebhook(413);
  const reader = req.body?.getReader();
  if (!reader) throw new InvalidWebhook(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new InvalidWebhook(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidWebhook(400);
  }
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
}

function extractMessage(body: unknown) {
  const data = field(body, "data");
  const key = field(data, "key");
  const message = field(data, "message");
  const change = first(field(first(field(body, "entry")), "changes"));
  const meta = first(field(field(change, "value"), "messages"));
  let phone: unknown;
  let text: unknown;
  if (field(key, "remoteJid") || message) {
    phone = field(key, "remoteJid");
    if (typeof phone === "string" && phone.endsWith("@lid")) phone = field(key, "remoteJidAlt");
    if (typeof phone === "string") phone = phone.replace(/@s\.whatsapp\.net$/, "");
    text = field(message, "conversation") || field(field(message, "extendedTextMessage"), "text");
  } else if (meta) {
    phone = field(meta, "from");
    text = field(field(meta, "text"), "body");
  } else {
    phone = field(body, "phone");
    text = field(body, "message");
  }
  if (
    typeof phone !== "string" ||
    !/^\+?\d{7,20}$/.test(phone) ||
    typeof text !== "string" ||
    !text.trim() ||
    text.length > MAX_MESSAGE_LENGTH
  )
    throw new InvalidWebhook(400);
  return { fromPhone: phone, messageText: text.trim() };
}

// Only computes a response for the authenticated integration. Does not send messages.
export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  try {
    const { fromPhone, messageText } = extractMessage(await readPayload(req));
    const result = await processWhatsappMessage(messageText, fromPhone);
    return NextResponse.json({
      success: true,
      officialChannel: NEXTCON_WHATSAPP_DISPLAY,
      from: fromPhone,
      incomingMessage: messageText,
      replyText: result.replyText,
      isHumanHandoff: result.isHumanHandoff,
      humanResponsible: result.humanResponsible,
    });
  } catch (error: unknown) {
    if (error instanceof InvalidWebhook)
      return NextResponse.json(
        {
          success: false,
          error: error.status === 413 ? "Payload excede o limite permitido." : "Payload inválido.",
        },
        { status: error.status }
      );
    console.error("[WhatsApp Webhook Error] Falha no processamento.");
    return NextResponse.json(
      { success: false, error: "Erro interno no processamento do webhook." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Verificação de Webhook Meta / Hub
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({
    status: "online",
    service: "NextCon WhatsApp Intelligent Bot (41 3358-0818)",
    version: "NAI 3.7",
    endpoints: {
      postWebhook: "/api/whatsapp/webhook",
    },
  });
}
