import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, handleAuthError, badRequest } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { getPgrAi } from "@/services/pgr-ai-provider";
import { assertPgrClientBinding } from "@/lib/pgr-save-plan";
import { PGR_AGENT_ROLES, getNaiDocument } from "@/lib/pgr-schema";
import { pgrAgentPrompt } from "@/lib/pgr-agent-prompts";
import { loadNaiImportForReview } from "@/services/nai-import-review";
export const runtime = "nodejs";
export const maxDuration = 90;
const Input = z.object({
  companyId: z.string().min(1).max(128),
  cardId: z.string().regex(/^[a-f0-9]{64}$/),
  role: z.enum(PGR_AGENT_ROLES),
});
const Review = z.object({
  resumo: z.string().max(2000),
  achados: z
    .array(
      z.object({
        descricao: z.string().max(800),
        evidencia: z.string().max(600),
        prioridade: z.enum(["high", "medium", "low"]),
      })
    )
    .max(15),
  checklist: z.array(z.string().max(400)).max(20),
  encaminhamentos: z.array(z.string().max(600)).max(10),
  limites: z.string().max(1500),
});
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const input = Input.parse(Object.fromEntries(request.nextUrl.searchParams));
    requirePgrCompany(user, input.companyId);
    const { ref } = await loadNaiImportForReview(user, input);
    const snap = await ref.collection("agent_reviews").doc(input.role).get();
    const parsed = Review.safeParse(snap.data()?.review);
    return NextResponse.json(
      { review: parsed.success ? parsed.data : null, status: "draft" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return e instanceof AuthError
      ? handleAuthError(e)
      : NextResponse.json({ error: "Não foi possível consultar a revisão." }, { status: 422 });
  }
}
export async function POST(request: NextRequest) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const text = await request.text();
    if (Buffer.byteLength(text) > 2000) throw badRequest("Solicitação acima do limite.");
    const input = Input.parse(JSON.parse(text));
    requirePgrCompany(user, input.companyId);
    const { ref, analysis, companyRef } = await loadNaiImportForReview(user, input);
    const company = await companyRef.get();
    if (!company.exists) throw badRequest("Cliente não encontrado para a revisão do documento.");
    assertPgrClientBinding(analysis, {
      id: input.companyId,
      name: String(company.data()?.name || ""),
      cnpj: String(company.data()?.cnpj || ""),
    });
    const ai = getPgrAi();
    if (!ai)
      return NextResponse.json(
        {
          error:
            "A IA não está configurada. Os checklists e cards documentais continuam disponíveis para a equipe.",
        },
        { status: 503 }
      );
    const reviewRef = ref.collection("agent_reviews").doc(input.role);
    const now = Date.now();
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(reviewRef);
      if (Number(current.data()?.busyUntil) > now)
        throw new AuthError("Este agente já está preparando a revisão. Aguarde.", 429);
      tx.set(reviewRef, { busyUntil: now + 90000 }, { merge: true });
    });
    try {
      const controller = new AbortController();
      const generation = ai.generate({
        prompt: [
          { text: pgrAgentPrompt(input.role) },
          {
            text: JSON.stringify({
              documento: getNaiDocument(analysis),
              empresa: analysis.pgrCardDetalhado,
              riscos: analysis.riscosIdentificados,
              acoes: analysis.acoesCategorizadas.filter((a) => a.agenteSugerido === input.role),
              leitura: analysis.leitura,
              analiseInicial: analysis.analiseAgente ?? null,
            }),
          },
        ],
        output: { schema: Review },
        abortSignal: controller.signal,
      });
      const result = await Promise.race([
        generation,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            controller.abort();
            resolve(null);
          }, 60000);
        }),
      ]);
      const review = Review.safeParse(result?.output);
      if (!review.success)
        throw new AuthError(
          "O agente não concluiu a revisão. Nenhuma tarefa foi marcada como executada.",
          503
        );
      const batch = adminDb.batch();
      batch.set(reviewRef, {
        review: review.data,
        status: "draft",
        role: input.role,
        busyUntil: 0,
        createdBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.create(ref.collection("agent_review_history").doc(), {
        review: review.data,
        status: "draft",
        role: input.role,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json(
        { review: review.data, status: "draft" },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (e) {
      await reviewRef.set({ busyUntil: 0 }, { merge: true });
      throw e;
    }
  } catch (e) {
    if (e instanceof AuthError) return handleAuthError(e);
    return NextResponse.json(
      { error: "Não foi possível preparar a revisão deste agente." },
      { status: 422 }
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
