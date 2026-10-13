import { NextRequest, NextResponse } from "next/server";
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
import {
  accessToday,
  isAccessDocumentId,
  syncMaterializedAccessRecord,
} from "@/services/access-control/materialize-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Authorize M2M access against the current employee record, never a stale cached decision. */
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const principal = await requireDeveloperPrincipal(req);
    requireScope(principal, "access_control:read");
    let body: Record<string, unknown>;
    try {
      const input: unknown = JSON.parse((await limitedBytes(req, 8192)).toString("utf8"));
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
      body = input as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new ApiGuardError("Solicitação JSON inválida.", 400);
    }
    if (
      (body.badgeCode !== undefined && typeof body.badgeCode !== "string") ||
      (body.cpf !== undefined && typeof body.cpf !== "string")
    )
      throw new ApiGuardError("Informe crachá ou CPF como texto.", 400);
    const badge = typeof body.badgeCode === "string" ? body.badgeCode.trim() : "";
    const cpf = typeof body.cpf === "string" ? body.cpf.replace(/\D/g, "") : "";
    if ((!badge && !cpf) || (badge && !isAccessDocumentId(badge)) || (cpf && !/^\d{11}$/.test(cpf)))
      throw new ApiGuardError("Informe um crachá válido ou CPF completo.", 400);
    const companyId = body.companyId ?? principal.clientId;
    if (!isAccessDocumentId(companyId))
      throw new ApiGuardError(
        "Informe a empresa do atendimento. Chaves globais exigem companyId.",
        400
      );
    requireClient(principal, companyId);

    const employees = adminDb.collection("companies").doc(companyId).collection("employees");
    const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    const snapshot = await (
      badge
        ? employees.where("badgeCode", "==", badge)
        : employees.where("cpf", "in", [cpf, formattedCpf])
    )
      .select(
        "name",
        "companyId",
        "cpf",
        "badgeCode",
        "status",
        "active",
        "isArchived",
        "isDeleted",
        "fitnessStatus",
        "nextAsoDate",
        "requiredNrs",
        "trainings",
        "completedNrs"
      )
      .limit(2)
      .get();
    const respond = (data: Record<string, unknown>) =>
      NextResponse.json(
        { ...data, timestamp: new Date().toISOString() },
        {
          headers: {
            ...privateHeaders,
            "X-Response-Time": `${Date.now() - start}ms`,
            "X-NAI-Index-Hit": "REVALIDATED",
          },
        }
      );
    if (snapshot.size !== 1)
      return respond({
        allowed: false,
        reason: snapshot.empty
          ? "Colaborador não localizado no cadastro da empresa."
          : "Identificação duplicada. Revise o cadastro antes de liberar o acesso.",
      });
    const employee = snapshot.docs[0];
    const data = employee.data();
    if (
      (data.companyId && data.companyId !== companyId) ||
      (badge && data.badgeCode !== badge) ||
      (cpf && (typeof data.cpf !== "string" || data.cpf.replace(/\D/g, "") !== cpf))
    )
      return respond({
        allowed: false,
        reason: "Os identificadores informados não correspondem ao mesmo colaborador da empresa.",
      });

    const record = await syncMaterializedAccessRecord(companyId, { ...data, id: employee.id });
    const shared = { employeeName: record.employeeName, asoDueDate: record.asoValidUntil };
    if (record.status !== "ACTIVE")
      return respond({
        ...shared,
        allowed: false,
        reason: "Cadastro ou aptidão ocupacional não liberados. Solicite revisão ao responsável.",
        asoStatus: "MISSING",
      });
    if (!record.asoValidUntil || record.asoValidUntil < accessToday())
      return respond({
        ...shared,
        allowed: false,
        reason: "Validade de ASO ausente, inválida ou vencida.",
        asoStatus: record.asoValidUntil ? "EXPIRED" : "MISSING",
      });
    if (
      record.missingNrs.length ||
      (record.trainingValidUntil && record.trainingValidUntil < accessToday())
    )
      return respond({
        ...shared,
        allowed: false,
        reason: "Treinamentos obrigatórios pendentes, inválidos ou vencidos.",
        asoStatus: "VALID",
        missingNrs: record.missingNrs,
      });
    return respond({
      ...shared,
      allowed: true,
      reason: "Cadastro ativo, aptidão e prazos verificados no registro atual.",
      asoStatus: "VALID",
    });
  } catch (error) {
    const response =
      error instanceof AuthError ? handleAuthError(error) : handleApiGuardError(error);
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    return response;
  }
}
