import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;
const basic = { id: "alice", email: "alice@example.test", name: "Alice" };

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Run npm run test:rules; these tests require the local emulator.");
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  await env?.cleanup();
});

function ownProfile() {
  return doc(env.authenticatedContext("alice", { email: basic.email }).firestore(), "users/alice");
}

describe("self-managed profile security rules", () => {
  it("allows basic creation and later editing before roles are provisioned", async () => {
    const ref = ownProfile();
    await assertSucceeds(setDoc(ref, basic));
    await assertSucceeds(updateDoc(ref, { name: "Alice atualizada", crm: "12345" }));
    await assertSucceeds(getDoc(ref));
  });

  it.each(["role", "companyId", "servedCompanies"])(
    "rejects adding %s on creation and update",
    async (field) => {
      const ref = ownProfile();
      const value = field === "servedCompanies" ? ["other-company"] : "ADMIN";
      await assertFails(setDoc(ref, { ...basic, [field]: value }));
      await assertSucceeds(setDoc(ref, basic));
      await assertFails(updateDoc(ref, { [field]: value }));
    }
  );

  it("preserves provisioned access fields, including when deletion is attempted", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/alice"), {
        ...basic,
        role: "PROVIDER",
        companyId: "clinic",
        servedCompanies: ["clinic"],
      });
    });
    const ref = ownProfile();
    await assertSucceeds(updateDoc(ref, { name: "Alice atualizada" }));
    for (const field of ["role", "companyId", "servedCompanies"]) {
      await assertFails(updateDoc(ref, { [field]: deleteField() }));
    }
    await assertFails(updateDoc(ref, { role: "SUPER_ADMIN" }));
    await assertFails(updateDoc(ref, { companyId: "another-company" }));
    await assertFails(updateDoc(ref, { servedCompanies: ["another-company"] }));
  });

  it("rejects identity changes, foreign profiles and unauthenticated writes", async () => {
    const ref = ownProfile();
    await assertFails(setDoc(ref, { ...basic, email: "other@example.test" }));
    await assertSucceeds(setDoc(ref, basic));
    await assertFails(updateDoc(ref, { email: "other@example.test" }));
    await assertFails(updateDoc(ref, { id: "bob" }));
    await assertFails(
      setDoc(
        doc(
          env.authenticatedContext("bob", { email: "bob@example.test" }).firestore(),
          "users/alice"
        ),
        basic
      )
    );
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "users/alice"), basic));
  });
});
