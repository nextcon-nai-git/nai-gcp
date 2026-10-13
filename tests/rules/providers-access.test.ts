import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    for (const [uid, role, companyId, servedCompanies] of [
      ["internal-admin", "ADMIN", "nextcon", []],
      ["company-a-admin", "CLIENT_ADMIN", "company-a", []],
      ["company-b-admin", "CLIENT_ADMIN", "company-b", []],
      ["company-a-provider", "PROVIDER", "company-a", ["company-a"]],
    ] as const) {
      await setDoc(doc(context.firestore(), "users", uid), {
        id: uid,
        role,
        companyId,
        servedCompanies,
      });
    }
    await setDoc(doc(context.firestore(), "users/tenant-admin"), {
      id: "tenant-admin",
      role: "ADMIN",
      companyId: "nextcon",
      tenantId: "company-a",
    });

    await setDoc(doc(context.firestore(), "companies/company-a"), { name: "Empresa sintética A" });
    await setDoc(doc(context.firestore(), "companies/company-b"), { name: "Empresa sintética B" });
    await setDoc(doc(context.firestore(), "providers/provider-a"), {
      id: "provider-a",
      name: "Prestador fictício A",
      servedCompanies: ["company-a"],
    });
    await setDoc(doc(context.firestore(), "providers/provider-b"), {
      id: "provider-b",
      name: "Prestador fictício B",
      servedCompanies: ["company-b"],
    });
    await setDoc(doc(context.firestore(), "providers/provider-unlinked"), {
      id: "provider-unlinked",
      name: "Prestador fictício sem vínculo",
      servedCompanies: [],
    });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const db = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();

describe("providers collection authorization", () => {
  it("allows only internal staff to list provider registrations", async () => {
    const providerQuery = getDocs(collection(db("internal-admin"), "providers"));

    await expect(assertSucceeds(providerQuery)).resolves.toMatchObject({
      size: 3,
    });
    await assertFails(getDocs(collection(db("company-a-admin"), "providers")));
    await assertFails(getDocs(collection(db("company-b-admin"), "providers")));
    await assertFails(getDocs(collection(db("company-a-provider"), "providers")));
  });

  it("does not infer company access from a provider association or missing links", async () => {
    await assertFails(getDoc(doc(db("company-a-admin"), "providers/provider-a")));
    await assertFails(getDoc(doc(db("company-b-admin"), "providers/provider-b")));
    await assertFails(getDoc(doc(db("company-a-admin"), "providers/provider-unlinked")));
  });

  it("keeps company profiles isolated across the two fixture tenants", async () => {
    await assertSucceeds(getDoc(doc(db("company-a-admin"), "companies/company-a")));
    await assertFails(getDoc(doc(db("company-a-admin"), "companies/company-b")));
    await assertSucceeds(getDoc(doc(db("company-b-admin"), "companies/company-b")));
    await assertFails(getDoc(doc(db("company-b-admin"), "companies/company-a")));
  });

  it("does not treat an admin with an explicit tenant as internal staff", async () => {
    await assertFails(getDocs(collection(db("tenant-admin"), "providers")));
  });

  it("allows only inactive pending provider creation and a matching atomic reservation", async () => {
    const firestore = db("internal-admin");
    await assertFails(
      setDoc(doc(firestore, "providers/provider-active"), {
        id: "provider-active",
        taxIdStatus: "pending_verification",
        active: true,
      })
    );
    await assertFails(
      setDoc(doc(firestore, "providers/provider-verified"), {
        id: "provider-verified",
        taxIdStatus: "verified",
        active: true,
      })
    );

    const attemptId = "synthetic-attempt-id-001";
    const identityHash = "a".repeat(64);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, "providers/provider-pending"), {
      id: "provider-pending",
      cnpj: "12.345.678/0001-95",
      taxIdStatus: "pending_verification",
      active: false,
      importAttemptId: attemptId,
    });
    batch.set(doc(firestore, `provider_tax_id_reservations/${identityHash}`), {
      attemptId,
      identityHash,
      providerId: "provider-pending",
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it("blocks browser fiscal verification, allows demotion, and protects legacy identity", async () => {
    const firestore = db("internal-admin");
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "providers/pending"), {
        cnpj: "12.345.678/0001-95",
        taxIdStatus: "pending_verification",
        active: false,
      });
      await setDoc(doc(context.firestore(), "providers/verified"), {
        cnpj: "12.345.678/0001-95",
        taxIdStatus: "verified",
        active: true,
      });
      await setDoc(doc(context.firestore(), "providers/legacy"), {
        cnpj: "12.345.678/0001-95",
        active: true,
      });
      await setDoc(doc(context.firestore(), "providers/legacy-without-tax-id"), {
        name: "Prestador legado sem documento fiscal",
        active: true,
      });
    });

    await assertFails(
      updateDoc(doc(firestore, "providers/pending"), {
        taxIdStatus: "verified",
        active: true,
      })
    );
    await assertSucceeds(
      updateDoc(doc(firestore, "providers/verified"), {
        cnpj: "98.765.432/0001-10",
        taxIdStatus: "pending_verification",
        active: false,
      })
    );
    await assertFails(
      updateDoc(doc(firestore, "providers/legacy"), {
        cnpj: "98.765.432/0001-10",
        active: true,
      })
    );
    await assertSucceeds(updateDoc(doc(firestore, "providers/legacy"), { active: false }));
    await assertSucceeds(
      updateDoc(doc(firestore, "providers/legacy-without-tax-id"), { active: false })
    );
  });
});
