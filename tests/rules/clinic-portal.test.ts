import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, updateDoc } from "firebase/firestore";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role] of [
      ["portal-admin", "SUPER_ADMIN"],
      ["portal-ops", "OPERATIONS"],
      ["portal-doctor", "DOCTOR"],
    ])
      await setDoc(doc(ctx.firestore(), "users", uid), { role, companyId: "nextcon" });
    await setDoc(doc(ctx.firestore(), "clinic_portal_private/case"), {
      clinical: "synthetic secret",
    });
    await setDoc(doc(ctx.firestore(), "clinic_portal_private/case/events/read"), {
      uid: "synthetic",
    });
    await setDoc(doc(ctx.firestore(), "users/britania-site-doctor"), {
      role: "DOCTOR",
      companyId: "BRITANIA_JOINVILLE",
      servedCompanies: ["BRITANIA_JOINVILLE"],
    });
    await setDoc(doc(ctx.firestore(), "clinic_portal_private/britania_group_fap_2027"), {
      dossier: { cases: [{ synthetic: true }] },
    });
  });
});
it("keeps the consolidated Britânia dossier inaccessible to a doctor authorized for one site", async () => {
  const db = env.authenticatedContext("britania-site-doctor").firestore();
  const target = doc(db, "clinic_portal_private/britania_group_fap_2027");
  await assertFails(getDoc(target));
  await assertFails(setDoc(target, { forged: true }));
  await assertFails(updateDoc(target, { dossier: { cases: [] } }));
});
afterAll(async () => {
  await env?.cleanup();
});
it.each(["portal-admin", "portal-ops", "portal-doctor", "portal-invitee", "anonymous"])(
  "requires server authorization even for %s",
  async (uid) => {
    const db =
      uid === "anonymous"
        ? env.unauthenticatedContext().firestore()
        : env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, "clinic_portal_private/case")));
    await assertFails(getDoc(doc(db, "clinic_portal_private/case/events/read")));
    await assertFails(getDocs(collection(db, "clinic_portal_private")));
    await assertFails(setDoc(doc(db, "clinic_portal_private/new"), { forged: true }));
    await assertFails(updateDoc(doc(db, "clinic_portal_private/case"), { grants: [] }));
  }
);
