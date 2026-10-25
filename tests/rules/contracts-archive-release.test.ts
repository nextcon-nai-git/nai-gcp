import { readFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collectionGroup, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import {
  archiveRule,
  prepareContractArchive,
  sha256,
} from "../../scripts/firestore/prepare-contract-archive.mjs";

let env: RulesTestEnvironment;
afterAll(async () => {
  await env?.cleanup();
});
it("reproduces the missing list permission and repairs only that rule", async () => {
  const reference = readFileSync("firestore.rules", "utf8");
  const baseline = reference.replace(archiveRule, "");
  expect(baseline).not.toBe(reference);
  const patched = prepareContractArchive(baseline, sha256(baseline), reference);
  expect(patched.replace(`\n${archiveRule}\n`, "")).toBe(baseline);
  expect(() => prepareContractArchive(baseline + "\n", sha256(baseline), reference)).toThrow(
    /SHA-256/
  );
  expect(() => prepareContractArchive(reference, sha256(reference), reference)).toThrow(
    /already exists/
  );
  const divergent = baseline.replace("'ADMIN', 'OPERATIONS'", "'ADMIN', 'OPERATIONS', 'DOCTOR'");
  expect(() => prepareContractArchive(divergent, sha256(divergent), reference)).toThrow(
    /isInternalStaff/
  );
  const configure = async (rules: string) =>
    initializeTestEnvironment({ projectId: "demo-nai-security", firestore: { rules } });
  env = await configure(baseline);
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/operator"), {
      role: "OPERATIONS",
      companyId: "nextcon",
    });
    await setDoc(doc(context.firestore(), "users/client"), {
      role: "ADMIN",
      companyId: "client-a",
      tenantId: "client-a",
    });
    await setDoc(doc(context.firestore(), "companies/client-a/contracts/test"), {
      companyId: "client-a",
      createdAt: "2026-10-25",
    });
  });
  const archive = (uid: string) =>
    getDocs(
      query(
        collectionGroup(env.authenticatedContext(uid).firestore(), "contracts"),
        orderBy("createdAt", "desc"),
        limit(201)
      )
    );
  await assertFails(archive("operator"));
  await env.cleanup();
  env = await configure(patched);
  expect((await assertSucceeds(archive("operator"))).size).toBe(1);
  await assertFails(archive("client"));
  await assertFails(archive("unprovisioned"));
});
