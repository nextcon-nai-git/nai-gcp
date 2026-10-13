import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import {
  requireDeveloperPrincipal,
  requireScope,
  requireClient,
  handleApiGuardError,
  ApiGuardError,
} from "@/lib/developer-api-guard";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { limitedBytes, privateHeaders } from "@/lib/http/private-api";
import { isAccessDocumentId } from "@/services/access-control/materialize-access";
import { analyzeIncidentWithNormativeGrounding } from "@/services/ai/incident-investigation-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z
  .object({
    companyId: z.string().optional(),
    type: z.string().trim().min(1).max(120),
    description: z.string().trim().min(5).max(12000),
    location: z.string().trim().max(300).optional(),
    reporterId: z.string().trim().max(180).optional(),
    photoUrl: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      })
      .nullable()
      .optional(),
  })
  .strict();
const respond = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders });

/** Receive first; clinical and legal conclusions remain subject to professional review. */
export async function POST(req: NextRequest) {
  try {
    const principal = await requireDeveloperPrincipal(req);
    requireScope(principal, "incidents:write");
    let body: unknown;
    try {
      body = JSON.parse((await limitedBytes(req, 65536)).toString("utf8"));
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new ApiGuardError("Solicitação JSON inválida.", 400);
    }
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success)
      throw new ApiGuardError("Confira empresa, tipo e descrição do incidente.", 400);
    const input = parsed.data;
    const companyId = input.companyId ?? principal.clientId;
    if (!isAccessDocumentId(companyId))
      throw new ApiGuardError("Informe uma empresa válida. Chaves globais exigem companyId.", 400);
    requireClient(principal, companyId);
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey && !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey))
      throw new ApiGuardError(
        "Idempotency-Key deve ter 8 a 128 letras, números, hífens ou sublinhados.",
        400
      );
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ ...input, companyId }))
      .digest("hex");
    const incidentCollection = adminDb.collection("incidents");
    const ref = idempotencyKey
      ? incidentCollection.doc(
          createHash("sha256")
            .update(`${principal.id}:${companyId}:${idempotencyKey}`)
            .digest("hex")
        )
      : incidentCollection.doc();
    const created = await adminDb.runTransaction(async (tx) => {
      const previous = await tx.get(ref);
      if (previous.exists) {
        if (
          previous.data()?.requestHash !== requestHash ||
          previous.data()?.recordedByApiKey !== principal.id
        )
          throw new ApiGuardError("Idempotency-Key já utilizada por outro conteúdo.", 409);
        return false;
      }
      const company = await tx.get(adminDb.collection("companies").doc(companyId));
      if (!company.exists || company.data()?.isDeleted === true)
        throw new ApiGuardError("Empresa não encontrada.", 404);
      tx.create(ref, {
        companyId,
        type: input.type,
        description: input.description,
        photoUrl: input.photoUrl || null,
        location: input.location || "Não informado",
        reporterId: principal.id,
        reportedBy: input.reporterId || null,
        recordedByApiKey: principal.id,
        requestHash,
        source: "API_M2M",
        status: "PROTOCOLADO",
        analysisStatus: "PENDING_REVIEW",
        createdAt: new Date().toISOString(),
        serverTimestamp: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!created)
      return respond({
        success: true,
        incidentId: ref.id,
        status: "PROTOCOLADO",
        replayed: true,
        reviewRequired: true,
        message: "Incidente já recebido. O registro anterior foi preservado.",
      });

    try {
      const opinion = await analyzeIncidentWithNormativeGrounding(
        ref.id,
        companyId,
        input.description,
        {
          location: input.location,
          photoUrl: input.photoUrl || undefined,
        }
      );
      // Suggestions do not establish leave, severity, CAT deadlines or a signed medical decision.
      const technicalOpinion = JSON.parse(JSON.stringify(opinion));
      const batch = adminDb.batch();
      batch.update(ref, {
        status: "EM_ANALISE",
        analysisStatus: "PENDING_ENGINEER_REVIEW",
        technicalOpinion,
      });
      batch.create(adminDb.collection("ai_technical_decisions").doc(), {
        decisionType: "INCIDENT_INVESTIGATION",
        incidentId: ref.id,
        companyId,
        opinion: technicalOpinion,
        immutableDigest: opinion.immutableDigest,
        status: "PENDING_ENGINEER_REVIEW",
        recordedByApiKey: principal.id,
        createdAt: new Date().toISOString(),
        serverTimestamp: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return respond(
        {
          success: true,
          incidentId: ref.id,
          status: "PENDING_ENGINEER_REVIEW",
          technicalOpinion,
          reviewRequired: true,
          message: "Incidente protocolado. Sugestões da análise aguardam revisão profissional.",
        },
        201
      );
    } catch {
      // Intake already committed. Report that receipt accurately so a failed AI call
      // does not encourage duplicate incident creation on retry.
      return respond(
        {
          success: true,
          incidentId: ref.id,
          status: "PROTOCOLADO",
          reviewRequired: true,
          analysisAvailable: false,
          message:
            "Incidente recebido. A análise automática não foi concluída; encaminhe para revisão profissional.",
        },
        202
      );
    }
  } catch (error) {
    const response =
      error instanceof AuthError ? handleAuthError(error) : handleApiGuardError(error);
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    return response;
  }
}
