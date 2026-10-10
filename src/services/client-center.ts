import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { dashboardScope } from "@/lib/auth/dashboard-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { summarizeTasks } from "@/lib/executive-dashboard";
import {
  ClientRequestSchema,
  REQUEST_DEPARTMENTS,
  summarizePeriodics,
  type ClientCenterData,
} from "@/lib/client-center";

function companyScope(user: AuthContext, requested: string) {
  const scope = dashboardScope(user, requested);
  if (!scope) throw badRequest("Selecione um cliente para abrir sua central.");
  return scope;
}
async function companyRef(user: AuthContext, requested: string) {
  const scope = companyScope(user, requested);
  const ref = adminDb.collection("companies").doc(scope);
  const company = await ref.get();
  if (!company.exists || company.data()?.isDeleted === true)
    throw new AuthError("Cliente não encontrado.", 404);
  return { ref, company: { id: scope, name: String(company.data()?.name || "Cliente") } };
}
export async function getClientCenter(
  user: AuthContext,
  requested: string
): Promise<ClientCenterData> {
  const { ref, company } = await companyRef(user, requested);
  const now = new Date();
  const results = await Promise.allSettled([
    ref
      .collection("employees")
      .select("name", "department", "nextAsoDate", "status", "isDeleted", "active")
      .limit(2001)
      .get(),
    ref
      .collection("tasks")
      .select(
        "title",
        "status",
        "priority",
        "dueDate",
        "responsibleName",
        "sourceType",
        "department",
        "createdAt",
        "isDeleted"
      )
      .limit(1001)
      .get(),
    ref
      .collection("reports")
      .select("name", "type", "statusIA", "reviewStatus", "createdAt")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get(),
  ]);
  const [employees, tasks, reports] = results;
  const issues: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected")
      issues.push(
        [
          "Não foi possível consultar os prazos dos colaboradores.",
          "Não foi possível consultar ações e solicitações.",
          "Não foi possível consultar documentos.",
        ][i]
      );
  });
  const taskRecords =
    tasks.status === "fulfilled"
      ? tasks.value.docs.slice(0, 1000).map((d) => ({ id: d.id, data: d.data() }))
      : null;
  if (employees.status === "fulfilled" && employees.value.size > 2000)
    issues.push(
      "Visão parcial: limite de 2.000 colaboradores. Consulte o cadastro para os demais."
    );
  if (tasks.status === "fulfilled" && tasks.value.size > 1000)
    issues.push("Visão parcial: limite de 1.000 ações e solicitações.");
  return {
    company,
    generatedAt: now.toISOString(),
    issues,
    periodics:
      employees.status === "fulfilled"
        ? summarizePeriodics(
            employees.value.docs.slice(0, 2000).map((d) => ({ id: d.id, data: d.data() })),
            now,
            employees.value.size > 2000
          )
        : null,
    tasks: taskRecords
      ? summarizeTasks(
          taskRecords,
          company,
          now,
          tasks.status === "fulfilled" && tasks.value.size > 1000
        )
      : null,
    requests: taskRecords
      ? taskRecords
          .filter((r) => r.data.sourceType === "client_request" && r.data.isDeleted !== true)
          .map(({ id, data }) => ({
            id,
            title: String(data.title || "Solicitação"),
            department: String(data.department || "support"),
            status: String(data.status || "todo"),
            createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
            priority: String(data.priority || "medium"),
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : null,
    documents:
      reports.status === "fulfilled"
        ? reports.value.docs.map((d) => ({
            id: d.id,
            name: String(d.data().name || "Documento"),
            type: String(d.data().type || "SST"),
            status:
              d.data().reviewStatus === "pending"
                ? "Revisão pendente"
                : String(d.data().statusIA || "Sem análise"),
          }))
        : null,
  };
}
export async function createClientRequest(user: AuthContext, input: unknown) {
  const parsed = ClientRequestSchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Preencha departamento, assunto e descrição nos limites indicados.");
  const data = parsed.data;
  const { ref, company } = await companyRef(user, data.companyId);
  const task = ref.collection("tasks").doc(`portal_${data.requestId}`);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ ...data, companyId: company.id }))
    .digest("hex");
  await adminDb.runTransaction(async (tx) => {
    const old = await tx.get(task);
    if (old.exists) {
      if (old.data()?.createdBy !== user.uid || old.data()?.requestFingerprint !== fingerprint)
        throw new AuthError(
          "Protocolo já utilizado. Atualize a página para iniciar outra solicitação.",
          409
        );
      return;
    }
    tx.create(task, {
      title: data.title,
      description: data.description,
      department: data.department,
      companyId: company.id,
      companyName: company.name,
      priority: data.priority,
      status: "todo",
      type: "atendimento",
      dueDate: "",
      sourceType: "client_request",
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      responsibleName: REQUEST_DEPARTMENTS[data.department],
      requestFingerprint: fingerprint,
      checklist: [],
    });
  });
  return { id: task.id, status: "todo" };
}
