import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAuth, extractBearerToken } from "@/lib/auth/require-auth";
import { AuthError, forbidden, badRequest } from "@/lib/auth/errors";
import { canManageRdAso } from "@/lib/integrations/rd-aso-request";
import {
  clinicalSchema,
  inviteSchema,
  portalId,
  portalView,
  grantFor,
  type PortalRecord,
} from "@/lib/clinic-portal/schema";
import type { AsoRequest } from "@/types/aso-scheduler-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const collection = () => adminDb.collection("clinic_portal_private");

export async function POST(request: NextRequest) {
  if (process.env.CLINIC_PORTAL_ENABLED !== "true")
    return json(
      {
        error:
          "Portal em preparação. A ativação depende da publicação das regras de acesso restrito.",
      },
      503
    );
  try {
    const raw = await request.text();
    if (raw.length > 700000) throw badRequest("Conteúdo muito grande.");
    const body = z
      .object({
        action: z.enum(["invite", "status", "revoke", "read", "confirm", "save", "submit"]),
        id: portalId.optional(),
        payload: z.unknown().optional(),
        version: z.number().int().min(0).optional(),
        reviewed: z.boolean().optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
    if (body.action === "submit" && body.reviewed !== true)
      throw badRequest("Confirme a revisão médica antes de enviar para assinatura.");
    if (["invite", "status", "revoke"].includes(body.action)) {
      const user = await requireAuth(request);
      if (!["SUPER_ADMIN", "ADMIN", "OPERATIONS", "DOCTOR", "HR", "RH"].includes(user.role))
        throw forbidden();
      if (body.action === "invite") {
        const input = inviteSchema.parse(body.payload);
        const source = input.requestId.startsWith("rd-")
          ? adminDb
              .collection("integrations")
              .doc("rd-conversas-avp")
              .collection("asoRequests")
              .doc(input.requestId)
          : adminDb
              .collection("users")
              .doc(user.uid)
              .collection("asoRequests")
              .doc(input.requestId);
        if (input.requestId.startsWith("rd-") && (!canManageRdAso(user.role) || user.tenantId))
          throw forbidden();
        const id = randomBytes(24).toString("hex");
        const at = new Date().toISOString();
        await adminDb.runTransaction(async (tx) => {
          const snapshot = await tx.get(source);
          if (!snapshot.exists) throw badRequest("Pedido não encontrado.");
          const aso = snapshot.data() as AsoRequest & { clinicPortalId?: string };
          if (
            !aso.employeeName ||
            !aso.companyName ||
            !aso.cpf ||
            !aso.cnpj ||
            !aso.roleTitle ||
            !aso.exams?.length
          )
            throw badRequest(
              "Complete colaborador, empresa, CPF, CNPJ, cargo e exames antes do convite."
            );
          if (aso.clinicPortalId) {
            const previous = collection().doc(aso.clinicPortalId);
            const existing = await tx.get(previous);
            if (existing.exists && existing.data()?.ownerUid !== user.uid) throw forbidden();
            if (existing.exists) tx.update(previous, { revoked: true, updatedAt: at });
          }
          const record: PortalRecord = {
            ownerUid: user.uid,
            sourcePath: source.path,
            requestId: input.requestId,
            clinicName: input.clinicName,
            doctorName: input.doctorName,
            crm: input.crm,
            uf: input.uf,
            grants: [
              { email: input.doctorEmail.toLowerCase(), role: "doctor" },
              ...(input.receptionEmail
                ? [{ email: input.receptionEmail.toLowerCase(), role: "reception" as const }]
                : []),
            ],
            expiresAt: new Date(Date.now() + input.days * 86400000).toISOString(),
            revoked: false,
            version: 0,
            state: "invited",
            createdAt: at,
            updatedAt: at,
            identity: {
              companyName: aso.companyName,
              cnpj: aso.cnpj,
              employeeName: aso.employeeName,
              cpf: aso.cpf,
              roleTitle: aso.roleTitle,
              department: aso.department || "",
              examType: aso.examType,
            },
            exams: aso.exams.map((e) => ({ code: e.code, name: e.name })),
            risks: aso.declaredRisks || [],
            audit: [{ action: "invited", uid: user.uid, at }],
          };
          tx.create(collection().doc(id), record);
          tx.update(source, { clinicPortalId: id, clinicPortalStatus: "invited", updatedAt: at });
        });
        return json({ id, path: `/portal-clinica/${id}` });
      }
      if (!body.id) throw badRequest();
      const ref = collection().doc(body.id);
      return await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const record = snap.data() as PortalRecord | undefined;
        if (!record || record.ownerUid !== user.uid) throw forbidden();
        if (body.action === "revoke") {
          const at = new Date().toISOString();
          tx.update(ref, { revoked: true, updatedAt: at });
          tx.create(ref.collection("events").doc(), { action: "revoked", uid: user.uid, at });
        }
        return json({
          documentReceived: Boolean(record.signedDocument),
          state: record.state,
          revoked: body.action === "revoke" || record.revoked,
          expiresAt: record.expiresAt,
        });
      });
    }
    if (!body.id) throw badRequest();
    const token = extractBearerToken(request);
    if (!token) throw new AuthError("Entre com a conta convidada.");
    let identity;
    try {
      identity = await adminAuth.verifyIdToken(token, true);
    } catch {
      throw new AuthError("Sessão inválida. Entre novamente.");
    }
    const ref = collection().doc(body.id);
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const record = snap.data() as PortalRecord | undefined;
      const grant = record && grantFor(record, identity);
      if (!record || !grant)
        throw forbidden(
          "Convite indisponível para esta conta. Verifique o e-mail, a confirmação da conta e a validade do convite."
        );
      const at = new Date().toISOString();
      const grants = record.grants.map((g) => (g === grant ? { ...g, uid: identity.uid } : g));
      if (body.action === "read") {
        tx.update(ref, { grants });
        tx.create(ref.collection("events").doc(), {
          action: "read",
          uid: identity.uid,
          role: grant.role,
          at,
        });
        return json(portalView(record, grant.role));
      }
      if (body.action === "confirm" && record.state !== "invited")
        return json(portalView(record, grant.role));
      if (body.version !== record.version)
        return json(
          { error: "O atendimento foi atualizado em outra janela. Recarregue antes de salvar." },
          409
        );
      if (record.state === "awaiting_signature")
        throw badRequest("Atendimento enviado para assinatura; edição bloqueada.");
      let state: PortalRecord["state"] = record.state;
      const changes: Partial<PortalRecord> = {
        grants,
        updatedAt: at,
        version: record.version + 1,
      };
      if (body.action === "confirm") {
        state = record.state === "invited" ? "confirmed" : record.state;
      } else {
        if (grant.role !== "doctor") throw forbidden();
        const clinical = clinicalSchema.parse(body.payload);
        if (
          body.action === "submit" &&
          (clinical.conclusion === "pendente" || !clinical.physicalExam || !clinical.results)
        )
          throw badRequest(
            "Preencha exame físico, resultados e conclusão antes de enviar para assinatura."
          );
        changes.clinical = clinical;
        state = body.action === "submit" ? "awaiting_signature" : "draft";
      }
      changes.state = state;
      tx.update(ref, changes);
      // Operational source stores status only; clinical findings never enter the shared scheduler.
      tx.update(adminDb.doc(record.sourcePath), { clinicPortalStatus: state, updatedAt: at });
      tx.create(ref.collection("events").doc(), {
        action: body.action,
        uid: identity.uid,
        role: grant.role,
        at,
        version: record.version + 1,
        ...(body.action === "submit" ? { reviewed: true } : {}),
      });
      return json(portalView({ ...record, ...changes } as PortalRecord, grant.role));
    });
  } catch (error) {
    if (error instanceof AuthError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Dados inválidos. Confira os campos obrigatórios." }, 400);
    return json({ error: "Não foi possível concluir. Tente novamente." }, 500);
  }
}
