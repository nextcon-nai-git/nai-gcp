import { readFileSync } from "node:fs";
import { afterAll, beforeAll, it } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

let env: RulesTestEnvironment;
const root = "clinic_portal_private/grupo-avp/periodic-work-2026";
const path = `${root}/periodico-2026-${"a".repeat(64)}`;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    for (const [uid, role, servedCompanies] of [
      ["periodic-admin", "SUPER_ADMIN", []],
      ["periodic-scoped", "OPERATIONS", ["GRUPO_AVP"]],
      ["periodic-other", "OPERATIONS", []],
    ] as const)
      await setDoc(doc(context.firestore(), "users", uid), {
        role,
        servedCompanies,
        tenantId: null,
        companyId: null,
        accessEnabled: true,
      });
    await setDoc(doc(context.firestore(), path), { revision: 1 });
    await setDoc(doc(context.firestore(), `${path}/history/event`), {
      evidence: "Referência sintética",
    });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it.each(["periodic-admin", "periodic-scoped", "periodic-other", "anonymous"])(
  "%s deve usar a API autorizada para estado e histórico",
  async (uid) => {
    const db =
      uid === "anonymous"
        ? env.unauthenticatedContext().firestore()
        : env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, root)));
    await assertFails(getDocs(collection(db, `${path}/history`)));
    await assertFails(setDoc(doc(db, path), { revision: 2, stage: "concluido" }));
  }
);
