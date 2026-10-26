import { readFileSync } from "node:fs";
import { afterAll, beforeAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role] of [
      ["expert-restricted", "MEDICAL_EXPERT"],
      ["provider-restricted", "PROVIDER"],
    ]) {
      await setDoc(doc(ctx.firestore(), "users", uid), {
        role,
        companyId: "expert-company",
        servedCompanies: ["expert-company"],
        accessEnabled: true,
      });
    }
    for (const path of [
      "companies/expert-company",
      "companies/expert-company/contracts/private",
      "companies/expert-company/financial/private",
      "companies/expert-company/tasks/task",
      "companies/expert-company/medical_records/private",
      "companies/foreign-company/tasks/task",
      "documents/expert-doc",
    ]) {
      await setDoc(doc(ctx.firestore(), path), { companyId: "expert-company", synthetic: true });
    }
    for (const category of ["contratos", "faturamento", "prontuarios"])
      await uploadBytes(
        ref(ctx.storage(), `clientes/expert-company/${category}/private/file.pdf`),
        new Uint8Array([1]),
        { contentType: "application/pdf" }
      );
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it("expert cannot read raw company, task, clinical, contract or financial documents even with a matching companyId", async () => {
  const db = env.authenticatedContext("expert-restricted").firestore();
  for (const path of [
    "companies/expert-company",
    "companies/expert-company/contracts/private",
    "companies/expert-company/financial/private",
    "companies/expert-company/tasks/task",
    "companies/expert-company/medical_records/private",
    "companies/foreign-company/tasks/task",
    "documents/expert-doc",
  ])
    await assertFails(getDoc(doc(db, path)));
  await assertFails(getDocs(collection(db, "companies")));
  await assertSucceeds(getDoc(doc(db, "users/expert-restricted")));
  await assertFails(updateDoc(doc(db, "users/expert-restricted"), { role: "SUPER_ADMIN" }));
  await assertFails(
    updateDoc(doc(db, "users/expert-restricted"), { servedCompanies: ["foreign-company"] })
  );
  await assertFails(
    updateDoc(doc(db, "users/expert-restricted"), { accessEnabled: true, providerId: "other" })
  );
});
it("legacy provider also cannot inherit contract or billing access from companyId", async () => {
  const db = env.authenticatedContext("provider-restricted").firestore();
  await assertFails(getDoc(doc(db, "companies/expert-company/contracts/private")));
  await assertFails(getDoc(doc(db, "companies/expert-company/financial/private")));
});
it("expert cannot bypass the server through Storage", async () => {
  const storage = env.authenticatedContext("expert-restricted").storage();
  for (const category of ["contratos", "faturamento", "prontuarios"])
    await assertFails(
      getBytes(ref(storage, `clientes/expert-company/${category}/private/file.pdf`))
    );
});
