import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { dashboardScope, isDashboardGlobal } from "@/lib/auth/dashboard-access";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { getAvpSnapshot } from "@/services/avp-sheet-sync";
import {
  summarizeTasks,
  summarizeAvp,
  type DashboardClient,
  type ExecutiveDashboard,
} from "@/lib/executive-dashboard";

// Only operational summaries leave this endpoint. No employee, clinical,
// financial account or company integration credentials are serialized.
export async function getExecutiveDashboard(
  user: AuthContext,
  requested: string
): Promise<ExecutiveDashboard> {
  const scope = dashboardScope(user, requested);
  const global = isDashboardGlobal(user);
  const now = new Date();
  const issues: string[] = [];
  const companyQuery = adminDb.collection("companies");
  const documents = global
    ? (await companyQuery.select("name", "city", "state", "active", "isDeleted").get()).docs
    : [await companyQuery.doc(scope!).get()];
  const clientsTruncated = false;
  const choices = documents
    .filter((d) => d.exists && d.data()?.isDeleted !== true)
    .map((d) => ({
      id: d.id,
      name: String(d.data()?.name || "Cliente sem nome"),
      location: [d.data()?.city, d.data()?.state].filter(Boolean).join(" / "),
      active: typeof d.data()?.active === "boolean" ? (d.data()!.active as boolean) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  // A scoped request never falls back to the global portfolio.
  let selected = scope ? choices.filter((c) => c.id === scope) : choices;
  if (scope && !selected.length && global) {
    const document = await companyQuery.doc(scope).get();
    if (document.exists && document.data()?.isDeleted !== true) {
      const data = document.data()!;
      const client = {
        id: scope,
        name: String(data.name || "Cliente sem nome"),
        location: [data.city, data.state].filter(Boolean).join(" / "),
        active: typeof data.active === "boolean" ? data.active : null,
      };
      choices.push(client);
      selected = [client];
    }
  }
  const clients: DashboardClient[] = [];
  // Bound concurrency and task payloads; an incomplete source is explicit.
  for (let i = 0; i < selected.length; i += 5) {
    const batch = await Promise.all(
      selected.slice(i, i + 5).map(async (company) => {
        const ref = companyQuery.doc(company.id);
        const reads = await Promise.allSettled([
          ref
            .collection("tasks")
            .select(
              "title",
              "status",
              "priority",
              "dueDate",
              "responsibleName",
              "sourceType",
              "isDeleted"
            )
            .limit(501)
            .get(),
          ref.collection("employees").count().get(),
          ref.collection("pgr_cards").count().get(),
          ref.collection("risks").where("assessmentStatus", "==", "pending").count().get(),
        ]);
        const [tasks, employees, pgr, risks] = reads;
        const sourceLabels = ["ações", "colaboradores", "PGRs", "avaliações de risco"];
        reads.forEach((r, n) => {
          if (r.status === "rejected")
            issues.push(`${company.name}: leitura de ${sourceLabels[n]} indisponível.`);
        });
        return {
          ...company,
          tasks:
            tasks.status === "fulfilled"
              ? summarizeTasks(
                  tasks.value.docs.slice(0, 500).map((d) => ({ id: d.id, data: d.data() })),
                  company,
                  now,
                  tasks.value.size > 500
                )
              : null,
          employees: employees.status === "fulfilled" ? employees.value.data().count : null,
          pgr: pgr.status === "fulfilled" ? pgr.value.data().count : null,
          risksToReview: risks.status === "fulfilled" ? risks.value.data().count : null,
        };
      })
    );
    clients.push(...batch);
  }
  let avp: ExecutiveDashboard["avp"] = null;
  let avpAvailable = false;
  if (!scope || scope === "GRUPO_AVP") {
    try {
      requireAvpAccess(user);
      avpAvailable = true;
    } catch {
      /* No AVP data for unauthorized profiles. */
    }
    if (avpAvailable) {
      try {
        const snapshot = await getAvpSnapshot();
        if (snapshot.revision)
          avp = summarizeAvp(
            snapshot.items,
            snapshot.checkedAt || null,
            snapshot.status || "UNKNOWN",
            now
          );
        else issues.push("AVP: nenhuma leitura da planilha foi concluída.");
      } catch {
        issues.push("AVP: não foi possível consultar a última leitura da planilha.");
      }
    }
  }
  if (clients.some((c) => c.tasks?.truncated))
    issues.push("Ações parciais: limite de 500 registros por cliente nesta consulta.");
  return {
    generatedAt: now.toISOString(),
    scope: scope || "all",
    choices: choices.map(({ id, name }) => ({ id, name })),
    clients,
    avp,
    avpAvailable,
    issues,
    clientsTruncated,
  };
}
