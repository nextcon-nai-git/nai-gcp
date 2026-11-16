import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { limitedJson, privateHeaders } from "@/lib/http/private-api";
import { brasiliaDay, canRecordClockPunch, eligibleCltEmployee } from "@/lib/time-tracking";

const segment = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((id) => !/[\/\\\u0000-\u001f]/.test(id) && ![".", "..", "unauthorized"].includes(id));
const input = z
  .object({
    companyId: segment,
    employeeId: segment,
    type: z.enum(["entrada", "almoco_saida", "almoco_retorno", "saida"]),
  })
  .strict();
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    const parsed = input.safeParse(await limitedJson(request, 2048));
    if (!parsed.success) throw badRequest("Informe empresa, colaborador e tipo de batida válidos.");
    const { companyId, employeeId, type } = parsed.data;
    const now = new Date(),
      date = brasiliaDay(now);
    const time = now.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const punch = {
      id: date + "_" + type,
      type,
      date,
      time,
      timestamp: now.toISOString(),
      reference: randomUUID(),
    };
    const company = companyId === "all" ? null : adminDb.collection("companies").doc(companyId);
    const worker = (
      company ? company.collection("employees") : adminDb.collection("nxc_employees")
    ).doc(employeeId);
    const entry = worker.collection("time_clock_entries").doc(punch.id);
    await adminDb.runTransaction(async (tx) => {
      const profile = (await tx.get(adminDb.collection("users").doc(actor.uid))).data();
      if (!profile || !canRecordClockPunch(profile, companyId)) throw forbidden();
      if (company) {
        const parent = (await tx.get(company)).data();
        if (!parent || parent.isDeleted || parent.active === false)
          throw badRequest("Empresa indisponível.");
      }
      const employee = (await tx.get(worker)).data();
      if (
        !employee ||
        !eligibleCltEmployee({ ...employee, id: employeeId, name: employee.name }) ||
        (company && employee.companyId && employee.companyId !== companyId)
      )
        throw badRequest("Selecione um colaborador CLT ativo da empresa.");
      if ((await tx.get(entry)).exists) throw new AuthError("Batida já registrada.", 409);
      tx.create(entry, {
        ...punch,
        employeeId,
        employeeName: employee.name,
        employeeCpf: employee.cpf || "",
        contractType: "CLT",
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ punch }, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof AuthError ? error.message : "Não foi possível registrar o ponto." },
      { status: error instanceof AuthError ? error.status : 503, headers: privateHeaders }
    );
  }
}
