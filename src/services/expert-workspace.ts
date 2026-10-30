import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { badRequest, forbidden } from "@/lib/auth/errors";
import {
  EXPERT_ROLE,
  expertCompanyIds,
  projectExpertCompany,
  projectExpertTask,
} from "@/lib/expert-workspace";

export async function readExpertWorkspace(user: AuthContext, requested: string | null) {
  if (user.role !== EXPERT_ROLE) throw forbidden();
  const profileRef = adminDb.collection("users").doc(user.uid);
  // Recheck the stored grant and its current provider association on every read.
  const profile = (await profileRef.get()).data();
  if (
    profile?.role !== EXPERT_ROLE ||
    profile.accessEnabled !== true ||
    typeof profile.providerId !== "string"
  )
    throw forbidden();
  const provider = (await adminDb.collection("providers").doc(profile.providerId).get()).data();
  if (
    !provider ||
    provider.isDeleted === true ||
    provider.accessUid !== user.uid ||
    typeof provider.email !== "string" ||
    provider.email.toLowerCase().trim() !== user.email.toLowerCase().trim()
  )
    throw forbidden();
  const linked = expertCompanyIds(provider.servedCompanies);
  const allowed = expertCompanyIds(profile.servedCompanies).filter((id) => linked.includes(id));
  if (!allowed.length || allowed.length > 30)
    throw forbidden("Nenhuma unidade liberada para este acesso.");
  if (requested !== null && !allowed.includes(requested))
    throw forbidden("Unidade não autorizada.");
  const docs = await Promise.all(
    allowed.map((id) => adminDb.collection("companies").doc(id).get())
  );
  const companies = docs
    .filter((d) => d.exists && d.data()?.isDeleted !== true)
    .map((d) => projectExpertCompany(d.id, d.data()!));
  const companyId = requested ?? companies[0]?.id ?? null;
  if (companyId && !companies.some((c) => c.id === companyId))
    throw badRequest("Unidade indisponível.");
  const snapshot = companyId
    ? await adminDb.collection("companies").doc(companyId).collection("tasks").limit(501).get()
    : null;
  const tasks = (snapshot?.docs || [])
    .slice(0, 500)
    .filter(
      (d) =>
        d.data().isDeleted !== true && (!d.data().companyId || d.data().companyId === companyId)
    )
    .map((d) => projectExpertTask(d.id, d.data()))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
  // Do not return a result if a grant was revoked while the query was running.
  const current = (await profileRef.get()).data();
  const latestProvider = (
    await adminDb.collection("providers").doc(profile.providerId).get()
  ).data();
  if (
    current?.role !== EXPERT_ROLE ||
    current.accessEnabled !== true ||
    current.providerId !== profile.providerId ||
    JSON.stringify(expertCompanyIds(current.servedCompanies)) !==
      JSON.stringify(expertCompanyIds(profile.servedCompanies)) ||
    latestProvider?.accessUid !== user.uid ||
    latestProvider?.isDeleted === true ||
    latestProvider?.email !== provider.email ||
    JSON.stringify(expertCompanyIds(latestProvider?.servedCompanies)) !== JSON.stringify(linked)
  )
    throw forbidden("A liberação mudou. Atualize sua sessão.");
  return { companies, companyId, tasks, truncated: (snapshot?.size || 0) > 500 };
}
