import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { STAFF_ACCESS_ROLES, type AccessSubjectKind } from "@/lib/user-access-policy";
import { expertCompanyIds } from "@/lib/expert-workspace";

const conflict = (message: string) => new AuthError(message, 409);
const stamp = () => FieldValue.serverTimestamp();
function requireAdmin(actor: AuthContext) {
  if (actor.role !== "SUPER_ADMIN") throw forbidden();
}
function identity(kind: unknown, id: unknown) {
  if (
    !["provider", "employee"].includes(String(kind)) ||
    typeof id !== "string" ||
    !id ||
    id.length > 128 ||
    /[\/\u0000]/.test(id) ||
    [".", ".."].includes(id)
  )
    throw badRequest("Cadastro inválido.");
  return {
    kind: kind as AccessSubjectKind,
    id,
    collection: kind === "provider" ? "providers" : "nxc_employees",
  };
}
function source(data: Record<string, unknown>, kind: AccessSubjectKind) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const active =
    data.isDeleted !== true &&
    (kind === "provider"
      ? data.active === true || data.accessReviewStatus === "confirmed"
      : data.status === "ATIVO");
  const accessUid = typeof data.accessUid === "string" ? data.accessUid : "";
  const companyIds = kind === "provider" ? expertCompanyIds(data.servedCompanies).sort() : [];
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        name,
        email,
        active,
        accessUid,
        companyIds,
        version: data.accessVersion || 0,
      })
    )
    .digest("hex");
  return { name, email, active, accessUid, companyIds, revision };
}
function eligible(s: ReturnType<typeof source>) {
  if (
    !s.active ||
    !s.name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email) ||
    /(^seu@email\.com\.br$|@prestador\.nai\.com\.br$)/i.test(s.email)
  )
    throw badRequest("Confirme nome, e-mail real e situação ativa no cadastro.");
}
function linked(profile: Record<string, unknown> | undefined, kind: AccessSubjectKind, id: string) {
  return (
    !!profile &&
    (kind === "provider"
      ? profile.providerId === id && profile.role === "SCOPED_PROVIDER"
      : profile.employeeId === id && STAFF_ACCESS_ROLES.includes(profile.role as never))
  );
}
export async function previewUserAccess(actor: AuthContext, kind: unknown, id: unknown) {
  requireAdmin(actor);
  const target = identity(kind, id);
  const ref = adminDb.collection(target.collection).doc(target.id);
  const data = (await ref.get()).data();
  if (!data) throw new AuthError("Cadastro não encontrado.", 404);
  const s = source(data, target.kind);
  const list = await adminDb.collection("companies").limit(1001).get();
  if (list.size > 1000) throw conflict("A lista de empresas excede o limite de revisão.");
  const companies = list.docs
    .filter(
      (d) =>
        d.data().isDeleted !== true && (target.kind === "employee" || s.companyIds.includes(d.id))
    )
    .map((d) => ({
      id: d.id,
      name: String(d.data().name || d.id),
      cnpj: String(d.data().cnpj || ""),
    }));
  let account = null;
  let warning = "";
  if (s.accessUid) {
    const [auth, profile] = await Promise.all([
      adminAuth.getUser(s.accessUid),
      adminDb.collection("users").doc(s.accessUid).get(),
    ]);
    if (
      !linked(profile.data(), target.kind, target.id) ||
      auth.email?.toLowerCase() !== s.email ||
      s.accessUid === actor.uid
    )
      throw conflict(
        "Vínculo inconsistente ou conta administrativa. Revisão de identidade necessária."
      );
    account = {
      uid: auth.uid,
      enabled: !auth.disabled && profile.data()?.accessEnabled !== false,
      role: String(profile.data()?.role),
      companyIds: expertCompanyIds(profile.data()?.servedCompanies),
      emailVerified: auth.emailVerified,
      lastSignInTime: auth.metadata.lastSignInTime || null,
    };
  } else if (s.email) {
    try {
      await adminAuth.getUserByEmail(s.email);
      warning =
        "Já existe conta com este e-mail. Não será vinculada ou sobrescrita automaticamente.";
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    }
  }
  return {
    ...s,
    kind: target.kind,
    id: target.id,
    companies,
    account,
    warning,
    busy: !!data.accessOperationId,
  };
}

export async function manageUserAccess(actor: AuthContext, raw: unknown) {
  requireAdmin(actor);
  const input = raw as Record<string, unknown>;
  if (!input || typeof input !== "object") throw badRequest("Solicitação inválida.");
  const target = identity(input.kind, input.id);
  if (
    !["create", "update", "disable", "enable", "reset-password"].includes(String(input.action)) ||
    typeof input.revision !== "string"
  )
    throw badRequest("Ação inválida.");
  const ref = adminDb.collection(target.collection).doc(target.id);
  const operationId = randomUUID();
  let uid = "";
  let resetLink: string | undefined;
  let acquired = false;
  const action = String(input.action);
  let s!: ReturnType<typeof source>;
  let role = "SCOPED_PROVIDER";
  let companyIds: string[] = [];
  let previouslyEnabled = false;
  let shouldEnable = false;
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new AuthError("Cadastro não encontrado.", 404);
      const data = snap.data()!;
      s = source(data, target.kind);
      if (s.revision !== input.revision || data.accessOperationId)
        throw conflict("Cadastro mudou ou há uma operação em andamento. Atualize a revisão.");
      if (action !== "disable") eligible(s);
      uid = s.accessUid;
      if (uid === actor.uid)
        throw forbidden("Não é permitido alterar seu próprio acesso por este painel.");
      if (action === "create" && uid) throw conflict("Este cadastro já possui login.");
      if (action !== "create" && !uid) throw conflict("Este cadastro ainda não possui login.");
      if (uid) {
        const profile = (await tx.get(adminDb.collection("users").doc(uid))).data();
        previouslyEnabled = profile?.accessEnabled !== false;
        if (!linked(profile, target.kind, target.id))
          throw conflict("Vínculo de identidade inconsistente. Nenhum acesso foi alterado.");
      }
      if (action === "create" || action === "update") {
        if (!Array.isArray(input.companyIds) || input.companyIds.some((v) => typeof v !== "string"))
          throw badRequest("Selecione as empresas autorizadas.");
        companyIds = expertCompanyIds(input.companyIds);
        if (companyIds.length !== input.companyIds.length || companyIds.length > 30)
          throw badRequest("Seleção de empresas inválida.");
        if (target.kind === "employee") {
          if (!STAFF_ACCESS_ROLES.includes(input.role as never))
            throw badRequest("Selecione um perfil permitido.");
          role = String(input.role);
        } else if (
          input.role !== "SCOPED_PROVIDER" ||
          companyIds.some((id) => !s.companyIds.includes(id))
        ) {
          throw forbidden("Prestadores só podem consultar empresas já vinculadas ao cadastro.");
        }
        if (role === "OPERATIONS") {
          if (companyIds.length)
            throw badRequest(
              "Operações internas possui escopo geral, não uma seleção de empresas."
            );
        } else if (!companyIds.length) throw badRequest("Selecione ao menos uma empresa.");
        if (["ENGINEER", "HR", "SAFETY_TECH"].includes(role) && companyIds.length !== 1)
          throw badRequest("Este perfil permite uma empresa por login.");
        for (const id of companyIds) {
          const company = await tx.get(adminDb.collection("companies").doc(id));
          if (!company.exists || company.data()?.isDeleted === true)
            throw conflict("Empresa indisponível.");
        }
      }
      tx.update(ref, { accessOperationId: operationId });
    });
    acquired = true;
    if (action === "create") {
      if (
        typeof input.password !== "string" ||
        input.password.length < 8 ||
        input.password.length > 128
      )
        throw badRequest("Informe uma senha inicial de 8 a 128 caracteres.");
      try {
        await adminAuth.getUserByEmail(s.email);
        throw conflict("E-mail já cadastrado. A conta existente não foi alterada.");
      } catch (e) {
        if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
      }
      uid = (
        await adminAuth.createUser({
          email: s.email,
          displayName: s.name,
          password: input.password,
          disabled: true,
        })
      ).uid;
    } else {
      const account = await adminAuth.getUser(uid);
      previouslyEnabled = previouslyEnabled && !account.disabled;
      if (account.email?.toLowerCase() !== s.email)
        throw conflict("O e-mail do login difere do cadastro. Revise a identidade.");
    }
    shouldEnable =
      action === "create" || action === "enable" || (action !== "disable" && previouslyEnabled);
    // Lock access in Firestore first, then disable Auth/revoke tokens before changing grants.
    await adminDb.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      if (
        !data ||
        data.accessOperationId !== operationId ||
        source(data, target.kind).revision !== s.revision
      )
        throw conflict("O cadastro mudou durante a operação.");
      const profileRef = adminDb.collection("users").doc(uid);
      const profile = await tx.get(profileRef);
      if (action === "create" ? profile.exists : !linked(profile.data(), target.kind, target.id))
        throw conflict("Perfil inconsistente.");
      tx.set(
        profileRef,
        {
          accessEnabled: false,
          ...(action === "create"
            ? {
                id: uid,
                email: s.email,
                name: s.name,
                role,
                permissions: [],
                servedCompanies: companyIds,
                companyId: role === "OPERATIONS" ? "nextcon" : companyIds[0] || null,
                tenantId: role === "OPERATIONS" ? null : companyIds[0] || null,
                [target.kind === "provider" ? "providerId" : "employeeId"]: target.id,
                createdAt: stamp(),
              }
            : {}),
        },
        { merge: true }
      );
      tx.update(ref, { accessUid: uid, accessVersion: Number(data.accessVersion || 0) + 1 });
      tx.create(adminDb.collection("user_access_audit").doc(), {
        action,
        phase: "STARTED",
        actorUid: actor.uid,
        targetUid: uid,
        kind: target.kind,
        recordId: target.id,
        role: action === "update" || action === "create" ? role : profile.data()?.role,
        companyIds:
          action === "update" || action === "create"
            ? companyIds
            : expertCompanyIds(profile.data()?.servedCompanies),
        createdAt: stamp(),
      });
    });
    await adminAuth.updateUser(uid, { disabled: true });
    await adminAuth.revokeRefreshTokens(uid);
    if (action === "reset-password") resetLink = await adminAuth.generatePasswordResetLink(s.email);
    await adminDb.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      if (
        !data ||
        data.accessOperationId !== operationId ||
        source(data, target.kind).email !== s.email ||
        data.accessUid !== uid ||
        (action !== "disable" && !source(data, target.kind).active)
      )
        throw conflict("O cadastro mudou; acesso mantido suspenso para revisão.");
      if (
        target.kind === "provider" &&
        (action === "update" || action === "create") &&
        companyIds.some((id) => !source(data, target.kind).companyIds.includes(id))
      )
        throw conflict("Vínculos revogados durante a operação.");
      const changes: Record<string, unknown> = { accessEnabled: false, updatedAt: stamp() };
      if (action === "update")
        Object.assign(changes, {
          role,
          servedCompanies: companyIds,
          permissions: [],
          companyId: role === "OPERATIONS" ? "nextcon" : companyIds[0],
          tenantId: role === "OPERATIONS" ? null : companyIds[0],
        });
      tx.set(adminDb.collection("users").doc(uid), changes, { merge: true });
    });
    if (shouldEnable) {
      await adminAuth.updateUser(uid, { disabled: false });
      await adminDb.runTransaction(async (tx) => {
        const data = (await tx.get(ref)).data();
        if (
          !data ||
          data.accessOperationId !== operationId ||
          data.accessUid !== uid ||
          !source(data, target.kind).active ||
          source(data, target.kind).email !== s.email
        )
          throw conflict("Cadastro alterado; acesso mantido bloqueado no NAI.");
        const profileRef = adminDb.collection("users").doc(uid);
        const profile = (await tx.get(profileRef)).data();
        if (!linked(profile, target.kind, target.id)) throw conflict("Vínculo de acesso alterado.");
        if (
          target.kind === "provider" &&
          expertCompanyIds(profile?.servedCompanies).some(
            (id) => !source(data, target.kind).companyIds.includes(id)
          )
        )
          throw conflict("Vínculos revogados durante a operação.");
        tx.update(profileRef, { accessEnabled: true, updatedAt: stamp() });
      });
    }
    await adminDb.collection("user_access_audit").add({
      action,
      phase: "COMPLETED",
      actorUid: actor.uid,
      targetUid: uid,
      kind: target.kind,
      recordId: target.id,
      createdAt: stamp(),
    });
    return {
      success: true,
      resetLink,
      message: resetLink
        ? "Link de redefinição gerado. Nenhum e-mail foi enviado."
        : "Acesso atualizado. Nenhum e-mail foi enviado.",
    };
  } finally {
    if (acquired)
      await adminDb.runTransaction(async (tx) => {
        const data = (await tx.get(ref)).data();
        if (data?.accessOperationId === operationId)
          tx.update(ref, { accessOperationId: FieldValue.delete() });
      });
  }
}
