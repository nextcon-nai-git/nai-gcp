import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;
const roles = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "CLIENT_ADMIN", "HR", "PROVIDER", "USER"];

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const role of roles) {
      await setDoc(doc(ctx.firestore(), "users", role), {
        role,
        companyId: "avp",
        servedCompanies: [],
      });
    }
    for (const company of ["avp", "other"]) {
      await setDoc(doc(ctx.firestore(), `companies/${company}/tasks/priority`), {
        companyId: company,
        dueDate: "2026-10-07",
        title: "Synthetic task",
      });
      await setDoc(doc(ctx.firestore(), `companies/${company}/medical_records/record`), {
        notes: "Synthetic clinical data",
      });
    }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const dashboardQuery = (context: RulesTestContext) =>
  query(collectionGroup(context.firestore(), "tasks"), orderBy("dueDate", "asc"), limit(5));

describe("Dashboard task collection group", () => {
  it.each(["SUPER_ADMIN", "ADMIN", "OPERATIONS"])(
    "allows existing global reader %s",
    async (role) => {
      const result = await assertSucceeds(getDocs(dashboardQuery(env.authenticatedContext(role))));
      expect(result.docs.map((item) => item.ref.path).sort()).toEqual([
        "companies/avp/tasks/priority",
        "companies/other/tasks/priority",
      ]);
    }
  );

  it.each(["CLIENT_ADMIN", "HR", "PROVIDER", "USER", "unprovisioned"])(
    "denies global tasks to %s",
    async (role) => {
      await assertFails(getDocs(dashboardQuery(env.authenticatedContext(role))));
    }
  );

  it("denies unauthenticated global reads", async () => {
    await assertFails(getDocs(dashboardQuery(env.unauthenticatedContext())));
  });

  it("preserves company-scoped reads and rejects foreign reads and writes", async () => {
    const db = env.authenticatedContext("CLIENT_ADMIN").firestore();
    await assertSucceeds(
      getDocs(query(collection(db, "companies/avp/tasks"), orderBy("dueDate"), limit(5)))
    );
    await assertFails(getDocs(collection(db, "companies/other/tasks")));
    await assertFails(setDoc(doc(db, "companies/other/tasks/new"), { title: "Blocked" }));
  });

  it("does not grant operations access to clinical collection groups", async () => {
    await assertFails(
      getDocs(
        collectionGroup(env.authenticatedContext("OPERATIONS").firestore(), "medical_records")
      )
    );
  });
});
