import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, updateDoc } from "firebase/firestore";
import type { AuthContext } from "@/lib/auth/auth-context";
import { adminDb } from "@/lib/firebase-admin";
import { listMonthlyBilling, saveMonthlyBilling } from "@/services/monthly-billing";
import { MONTHLY_CONTRACT_ID } from "@/lib/monthly-billing";

let env: RulesTestEnvironment;
const group = "billing-integration-group";
const company = "billing-integration-company";
const profile = {
  uid: "billing-integration-admin",
  role: "SUPER_ADMIN",
  email: "",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
} satisfies AuthContext;
const row = { cnpj: "11222333000181", name: "Unidade de teste", valueCents: 500000 };
const contract = adminDb.doc("companies/" + company + "/contracts/" + MONTHLY_CONTRACT_ID);
const preview = () => listMonthlyBilling(profile, group);
async function proposal() {
  return {
    groupCompanyId: group,
    confirmed: true as const,
    sourceName: "lote-sintetico.xlsx",
    rows: [row],
    revision: (await preview()).revision,
  };
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.clearFirestore();
  const batch = adminDb.batch();
  batch.set(adminDb.doc("users/" + profile.uid), { role: "SUPER_ADMIN" });
  batch.set(adminDb.doc("users/billing-integration-client"), {
    role: "CLIENT_ADMIN",
    companyId: company,
  });
  batch.set(adminDb.doc("users/billing-integration-ops"), {
    role: "OPERATIONS",
    companyId: "nextcon",
  });
  batch.set(adminDb.doc("companies/" + group), { name: "Grupo sintético", active: true });
  batch.set(adminDb.doc("companies/" + company), {
    ...row,
    active: true,
    portfolioClientId: group,
  });
  await batch.commit();
});
afterAll(async () => {
  await env?.cleanup();
});

it("mantém R$ 5.000 após tentativas do cliente e da operação, corrige o valor legado e preserva a auditoria", async () => {
  const pending = await proposal();
  expect((await saveMonthlyBilling(profile, pending)).changed).toBe(1);
  for (const uid of ["billing-integration-client", "billing-integration-ops"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(updateDoc(doc(db, contract.path), { value: 1, valueCents: 100 }));
  }
  expect((await preview()).totalCents).toBe(500000);
  expect((await contract.get()).data()?.value).toBe(5000);
  expect((await saveMonthlyBilling(profile, await proposal())).changed).toBe(0);
  await expect(saveMonthlyBilling(profile, pending)).rejects.toMatchObject({ status: 409 });
  const audits = adminDb.collection("admin_migrations").where("groupCompanyId", "==", group);
  expect((await audits.get()).size).toBe(1);
  // Legacy records may contain a different decimal amount despite correct cents.
  await contract.update({ value: 1 });
  expect((await saveMonthlyBilling(profile, await proposal())).changed).toBe(1);
  expect((await contract.get()).data()?.value).toBe(5000);
  const pendingEdit = await proposal();
  await adminDb.doc("users/" + profile.uid).update({ accessEnabled: false });
  await expect(
    saveMonthlyBilling(profile, { ...pendingEdit, rows: [{ ...row, valueCents: 100 }] })
  ).rejects.toMatchObject({ status: 403 });
  expect((await audits.get()).size).toBe(2);
  expect((await contract.get()).data()?.valueCents).toBe(500000);
});
