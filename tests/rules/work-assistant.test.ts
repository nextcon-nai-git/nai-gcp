import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", "assistant-admin"), { role: "SUPER_ADMIN" });
    for (const name of ["workAssistantProposals", "workAssistantUsage"])
      await setDoc(doc(ctx.firestore(), name, "private"), { uid: "assistant-admin" });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
describe("server-only assistant records", () => {
  it("denies archived kit, ledger and audit access through browser SDKs", async () => {
    const db = env.authenticatedContext("assistant-admin").firestore();
    for (const path of [
      "workAssistantProposals/kit_test",
      "workAssistantProposals/kit_test/audit/event",
      "workAssistantProposals/kit-ledger_test/issued/kit_test",
    ]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(
        setDoc(doc(db, path), { pdfBase64: "forged", confirmedBy: "assistant-admin" })
      );
    }
  });
  it.each(["workAssistantProposals", "workAssistantUsage"])(
    "denies browser reads and forged writes even for admin: %s",
    async (name) => {
      const db = env.authenticatedContext("assistant-admin").firestore();
      await assertFails(getDoc(doc(db, name, "private")));
      await assertFails(setDoc(doc(db, name, "private"), { uid: "assistant-admin", actions: [] }));
    }
  );
});
