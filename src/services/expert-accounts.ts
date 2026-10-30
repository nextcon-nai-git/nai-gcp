import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { EXPERT_ROLE, expertCompanyIds, projectExpertCompany } from "@/lib/expert-workspace";

function requireAdmin(user: AuthContext) {
  if (user.role !== "SUPER_ADMIN") throw forbidden();
}
export function expertProviderSource(id: string, data: Record<string, unknown>) {
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 150) : "";
  const companyIds = expertCompanyIds(data.servedCompanies).sort();
  if (
    data.isDeleted === true ||
    (data.active !== true && data.accessReviewStatus !== "confirmed") ||
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /(^seu@email\.com\.br$|@prestador\.nai\.com\.br$|@nextconsaude\.com\.br$)/i.test(email) ||
    !companyIds.length ||
    companyIds.length > 30
  )
    throw badRequest("Confira o nome, e-mail e vínculos do cadastro antes de liberar o acesso.");
  const accessUid = typeof data.accessUid === "string" ? data.accessUid : "";
  const revision = createHash("sha256")
    .update(JSON.stringify({ id, name, email, companyIds, accessUid }))
    .digest("hex");
  return { id, name, email, companyIds, accessUid, revision };
}
function validateId(id: string) {
  if (!id || id.length > 128 || /[\/\u0000]/.test(id)) throw badRequest("Prestador inválido.");
}
export async function listExpertAccounts(user: AuthContext) {
  requireAdmin(user);
  const [providers, companies] = await Promise.all([
    adminDb.collection("providers").limit(1001).get(),
    adminDb.collection("companies").limit(1001).get(),
  ]);
  if (providers.size > 1000 || companies.size > 1000)
    throw new AuthError(
      "A base excede o limite desta revisão. Abra os prestadores individualmente.",
      409
    );
  const units = new Map(
    companies.docs
      .filter((d) => d.data().isDeleted !== true)
      .map((d) => [d.id, projectExpertCompany(d.id, d.data())])
  );
  return {
    providers: providers.docs
      .filter((d) => d.data().isDeleted !== true)
      .map((d) => {
        const data = d.data();
        try {
          const source = expertProviderSource(d.id, data);
          if (data.active !== true && data.accessReviewStatus !== "confirmed")
            throw badRequest(
              "Cadastro profissional inativo ou pendente. Confirme a relação atual antes de liberar acesso."
            );
          const linked = source.companyIds.map((id) => units.get(id));
          if (linked.some((c) => !c)) throw badRequest("Vínculo de unidade indisponível.");
          return { ...source, companies: linked, ready: true, reason: "" };
        } catch (error) {
          return {
            id: d.id,
            name: String(data.name || ""),
            email: String(data.email || ""),
            revision: "",
            accessUid: "",
            companyIds: [],
            companies: [],
            ready: false,
            reason: error instanceof AuthError ? error.message : "Revise o cadastro.",
          };
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export async function previewExpertAccount(user: AuthContext, providerId: string) {
  requireAdmin(user);
  validateId(providerId);
  const data = (await adminDb.collection("providers").doc(providerId).get()).data();
  if (!data) throw new AuthError("Cadastro não encontrado.", 404);
  const source = expertProviderSource(providerId, data);
  const companies = await Promise.all(
    source.companyIds.map(async (id) => {
      const d = await adminDb.collection("companies").doc(id).get();
      if (!d.exists || d.data()?.isDeleted === true)
        throw badRequest("Um vínculo está indisponível. Revise o cadastro.");
      return projectExpertCompany(d.id, d.data()!);
    })
  );
  return { ...source, companies };
}
export async function createExpertAccount(
  user: AuthContext,
  input: { providerId: string; revision: string; password: string }
) {
  requireAdmin(user);
  if (
    !input ||
    typeof input.providerId !== "string" ||
    typeof input.revision !== "string" ||
    typeof input.password !== "string" ||
    input.password.length < 8 ||
    input.password.length > 128
  )
    throw badRequest("Informe o prestador revisado e uma senha inicial de 8 a 128 caracteres.");
  const source = await previewExpertAccount(user, input.providerId);
  if (source.revision !== input.revision)
    throw new AuthError("O cadastro mudou. Atualize a revisão.", 409);
  // Do not reset credentials, adopt an unrelated account or overwrite a role.
  try {
    const existing = await adminAuth.getUserByEmail(source.email);
    const profile = (await adminDb.collection("users").doc(existing.uid).get()).data();
    if (
      profile?.role === EXPERT_ROLE &&
      profile.providerId === source.id &&
      source.accessUid === existing.uid &&
      profile.accessEnabled === true &&
      !existing.disabled
    )
      return { created: false, alreadyExists: true, email: source.email };
    throw new AuthError(
      "Este e-mail já possui uma conta. A revisão administrativa deve ser feita sem sobrescrever senha ou perfil.",
      409
    );
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ))
      throw error;
  }
  if (source.accessUid)
    throw new AuthError("O cadastro já possui um vínculo de acesso. Revise antes de alterar.", 409);
  // A partially failed operation leaves the new account disabled, never privileged.
  const account = await adminAuth.createUser({
    email: source.email,
    displayName: source.name,
    password: input.password,
    disabled: true,
  });
  await adminDb.runTransaction(async (tx) => {
    const providerRef = adminDb.collection("providers").doc(source.id);
    const provider = await tx.get(providerRef);
    if (
      !provider.exists ||
      expertProviderSource(source.id, provider.data()!).revision !== source.revision
    )
      throw new AuthError("Os vínculos mudaram. A conta ficou desabilitada para revisão.", 409);
    const profileRef = adminDb.collection("users").doc(account.uid);
    if ((await tx.get(profileRef)).exists)
      throw new AuthError("Perfil já existente. Nenhum perfil foi substituído.", 409);
    for (const id of source.companyIds) {
      const company = await tx.get(adminDb.collection("companies").doc(id));
      if (!company.exists || company.data()?.isDeleted === true)
        throw new AuthError("Uma unidade foi removida. A conta permanece desabilitada.", 409);
    }
    tx.create(profileRef, {
      id: account.uid,
      name: source.name,
      email: source.email,
      role: EXPERT_ROLE,
      providerId: source.id,
      servedCompanies: source.companyIds,
      permissions: [],
      accessEnabled: true,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(providerRef, { accessUid: account.uid, updatedAt: FieldValue.serverTimestamp() });
    tx.create(adminDb.collection("expert_access_audit").doc(), {
      action: "CREATE_READ_ONLY_EXPERT_ACCESS",
      actorUid: user.uid,
      targetUid: account.uid,
      providerId: source.id,
      companyIds: source.companyIds,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  await adminAuth.updateUser(account.uid, { disabled: false });
  return { created: true, alreadyExists: false, email: source.email };
}
