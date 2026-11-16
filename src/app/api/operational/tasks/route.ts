import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { parseClaims } from "@/lib/auth/claims";
import { badRequest, forbidden } from "@/lib/auth/errors";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { canReadDossierTask, isBritaniaFapAdmin } from "@/lib/auth/britania-fap-access";
import { BRITANIA_ANCHOR } from "@/lib/britania-group";

async function scopeFor(request: NextRequest, requested: string) {
  const actor = await requireAuth(request);
  const profile = (await adminDb.collection("users").doc(actor.uid).get()).data();
  if (!profile || profile.accessEnabled === false || profile.isDeleted === true) throw forbidden();
  const claims = parseClaims(profile);
  if (["GUEST", "SCOPED_PROVIDER"].includes(claims.role)) throw forbidden();
  const global =
    claims.role === "SUPER_ADMIN" ||
    (["ADMIN", "OPERATIONS"].includes(claims.role) &&
      !profile.tenantId &&
      (!profile.companyId || profile.companyId === "nextcon"));
  const assigned = [
    ...new Set(
      [claims.tenantId, ...(claims.role === "PROVIDER" ? claims.servedCompanies || [] : [])].filter(
        (id): id is string =>
          !!id &&
          id.length <= 128 &&
          !id.includes("/") &&
          ![".", "..", "all", "unauthorized"].includes(id)
      )
    ),
  ].sort();
  if (requested === "all" && !global) throw forbidden();
  if (requested === BRITANIA_ANCHOR && !global && !assigned.includes(requested)) throw forbidden();
  return { uid: actor.uid, global, assigned, dossier: isBritaniaFapAdmin(claims), claims };
}

// These boards include historical consolidated cards stored beside ordinary
// site tasks. Restrict by the trusted parent path before serializing any fields.
export async function GET(request: NextRequest) {
  try {
    const requested = request.nextUrl.searchParams.get("company") || "";
    if (!["all", "assigned", BRITANIA_ANCHOR].includes(requested))
      throw badRequest("Carteira inválida.");
    const recent = request.nextUrl.searchParams.get("order") === "recent";
    const scope = await scopeFor(request, requested);
    const sources =
      requested === "all"
        ? [adminDb.collectionGroup("tasks")]
        : (requested === "assigned" ? scope.assigned : [requested]).map((id) =>
            adminDb.collection("companies").doc(id).collection("tasks")
          );
    const lists = await Promise.all(
      sources.map(async (source) => {
        const ordered = source.orderBy(recent ? "createdAt" : "dueDate", recent ? "desc" : "asc");
        const visible: Record<string, unknown>[] = [];
        // Fetch the next page if private records occupy the first fifty slots.
        let page = await (recent ? ordered.limit(50) : ordered).get();
        while (true) {
          for (const d of page.docs) {
            const parts = d.ref.path.split("/");
            if (
              parts.length === 4 &&
              parts[0] === "companies" &&
              parts[2] === "tasks" &&
              canReadDossierTask(scope.claims, parts[1], d.id)
            )
              visible.push({ ...d.data(), id: d.id, companyId: parts[1] });
          }
          if (!recent || visible.length >= 50 || page.size < 50) break;
          page = await ordered
            .startAfter(page.docs[page.size - 1])
            .limit(50)
            .get();
        }
        return recent ? visible.slice(0, 50) : visible;
      })
    );
    const latest = await scopeFor(request, requested);
    if (
      latest.uid !== scope.uid ||
      latest.dossier !== scope.dossier ||
      latest.global !== scope.global ||
      JSON.stringify(latest.assigned) !== JSON.stringify(scope.assigned)
    )
      throw forbidden("A carteira mudou. Atualize o quadro.");
    const tasks = lists.flat();
    if (lists.length > 1)
      tasks.sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
    return NextResponse.json({ tasks }, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
