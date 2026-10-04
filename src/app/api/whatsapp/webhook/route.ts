import { NextRequest, NextResponse } from "next/server";
import { processWhatsappMessage } from "@/ai/flows/whatsapp-agent-flow";
import { NEXTCON_WHATSAPP_DISPLAY } from "@/lib/whatsapp-routing";

/**
 * Webhook Universal para Integrações WhatsApp
 * Suporta: Evolution API, Z-API, Meta Cloud API, Baileys e Webhooks Genéricos.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
      return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
    const body = await req.json();

    // Extrair telefone e mensagem de acordo com o formato do payload
    let fromPhone = "";
    let messageText = "";

    // 1. Padrão Evolution API / Z-API
    if (body?.data?.key?.remoteJid || body?.data?.message) {
      fromPhone = (body?.data?.key?.remoteJid || "").replace("@s.whatsapp.net", "");
      messageText =
        body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || "";
    }
    // 2. Padrão Meta Cloud API
    else if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = body.entry[0].changes[0].value.messages[0];
      fromPhone = msg.from;
      messageText = msg.text?.body || "";
    }
    // 3. Padrão Simplificado / Payload Direto
    else if (body?.phone && body?.message) {
      fromPhone = body.phone;
      messageText = body.message;
    }

    if (!fromPhone || !messageText) {
      return NextResponse.json(
        {
          success: false,
          message: "Payload não continha número ou mensagem válidos.",
        },
        { status: 400 }
      );
    }

    // Processar através do motor de IA NAI 3.7
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
  } catch (error: any) {
    console.error("[WhatsApp Webhook Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno no processamento do webhook",
      },
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
