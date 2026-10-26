import { readFileSync } from "node:fs";
import { afterAll, beforeAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
  setDoc,
  updateDoc,
} from "firebase/firestore";
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
      ["expert-restricted", "SCOPED_PROVIDER"],
      ["provider-restricted", "PROVIDER"],
    ]) {
      await setDoc(doc(ctx.firestore(), "users", uid), {
        role,
        companyId: "expert-company",
        servedCompanies: ["expert-company"],
        accessEnabled: true,
      });
    }
    // Legacy registrations used either a single companyId or servedCompanies.
    for (const [uid, scope] of [
      ["provider-single-company", { companyId: "expert-company" }],
      ["provider-multi-company", { servedCompanies: ["expert-company", "second-company"] }],
    ] as const) {
      await setDoc(doc(ctx.firestore(), "users", uid), { role: "PROVIDER", ...scope });
    }
    for (const company of ["expert-company", "second-company", "foreign-company"]) {
      for (const name of [
        "tasks",
        "risks",
        "pgr_cards",
        "contracts",
        "financial",
        "medical_records",
      ]) {
        await setDoc(doc(ctx.firestore(), `companies/${company}/${name}/regression`), {
          companyId: company,
          synthetic: true,
        });
      }
      for (const category of ["contratos", "faturamento", "prontuarios"])
        await uploadBytes(
          ref(ctx.storage(), `clientes/${company}/${category}/regression/file.pdf`),
          new Uint8Array([1]),
          { contentType: "application/pdf" }
        );
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
it.each(["provider-restricted", "provider-single-company", "provider-multi-company"])(
  "preserves legacy operational reads without commercial or foreign-client access (%s)",
  async (uid) => {
    const db = env.authenticatedContext(uid).firestore();
    const allowed =
      uid === "provider-multi-company" ? ["expert-company", "second-company"] : ["expert-company"];
    for (const company of allowed) {
      for (const name of ["tasks", "risks", "pgr_cards"]) {
        await assertSucceeds(getDoc(doc(db, `companies/${company}/${name}/regression`)));
        await assertSucceeds(getDocs(collection(db, `companies/${company}/${name}`)));
        await assertFails(
          updateDoc(doc(db, `companies/${company}/${name}/regression`), { title: "changed" })
        );
      }
      // Existing authorized clinical workflows remain available to legacy accounts.
      await assertSucceeds(getDoc(doc(db, `companies/${company}/medical_records/regression`)));
      for (const name of ["contracts", "financial"]) {
        await assertFails(getDoc(doc(db, `companies/${company}/${name}/regression`)));
        await assertFails(getDocs(collection(db, `companies/${company}/${name}`)));
      }
    }
    for (const name of [
      "tasks",
      "risks",
      "pgr_cards",
      "contracts",
      "financial",
      "medical_records",
    ]) {
      await assertFails(getDoc(doc(db, `companies/foreign-company/${name}/regression`)));
      await assertFails(getDocs(collection(db, `companies/foreign-company/${name}`)));
    }
    await assertFails(getDoc(doc(db, "companies/foreign-company")));
    await assertFails(getDocs(collection(db, "companies")));
    await assertFails(getDocs(collectionGroup(db, "tasks")));
    await assertFails(getDocs(collectionGroup(db, "contracts")));
    const storage = env.authenticatedContext(uid).storage();
    for (const company of [...allowed, "foreign-company"])
      for (const category of ["contratos", "faturamento"])
        await assertFails(
          getBytes(ref(storage, `clientes/${company}/${category}/regression/file.pdf`))
        );
    await assertFails(
      getBytes(ref(storage, "clientes/foreign-company/prontuarios/regression/file.pdf"))
    );
  }
);
it("expert cannot bypass the server through Storage", async () => {
  const storage = env.authenticatedContext("expert-restricted").storage();
  for (const category of ["contratos", "faturamento", "prontuarios"])
    await assertFails(
      getBytes(ref(storage, `clientes/expert-company/${category}/private/file.pdf`))
    );
});
