"use server";
import { requireAiAction, FINANCIAL_AI_ROLES } from "@/lib/auth/ai-action";

import {
  processWhatsappMessage,
  WhatsappSessionState,
  WhatsappBotResponse,
} from "@/ai/flows/whatsapp-agent-flow";
import {
  WHATSAPP_DEPARTMENTS,
  NEXTCON_WHATSAPP_DISPLAY,
  NEXTCON_WHATSAPP_NUMBER,
} from "@/lib/whatsapp-routing";

export interface SendSimulatedWhatsappMessageInput {
  phone: string;
  message: string;
  sessionState?: Partial<WhatsappSessionState>;
}

export async function sendSimulatedWhatsappMessage(
  input: SendSimulatedWhatsappMessageInput,
  idToken?: string
): Promise<WhatsappBotResponse> {
  await requireAiAction(idToken, FINANCIAL_AI_ROLES, [input]);

  return await processWhatsappMessage(
    input.message,
    input.phone || "554199999999",
    input.sessionState
  );
}

export async function sendSimulatedProviderMediaMessage(
  input: {
    mediaType: "audio" | "image";
    textOrTranscript?: string;
    imageBase64?: string;
    providerPhone?: string;
  },
  idToken?: string
) {
  await requireAiAction(idToken, FINANCIAL_AI_ROLES, [input]);

  const { processProviderMediaMessage } = await import("@/ai/flows/whatsapp-agent-flow");
  return await processProviderMediaMessage(input);
}
