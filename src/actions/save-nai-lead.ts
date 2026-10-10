"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAiAction, DOCUMENT_AI_ROLES } from "@/lib/auth/ai-action";

const LeadSchema = z
  .object({
    skillTitle: z.string().trim().min(1).max(200),
    userText: z.string().trim().min(1).max(4000),
    aiResponse: z.string().trim().min(1).max(20000),
  })
  .strict();
export type LeadNaiData = z.infer<typeof LeadSchema>;

export async function salvarLeadNai(data: LeadNaiData, idToken?: string) {
  const user = await requireAiAction(idToken, DOCUMENT_AI_ROLES, data);
  const parsed = LeadSchema.safeParse(data);
  if (!parsed.success) return { sucesso: false, erro: "Dados da conversa inválidos." };
  try {
    await adminDb.collection("nai_leads").add({
      ...parsed.data,
      ownerUid: user.uid,
      companyId: user.tenantId,
      createdAt: FieldValue.serverTimestamp(),
      source: "Widget Flutuante NAI",
      status: "novo",
    });
    return { sucesso: true };
  } catch {
    return { sucesso: false, erro: "Não foi possível salvar a conversa." };
  }
}
