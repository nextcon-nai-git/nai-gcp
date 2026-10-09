import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { AuthError, forbidden } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/auth-context";
import {
  billingGroupId,
  MONTHLY_CONTRACT_ID,
  resolveBillingCompany,
  type MonthlyBillingImport,
  type MonthlyBillingView,
} from "@/lib/monthly-billing";

function requireAdmin(user: AuthContext) {
  if (user.role !== "SUPER_ADMIN")
    throw forbidden("A importação comercial exige administrador global.");
}
function directory(snapshot: FirebaseFirestore.QuerySnapshot) {
  if (snapshot.size > 5000) throw new AuthError("Carteira acima do limite de importação.", 422);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}
function revision(docs: FirebaseFirestore.DocumentSnapshot[]) {
  return createHash("sha256")
    .update(
      docs
        .map((d) => `${d.ref.path}:${d.updateTime?.toMillis() || 0}`)
        .sort()
        .join("|")
    )
    .digest("hex");
}
function groupFrom(snapshot: FirebaseFirestore.QuerySnapshot, id: string) {
  const group = snapshot.docs.find((d) => d.id === id);
  if (!group || group.data().isDeleted === true || group.data().active === false)
    throw new AuthError("Selecione um grupo ativo da carteira.", 400);
  return {
    id: group.id,
    name: String(group.data().portfolioClientName || group.data().name || group.id),
    portfolioClientId: billingGroupId({ ...group.data(), id: group.id }),
  };
}
function members(
  snapshot: FirebaseFirestore.QuerySnapshot,
  group: NonNullable<MonthlyBillingView["group"]>
) {
  return snapshot.docs.filter(
    (d) => d.id === group.id || d.data().portfolioClientId === group.portfolioClientId
  );
}
function contractRef(companyId: string) {
  return adminDb
    .collection("companies")
    .doc(companyId)
    .collection("contracts")
    .doc(MONTHLY_CONTRACT_ID);
}
export async function listMonthlyBilling(
  user: AuthContext,
  groupCompanyId: string
): Promise<MonthlyBillingView> {
  requireAdmin(user);
  const snapshot = await adminDb.collection("companies").limit(5001).get();
  directory(snapshot);
  const groups = snapshot.docs
    .filter((d) => d.data().active !== false && d.data().isDeleted !== true)
    .map((d) => ({ id: d.id, name: String(d.data().name || d.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!groupCompanyId) return { groups, group: null, revision: "", records: [], totalCents: 0 };
  const group = groupFrom(snapshot, groupCompanyId);
  const contracts = await Promise.all(members(snapshot, group).map((d) => contractRef(d.id).get()));
  const records = contracts
    .filter(
      (d) =>
        d.exists &&
        d.data()?.status === "active" &&
        d.data()?.portfolioClientId === group.portfolioClientId
    )
    .map((d) => {
      const data = d.data()!;
      return {
        companyId: d.ref.parent.parent!.id,
        cnpj: String(data.cnpj),
        name: String(data.companyName),
        valueCents: Number(data.valueCents),
        sourceName: String(data.sourceName || ""),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    groups,
    group,
    revision: revision([...snapshot.docs, ...contracts]),
    records,
    totalCents: records.reduce((sum, r) => sum + r.valueCents, 0),
  };
}
export async function saveMonthlyBilling(user: AuthContext, input: MonthlyBillingImport) {
  requireAdmin(user);
  const auditRef = adminDb.collection("admin_migrations").doc();
  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(adminDb.collection("companies").limit(5001));
    const companies = directory(snapshot);
    const group = groupFrom(snapshot, input.groupCompanyId);
    const oldContracts = await Promise.all(
      members(snapshot, group).map((d) => tx.get(contractRef(d.id)))
    );
    if (revision([...snapshot.docs, ...oldContracts]) !== input.revision)
      throw new AuthError("A carteira mudou. Atualize os dados e revise o lote novamente.", 409);
    let plan: { row: MonthlyBillingImport["rows"][number]; id: string }[];
    try {
      plan = input.rows.map((row) => ({
        row,
        id: resolveBillingCompany(row, companies, group.portfolioClientId),
      }));
    } catch (error) {
      throw new AuthError(error instanceof Error ? error.message : "Conflito no cadastro.", 409);
    }
    const previous = await Promise.all(
      plan.map(async ({ id }) => ({
        company: snapshot.docs.find((d) => d.id === id),
        contract: await tx.get(contractRef(id)),
      }))
    );
    previous.forEach(({ contract }) => {
      if (
        contract.exists &&
        (contract.data()?.portfolioClientId !== group.portfolioClientId ||
          contract.data()?.billingType !== "fixed_monthly")
      )
        throw new AuthError(
          "Já existe um contrato incompatível. Nenhum registro foi alterado.",
          409
        );
    });
    const changes = plan.map(({ row, id }, index) => ({
      id,
      row,
      prior: previous[index],
      unchanged:
        previous[index].company?.data().name === row.name &&
        previous[index].company?.data().active === true &&
        previous[index].company?.data().portfolioClientId === group.portfolioClientId &&
        previous[index].contract.data()?.valueCents === row.valueCents &&
        previous[index].contract.data()?.companyName === row.name &&
        previous[index].contract.data()?.status === "active",
    }));
    for (const { id, row, prior, unchanged } of changes) {
      if (unchanged) continue;
      tx.set(
        adminDb.collection("companies").doc(id),
        {
          name: row.name,
          cnpj: row.cnpj,
          active: true,
          isDeleted: false,
          portfolioClientId: group.portfolioClientId,
          portfolioClientName: group.name,
          updatedAt: FieldValue.serverTimestamp(),
          modifiedBy: user.uid,
          ...(!prior.company
            ? {
                id,
                createdAt: FieldValue.serverTimestamp(),
                createdBy: user.uid,
                source: "monthly_billing_import",
              }
            : {}),
        },
        { merge: true }
      );
      tx.set(
        contractRef(id),
        {
          companyId: id,
          companyName: row.name,
          cnpj: row.cnpj,
          title: `Faturamento mensal fixo — ${group.name}`,
          portfolioClientId: group.portfolioClientId,
          portfolioClientName: group.name,
          billingType: "fixed_monthly",
          frequency: "monthly",
          currency: "BRL",
          status: "active",
          value: row.valueCents / 100,
          valueCents: row.valueCents,
          sourceName: input.sourceName,
          updatedAt: FieldValue.serverTimestamp(),
          modifiedBy: user.uid,
          ...(!prior.contract.exists
            ? { createdAt: FieldValue.serverTimestamp(), createdBy: user.uid }
            : {}),
        },
        { merge: true }
      );
    }
    const changed = changes.filter((c) => !c.unchanged);
    if (changed.length)
      tx.create(auditRef, {
        operation: "MONTHLY_BILLING_IMPORTED",
        actorUid: user.uid,
        groupCompanyId: group.id,
        portfolioClientId: group.portfolioClientId,
        sourceName: input.sourceName,
        appliedAt: FieldValue.serverTimestamp(),
        records: changed.map(({ id, row, prior }) => ({
          companyId: id,
          cnpj: row.cnpj,
          name: row.name,
          valueCents: row.valueCents,
          createdCompany: !prior.company,
          previousName: prior.company?.data().name ?? null,
          previousActive: prior.company?.data().active ?? null,
          previousPortfolioClientId: prior.company?.data().portfolioClientId ?? null,
          previousValueCents: prior.contract.data()?.valueCents ?? null,
        })),
      });
    return {
      saved: true,
      changed: changed.length,
      count: input.rows.length,
      totalCents: input.rows.reduce((sum, r) => sum + r.valueCents, 0),
    };
  });
}
