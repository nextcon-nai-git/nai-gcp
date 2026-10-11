import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role, companyId, tenantId] of [
      ["tenant-admin", "ADMIN", "tenant-a", "tenant-a"],
      ["tenant-operations", "OPERATIONS", "tenant-a", "tenant-a"],
      ["legacy-admin", "ADMIN", "tenant-a", null],
      ["internal-admin", "ADMIN", "nextcon", null],
      ["tenant-doctor", "DOCTOR", "tenant-a", "tenant-a"],
    ])
      await setDoc(doc(ctx.firestore(), "users", uid!), { role, companyId, tenantId });
    for (const company of ["tenant-a", "tenant-b"]) {
      await setDoc(doc(ctx.firestore(), `companies/${company}/private/synthetic`), {
        synthetic: true,
      });
      await setDoc(doc(ctx.firestore(), `companies/${company}/aso_attendances/synthetic`), {
        synthetic: true,
      });
      await uploadBytes(
        ref(ctx.storage(), `clientes/${company}/colaboradores/synthetic/test.pdf`),
        new Uint8Array([1, 2]),
        { contentType: "application/pdf" }
      );
    }
  });
});
afterAll(async () => {
  await env?.cleanup();
});
describe("tenant administration does not imply global access", () => {
  it.each(["tenant-admin", "tenant-operations", "legacy-admin"])(
    "isolates %s from other companies",
    async (uid) => {
      const db = env.authenticatedContext(uid).firestore();
      await assertSucceeds(getDoc(doc(db, "companies/tenant-a/private/synthetic")));
      await assertFails(getDoc(doc(db, "companies/tenant-b/private/synthetic")));
      await assertFails(getDoc(doc(db, "companies/tenant-b/aso_attendances/synthetic")));
      await assertFails(
        getBytes(
          ref(
            env.authenticatedContext(uid).storage(),
            "clientes/tenant-b/colaboradores/synthetic/test.pdf"
          )
        )
      );
    }
  );
  it("preserves explicitly internal administrative access", async () => {
    const ctx = env.authenticatedContext("internal-admin");
    await assertSucceeds(getDoc(doc(ctx.firestore(), "companies/tenant-b/private/synthetic")));
    await assertSucceeds(
      getBytes(ref(ctx.storage(), "clientes/tenant-b/colaboradores/synthetic/test.pdf"))
    );
  });
  it.each(["tenant-doctor", "tenant-admin", "internal-admin"])(
    "denies direct legacy job creation for %s",
    async (uid) => {
      await assertFails(
        setDoc(doc(env.authenticatedContext(uid).firestore(), `analisesPGR/${uid}`), {
          companyId: "tenant-a",
          caminhoStoragePdf: "clientes/tenant-b/documentos/test.pdf",
        })
      );
    }
  );
});
