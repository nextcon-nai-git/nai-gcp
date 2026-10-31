import { randomUUID, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { isPgrGlobalAdmin, requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { WorkAnswer, WorkRequest } from "@/lib/work-assistant";
import { askWorkAssistant, workAssistantConfigured } from "@/services/work-assistant-openai";
import { prepareKitBatch } from "@/services/operational-kits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
async function administrator(request: NextRequest) {
  const user = await requireAuth(request);
  // Start with existing internal document-import permission; no new access grants.
  if (!isPgrGlobalAdmin(user))
    throw forbidden("O assistente operacional está disponível para a administração interna.");
  return user;
}
export async function GET(request: NextRequest) {
  try {
    await administrator(request);
    return NextResponse.json(
      { configured: workAssistantConfigured() },
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}
const bounded = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";
export async function POST(request: NextRequest) {
  try {
    const user = await administrator(request);
    const parsed = WorkRequest.safeParse(await limitedJson(request, 160000));
    if (!parsed.success) throw badRequest("Confira a mensagem e o cliente selecionado.");
    const data = parsed.data;
    requirePgrCompany(user, data.companyId);
    const companyRef = adminDb.collection("companies").doc(data.companyId);
    const company = await companyRef.get();
    if (!company.exists) throw new AuthError("Cliente não encontrado.", 404);
    if (data.action === "apply") {
      const proposalRef = adminDb.collection("workAssistantProposals").doc(data.proposalId);
      const saved = await adminDb.runTransaction(async (tx) => {
        const proposal = await tx.get(proposalRef),
          p = proposal.data();
        if (!p || p.uid !== user.uid || p.companyId !== data.companyId)
          throw forbidden("Proposta indisponível nesta sessão.");
        if (p.appliedAt) return { count: p.actions.length, alreadyApplied: true };
        if (p.expiresAt < Date.now())
          throw badRequest("A proposta expirou. Solicite uma nova análise.");
        const actions = WorkAnswer.shape.actions.parse(p.actions);
        const now = new Date().toISOString();
        actions.forEach((a, index) =>
          tx.create(companyRef.collection("tasks").doc(`assistant_${data.proposalId}_${index}`), {
            title: a.title,
            description: a.instructions,
            lastComment: `Fonte: ${a.source}\nTipo de prazo: ${a.deadlineBasis}. Proposta de IA confirmada pelo usuário.`,
            companyId: data.companyId,
            companyName: bounded(company.data()?.name, 240),
            responsibleName: a.responsibleName,
            dueDate: a.deadlineBasis === "plan" ? a.dueDate : "",
            deadlineBasis: a.deadlineBasis,
            status: "todo",
            priority: "medium",
            type: "vistoria",
            progress: 0,
            checklist: [
              {
                id: "evidence",
                text: "Registrar execução e verificar eficácia",
                checked: false,
                mandatory: true,
              },
            ],
            sourceType: "work-assistant",
            proposalId: data.proposalId,
            createdBy: user.uid,
            createdAt: now,
            updatedAt: now,
          })
        );
        tx.update(proposalRef, { appliedAt: now });
        return { count: actions.length, alreadyApplied: false };
      });
      return NextResponse.json(saved, { headers: privateHeaders });
    }
    if (!workAssistantConfigured())
      throw new AuthError("O assistente aguarda configuração da OpenAI pela administração.", 503);
    if (data.action === "chat" && data.messages.at(-1)?.role !== "user")
      throw badRequest("Envie uma nova mensagem.");
    // Durable per-user quota, independent of the number of runtime instances.
    const quotaRef = adminDb
      .collection("workAssistantUsage")
      .doc(createHash("sha256").update(user.uid).digest("hex"));
    await adminDb.runTransaction(async (tx) => {
      const previous = (await tx.get(quotaRef)).data(),
        now = Date.now();
      const current =
        previous && now - previous.startedAt < 60000 ? previous : { startedAt: now, count: 0 };
      if (current.count >= 10)
        throw new AuthError("Aguarde um minuto antes de enviar outra mensagem.", 429);
      tx.set(quotaRef, { startedAt: current.startedAt, count: current.count + 1 });
    });
    if (data.action === "probe") {
      await askWorkAssistant(
        [
          {
            role: "user",
            content:
              "Teste de conexão. Responda Conexão verificada e actions vazio. Não há dados de clientes nesta chamada.",
          },
        ],
        { diagnostic: true }
      );
      const checkedAt = new Date().toISOString();
      await quotaRef.set({ lastVerifiedAt: checkedAt }, { merge: true });
      return NextResponse.json({ verified: true, checkedAt }, { headers: privateHeaders });
    }
    const [documents, tasks] = await Promise.all([
      companyRef.collection("sourceDocuments").orderBy("createdAt", "desc").limit(51).get(),
      companyRef.collection("tasks").orderBy("dueDate", "asc").limit(201).get(),
    ]);
    const context = {
      company: { id: data.companyId, name: bounded(company.data()?.name, 240) },
      consultedAt: new Date().toISOString(),
      truncated: documents.size > 50 || tasks.size > 200,
      documents: documents.docs
        .slice(0, 50)
        .map((d) => ({ id: d.id, name: bounded(d.data().name, 240) })),
      tasks: tasks.docs.slice(0, 200).map((d) => {
        const t = d.data();
        return {
          id: d.id,
          title: bounded(t.title, 180),
          status: bounded(t.status, 30),
          dueDate: bounded(t.dueDate, 32),
          responsibleName: bounded(t.responsibleName, 180),
          instructions: bounded(t.description || t.lastComment, 1000),
        };
      }),
    };
    const answer = await askWorkAssistant(
      data.messages,
      {
        ...context,
        selectedKitBatch: data.kitSelection
          ? { count: data.kitSelection.employeeIds.length, available: true }
          : null,
      },
      data.kitSelection ? () => prepareKitBatch(user, data.companyId, data.kitSelection) : undefined
    );
    const proposalId = answer.actions.length ? randomUUID() : null;
    if (proposalId)
      await adminDb
        .collection("workAssistantProposals")
        .doc(proposalId)
        .create({
          uid: user.uid,
          companyId: data.companyId,
          actions: answer.actions,
          createdAt: new Date().toISOString(),
          expiresAt: Date.now() + 3600000,
        });
    return NextResponse.json({ ...answer, proposalId }, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
