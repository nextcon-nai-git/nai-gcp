import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
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
    await setDoc(doc(ctx.firestore(), "users/security"), {
      role: "SUPER_ADMIN",
      accessEnabled: true,
    });
    await setDoc(doc(ctx.firestore(), "users/ops"), {
      role: "OPERATIONS",
      companyId: "nextcon",
      accessEnabled: true,
    });
    for (const name of ["audit_logs", "system_audit_logs", "ai_audit_logs"])
      await setDoc(doc(ctx.firestore(), name, "server-event"), { action: "server-created" });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("root audit stream rules", () => {
  it.each(["audit_logs", "system_audit_logs", "ai_audit_logs"])(
    "allows security admin read but denies browser writes: %s",
    async (name) => {
      const security = env.authenticatedContext("security").firestore();
      const ops = env.authenticatedContext("ops").firestore();

      await assertSucceeds(getDoc(doc(security, name, "server-event")));
      await assertFails(getDoc(doc(ops, name, "server-event")));
      await assertFails(setDoc(doc(security, name, "forged"), { action: "forged" }));
      await assertFails(setDoc(doc(ops, name, "forged"), { action: "forged" }));
    }
  );
});
