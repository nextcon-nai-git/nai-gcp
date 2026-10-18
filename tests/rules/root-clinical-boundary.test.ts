import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

let env: RulesTestEnvironment;
const roots = [
  "aso_attendances",
  "medical_records",
  "clinical_records",
  "prontuarios",
  "medical_certificates",
  "nursing_attendances",
];
const profiles = {
  "clinical-super": { role: "SUPER_ADMIN" },
  "clinical-admin": { role: "ADMIN", companyId: "nextcon", tenantId: null },
  "clinical-operations": { role: "OPERATIONS", companyId: "nextcon", tenantId: null },
  "clinical-tenant-admin": { role: "ADMIN", companyId: "clinical-a", tenantId: "clinical-a" },
  "clinical-nurse": { role: "NURSE", companyId: "clinical-a", tenantId: "clinical-a" },
  "clinical-doctor": { role: "DOCTOR", companyId: "clinic", servedCompanies: ["clinical-a"] },
  "clinical-hr": { role: "HR", companyId: "clinical-a" },
};
function payload(uid = "clinical-nurse") {
  return {
    companyId: "clinical-a",
    employeeId: "patient",
    employeeName: "Paciente de teste",
    complaint: "Queixa de teste",
    conduct: "observation",
    care_lines: [],
    coren: "TESTE-SP",
    nurseName: "Profissional de teste",
    createdBy: uid,
    status_esocial: "Não transmitido",
    createdAt: "2026-10-18T05:00:00.000Z",
    timestamp: serverTimestamp(),
  };
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, profile] of Object.entries(profiles))
      await setDoc(doc(ctx.firestore(), "users", uid), profile);
    for (const companyId of ["clinical-a", "clinical-b"]) {
      await setDoc(doc(ctx.firestore(), "companies", companyId), { name: companyId });
      await setDoc(doc(ctx.firestore(), `companies/${companyId}/employees/patient`), {
        name: "Paciente de teste",
        companyId,
      });
      for (const root of roots)
        await setDoc(doc(ctx.firestore(), root, companyId), {
          companyId,
          employeeId: "patient",
          complaint: "Dado sintético",
        });
    }
    await setDoc(doc(ctx.firestore(), "nursing_attendances/clinical-a/private/nested"), {
      companyId: "clinical-a",
    });
  });
});
afterAll(async () => {
  await env?.cleanup();
});

describe("root clinical records cannot inherit operational access", () => {
  it.each(roots)("denies operations and HR access to %s", async (root) => {
    for (const uid of ["clinical-operations", "clinical-hr"]) {
      const db = env.authenticatedContext(uid).firestore();
      await assertFails(getDoc(doc(db, root, "clinical-a")));
      await assertFails(setDoc(doc(db, root, `unauthorized-${uid}`), payload(uid)));
      await assertFails(updateDoc(doc(db, root, "clinical-a"), { complaint: "Alterado" }));
      await assertFails(deleteDoc(doc(db, root, "clinical-a")));
    }
  });
  it.each(["clinical-nurse", "clinical-doctor", "clinical-tenant-admin"])(
    "scopes %s to authorized companies including queries",
    async (uid) => {
      const db = env.authenticatedContext(uid).firestore();
      await assertSucceeds(getDoc(doc(db, "nursing_attendances/clinical-a")));
      await assertFails(getDoc(doc(db, "nursing_attendances/clinical-b")));
      await assertSucceeds(
        getDocs(
          query(collection(db, "nursing_attendances"), where("companyId", "==", "clinical-a"))
        )
      );
      await assertFails(getDocs(collection(db, "nursing_attendances")));
    }
  );
  it.each(["clinical-super", "clinical-admin"])(
    "preserves global clinical reads for %s",
    async (uid) => {
      const db = env.authenticatedContext(uid).firestore();
      await assertSucceeds(getDoc(doc(db, "nursing_attendances/clinical-b")));
      await assertSucceeds(getDocs(collection(db, "nursing_attendances")));
    }
  );
  it("permits an identified attendance for an existing employee", async () => {
    const db = env.authenticatedContext("clinical-nurse").firestore();
    await assertSucceeds(setDoc(doc(db, "nursing_attendances/valid-create"), payload()));
  });
  it.each([
    { createdBy: "someone-else" },
    { employeeId: "missing" },
    { employeeName: "Inventado" },
    { coren: "" },
    { companyId: "clinical-b" },
    { status_esocial: "Transmitido" },
    { createdAt: "2026-02-30T05:00:00.000Z" },
    { timestamp: "client timestamp" },
  ])("rejects invalid or misattributed attendance %j", async (changes) => {
    const db = env.authenticatedContext("clinical-nurse").firestore();
    await assertFails(
      setDoc(doc(db, "nursing_attendances/invalid-create"), { ...payload(), ...changes })
    );
  });
  it("does not accept an employee removed in the same atomic operation", async () => {
    const db = env.authenticatedContext("clinical-admin").firestore();
    const batch = writeBatch(db);
    batch.delete(doc(db, "companies/clinical-a/employees/patient"));
    batch.set(doc(db, "nursing_attendances/deleted-subject"), payload("clinical-admin"));
    await assertFails(batch.commit());
  });
  it.each(["clinical-super", "clinical-admin", "clinical-nurse"])(
    "retains history and company identity for %s",
    async (uid) => {
      const db = env.authenticatedContext(uid).firestore();
      await assertFails(
        updateDoc(doc(db, "nursing_attendances/clinical-a"), { companyId: "clinical-b" })
      );
      await assertFails(
        updateDoc(doc(db, "nursing_attendances/clinical-a"), { complaint: "Substituído" })
      );
      await assertFails(deleteDoc(doc(db, "nursing_attendances/clinical-a")));
      await assertFails(getDoc(doc(db, "nursing_attendances/clinical-a/private/nested")));
    }
  );
  it("denies unauthenticated reads", async () => {
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), "nursing_attendances/clinical-a"))
    );
  });
});
