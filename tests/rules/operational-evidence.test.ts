import { readFileSync } from "node:fs";
import { afterAll, beforeAll, it } from "vitest";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;
const path = "clinic_portal_private/operations/worker_status/esocial-query";
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-nai-security", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  await env.withSecurityRulesDisabled(async (context) => {
    for (const [uid, role, tenantId] of [
      ["worker-global-admin", "SUPER_ADMIN", null],
      ["worker-internal-ops", "OPERATIONS", null],
      ["worker-client-admin", "CLIENT_ADMIN", "synthetic-company"],
    ]) await setDoc(doc(context.firestore(), "users", uid as string), { role, tenantId, companyId: tenantId, accessEnabled: true });
    await setDoc(doc(context.firestore(), path), { latest: { outcome: "completed", counters: { checked: 0 } } });
  });
});
afterAll(async () => { await env?.cleanup(); });

it.each(["worker-global-admin", "worker-internal-ops", "worker-client-admin", "anonymous"])(
  "%s cannot read or forge server worker evidence through the client SDK",
  async (uid) => {
    const db = uid === "anonymous" ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, "clinic_portal_private/operations/worker_status")));
    await assertFails(setDoc(doc(db, path), { latest: { outcome: "completed" } }));
    await assertFails(updateDoc(doc(db, path), { latest: { outcome: "completed" } }));
    await assertFails(deleteDoc(doc(db, path)));
  }
);
