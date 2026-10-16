import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import {
  TallosError,
  requireTallosAccess,
  tallosRequest,
  items,
  string,
  pageNumber,
  dateRange,
  providerId,
  normalizeContact,
  normalizeReport,
  decryptHistory,
} from "@/lib/integrations/tallos-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const root = () => adminDb.collection("integrations").doc("rd-conversas");
// Existing rules deny browser reads/writes for webhook_deliveries. Outbound
// review snapshots must never be writable through the client Firestore SDK.
const drafts = () =>
  adminDb.collection("webhook_deliveries").doc("tallos-outbound").collection("drafts");
const rd = () => adminDb.collection("integrations").doc("rd-conversas-avp");
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
function failure(error: unknown) {
  if (error instanceof TallosError || error instanceof AuthError)
    return reply({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return reply({ error: "Confira os campos obrigatórios e os limites de texto." }, 400);
  return reply({ error: "A operação não foi concluída. Tente novamente." }, 500);
}
const docId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^/\u0000]+$/);
const contactId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireTallosAccess(user);
    const q = req.nextUrl.searchParams;
    const resource = q.get("resource") || "status";
    const page = pageNumber(q.get("page"));
    if (resource === "status") {
      await tallosRequest("/v2/employees");
      return reply({
        connected: true,
        checkedAt: new Date().toISOString(),
        historyKeyConfigured: !!process.env.TALLOS_HISTORY_PRIVATE_KEY,
        webhookConfigured:
          !!process.env.RD_CONVERSAS_WEBHOOK_SECRET && !!process.env.RD_CONVERSAS_AVP_PHONES,
      });
    }
    if (resource === "contacts") {
      const result = await tallosRequest("/v2/customers", { page: String(page), limit: "50" });
      const rows = items(result.data).map(normalizeContact);
      const links = rows.length
        ? await adminDb.getAll(...rows.map((c) => root().collection("links").doc(c.id)))
        : [];
      return reply({
        data: rows.map((c, i) => {
          const link = links[i]?.data();
          return {
            ...c,
            link: link
              ? {
                  companyId: string(link.companyId),
                  companyName: string(link.companyName),
                  employeeId: string(link.employeeId),
                  employeeName: string(link.employeeName),
                }
              : null,
          };
        }),
        page,
        total: result.total,
        pages: result.pages,
      });
    }
    if (resource === "operators") {
      const result = await tallosRequest("/v2/employees");
      return reply({
        data: items(result.data).map((r) => ({
          id: providerId(r._id ?? r.id),
          name:
            string(r.full_name ?? r.name)
              .trim()
              .toLocaleLowerCase("pt-BR") === "sonia mattar"
              ? "Operacional"
              : string(r.full_name ?? r.name),
          email: string(r.email),
        })),
      });
    }
    if (resource === "reports") {
      const dates = dateRange(q.get("start"), q.get("end"));
      const status = q.get("status") || "";
      if (status && !["opened", "closed"].includes(status))
        throw new TallosError(400, "Status inválido.");
      const result = await tallosRequest("/v4/reports", {
        ...dates,
        page: String(page),
        limit: "50",
        type: "operators",
        ...(status ? { status } : {}),
      });
      const data = items(result.data).map(normalizeReport);
      return reply({
        data,
        page,
        total: result.total,
        pages: result.pages,
        scope: "Página atual do período consultado",
        summary: {
          loaded: data.length,
          opened: data.filter((r) => r.status === "opened").length,
          closed: data.filter((r) => r.status === "closed").length,
          operators: new Set(data.map((r) => r.operator).filter(Boolean)).size,
        },
      });
    }
    if (resource === "history") {
      const id = providerId(q.get("contactId"));
      if (!process.env.TALLOS_HISTORY_PRIVATE_KEY)
        throw new TallosError(
          424,
          "O histórico completo requer plano Pro ou Advanced e configuração da chave privada Tallos. As mensagens recebidas pelo webhook continuam disponíveis na aba Operação ASO."
        );
      const result = await tallosRequest("/v2/messages/history", {
        customer_id: id,
        page: String(page),
        limit: "50",
        ...dateRange(q.get("start"), q.get("end")),
      });
      const data = items(decryptHistory(result.data, process.env.TALLOS_HISTORY_PRIVATE_KEY)).map(
        (r) => ({
          id: string(r._id ?? r.id),
          text: string(r.message ?? r.content ?? r.text, 16000),
          sentBy: string(r.sent_by),
          createdAt: string(r.created_at),
          type: string(r.type),
        })
      );
      return reply({ data, page, total: result.total, pages: result.pages });
    }
    if (resource === "operation") {
      const [messages, requests, diagnostics] = await Promise.all([
        rd().collection("messages").orderBy("receivedAt", "desc").limit(100).get(),
        rd().collection("asoRequests").orderBy("createdAt", "desc").limit(100).get(),
        adminDb
          .collection("webhook_deliveries")
          .doc("rd-conversas-diagnostics")
          .collection("outcomes")
          .orderBy("receivedAt", "desc")
          .limit(11)
          .get()
          .catch(() => null),
      ]);
      return reply({
        webhookDiagnostics:
          diagnostics?.docs.map((d) => {
            const r = d.data();
            return {
              id: d.id,
              code: string(r.code),
              status: String(r.status),
              receivedAt: string(r.receivedAt),
              fields: Array.isArray(r.fields)
                ? r.fields
                    .slice(0, 100)
                    .map((f) => string(f, 300))
                    .join("\n")
                : "",
            };
          }) ?? null,
        messages: messages.docs.map((d) => {
          const r = d.data();
          return {
            id: d.id,
            phone: string(r.phone, 40),
            text: string(r.text, 16000),
            receivedAt: string(r.receivedAt),
            status: string(r.status),
            asoRequestId: string(r.asoRequestId),
          };
        }),
        requests: requests.docs.map((d) => {
          const r = d.data();
          return {
            id: d.id,
            employeeName: string(r.employeeName),
            companyName: string(r.companyName),
            examType: string(r.examType),
            status: string(r.status),
            city: string(r.requestedCity),
            createdAt: string(r.createdAt),
          };
        }),
        limit: 100,
      });
    }
    if (resource === "directory") {
      const companyId = q.get("companyId");
      const after = q.get("after");
      const collection = companyId
        ? adminDb.collection("companies").doc(docId.parse(companyId)).collection("employees")
        : adminDb.collection("companies");
      let query = collection.orderBy("__name__").limit(100);
      if (after) query = query.startAfter(docId.parse(after));
      const snapshot = await query.get();
      return reply({
        data: snapshot.docs.map((d) => ({
          id: d.id,
          name: string(d.data().name ?? d.data().razaoSocial ?? d.data().companyName) || d.id,
        })),
        next: snapshot.size === 100 ? snapshot.docs.at(-1)?.id : null,
      });
    }
    throw new TallosError(400, "Recurso desconhecido.");
  } catch (error) {
    return failure(error);
  }
}

const payload = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("link"),
      contactId,
      companyId: docId,
      employeeId: docId.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("draft"),
      contactId,
      operatorId: contactId,
      message: z.string().trim().min(1).max(4000),
    })
    .strict(),
  z
    .object({
      action: z.literal("send"),
      draftId: docId,
      confirmation: z.literal("AUTORIZAR ENVIO"),
    })
    .strict(),
]);
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireTallosAccess(user);
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      throw new TallosError(415, "Envie JSON.");
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 20000) throw new TallosError(413, "Solicitação muito grande.");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new TallosError(400, "JSON inválido.");
    }
    const body = payload.parse(json);
    if (body.action === "link") {
      const company = await adminDb.collection("companies").doc(body.companyId).get();
      if (!company.exists) throw new TallosError(404, "Cliente NAI não encontrado.");
      const employee = body.employeeId
        ? await company.ref.collection("employees").doc(body.employeeId).get()
        : null;
      if (employee && !employee.exists)
        throw new TallosError(404, "Colaborador não pertence ao cliente selecionado.");
      const link = {
        companyId: company.id,
        companyName:
          string(
            company.data()?.name ?? company.data()?.razaoSocial ?? company.data()?.companyName
          ) || company.id,
        employeeId: employee?.id || "",
        employeeName: string(employee?.data()?.name),
        updatedBy: user.uid,
        updatedAt: new Date().toISOString(),
      };
      await root().collection("links").doc(body.contactId).set(link);
      return reply({ success: true, link });
    }
    if (body.action === "draft") {
      const ref = drafts().doc();
      const draft = {
        contactId: body.contactId,
        operatorId: body.operatorId,
        message: body.message,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 15 * 60 * 1000,
        status: "REVIEW_REQUIRED",
      };
      await ref.create(draft);
      return reply({ draftId: ref.id, ...draft });
    }
    const ref = drafts().doc(body.draftId);
    const draft = await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = snapshot.data();
      if (!data || data.createdBy !== user.uid)
        throw new TallosError(404, "Rascunho não encontrado.");
      if (data.status !== "REVIEW_REQUIRED")
        throw new TallosError(
          409,
          "Este rascunho já foi processado. Confira o Tallos antes de criar outro envio."
        );
      if (data.expiresAt < Date.now())
        throw new TallosError(409, "Rascunho expirado. Prepare e revise novamente.");
      tx.update(ref, {
        status: "SENDING",
        authorizedBy: user.uid,
        authorizedAt: new Date().toISOString(),
        reviewHash: createHash("sha256")
          .update(JSON.stringify([data.contactId, data.operatorId, data.message]))
          .digest("hex"),
      });
      return data;
    });
    try {
      await tallosRequest(
        `/v2/messages/${providerId(draft.contactId)}/send`,
        {},
        new URLSearchParams({
          message: draft.message,
          operator: draft.operatorId,
          sent_by: "operator",
        })
      );
      await ref.update({ status: "ACCEPTED", completedAt: new Date().toISOString() });
      return reply({
        success: true,
        status: "ACCEPTED",
        message: "Requisição aceita pelo Tallos. Confirme a entrega na plataforma.",
      });
    } catch {
      await ref.update({ status: "UNCONFIRMED", completedAt: new Date().toISOString() });
      throw new TallosError(
        502,
        "Envio sem confirmação. Confira o Tallos antes de tentar novamente; o sistema não repetirá este rascunho."
      );
    }
  } catch (error) {
    return failure(error);
  }
}
