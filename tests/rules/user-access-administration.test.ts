import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role, enabled] of [
      ["access-admin", "SUPER_ADMIN", true],
      ["access-ops", "OPERATIONS", true],
      ["access-disabled", "OPERATIONS", false],
      ["access-disabled-doctor", "DOCTOR", false],
    ] as const)
      await setDoc(doc(ctx.firestore(), "users", uid), {
        role,
        companyId: role === "DOCTOR" ? "access-client" : "nextcon",
        accessEnabled: enabled,
      });
    await setDoc(doc(ctx.firestore(), "nxc_employees/access-staff"), {
      name: "Synthetic",
      accessUid: "access-disabled",
    });
    await setDoc(doc(ctx.firestore(), "companies/access-client"), { name: "Synthetic" });
    await setDoc(doc(ctx.firestore(), "companies/access-client/medical_records/record"), {
      companyId: "access-client",
    });
    await setDoc(doc(ctx.firestore(), "user_access_audit/access-audit"), { action: "synthetic" });
    await uploadBytes(
      ref(ctx.storage(), "internos_nextcon/operacao/access-test.pdf"),
      new Uint8Array([1]),
      { contentType: "application/pdf" }
    );
    await uploadBytes(
      ref(ctx.storage(), "clientes/access-client/prontuarios/test/file.pdf"),
      new Uint8Array([1]),
      { contentType: "application/pdf" }
    );
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it("suspended operational user loses direct Firestore and Storage access", async () => {
  const ctx = env.authenticatedContext("access-disabled");
  await assertFails(getDoc(doc(ctx.firestore(), "companies/access-client")));
  await assertFails(getDoc(doc(ctx.firestore(), "nxc_employees/access-staff")));
  await assertFails(getBytes(ref(ctx.storage(), "internos_nextcon/operacao/access-test.pdf")));
  await assertFails(
    updateDoc(doc(ctx.firestore(), "users/access-disabled"), { accessEnabled: true })
  );
});
it("suspended clinician cannot read health files or records", async () => {
  const ctx = env.authenticatedContext("access-disabled-doctor");
  await assertFails(getDoc(doc(ctx.firestore(), "companies/access-client/medical_records/record")));
  await assertFails(
    getBytes(ref(ctx.storage(), "clientes/access-client/prontuarios/test/file.pdf"))
  );
});
it("operational editors cannot replace account links or audit", async () => {
  const db = env.authenticatedContext("access-ops").firestore();
  await assertSucceeds(
    updateDoc(doc(db, "nxc_employees/access-staff"), { name: "Updated synthetic" })
  );
  await assertFails(updateDoc(doc(db, "nxc_employees/access-staff"), { accessUid: "other" }));
  await assertFails(
    updateDoc(doc(db, "nxc_employees/access-staff"), { accessOperationId: "forged" })
  );
  await assertFails(setDoc(doc(db, "user_access_audit/forged"), { action: "forged" }));
  await assertFails(getDoc(doc(db, "user_access_audit/access-audit")));
  await assertFails(deleteDoc(doc(db, "nxc_employees/access-staff")));
});
it("even security admins use the server for linked-account fields", async () => {
  const db = env.authenticatedContext("access-admin").firestore();
  await assertFails(updateDoc(doc(db, "nxc_employees/access-staff"), { accessUid: "other" }));
  await assertSucceeds(getDoc(doc(db, "user_access_audit/access-audit")));
});
