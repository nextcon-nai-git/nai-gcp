import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { requireSocAccess, socConfiguration, SocError } from "@/lib/integrations/soc";
import { monitoredSocRead, socRuns } from "@/lib/integrations/soc-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
export async function GET(req: NextRequest) {
  try {
    requireSocAccess(await requireAuth(req));
    const q = req.nextUrl.searchParams;
    const resource = q.get("resource") || "status";
    if (resource === "status") return reply(socConfiguration());
    if (resource === "runs") {
      const snapshot = await socRuns().orderBy("startedAt", "desc").limit(50).get();
      return reply({ data: snapshot.docs.map((d) => d.data()) });
    }
    if (!["companies", "employees", "asos"].includes(resource))
      return reply({ error: "Recurso SOC inválido." }, 400);
    return reply(
      await monitoredSocRead(
        resource as "companies" | "employees" | "asos",
        {
          companyId: q.get("companyId") || undefined,
          start: q.get("start") || undefined,
          end: q.get("end") || undefined,
          employeeIds: q.get("employeeIds") || undefined,
        },
        "manual"
      )
    );
  } catch (error) {
    if (error instanceof SocError)
      return reply({ error: error.message, code: error.code }, error.status);
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    return reply(
      { error: "Não foi possível concluir a consulta SOC.", code: "INTERNAL_ERROR" },
      500
    );
  }
}
