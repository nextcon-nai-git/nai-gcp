import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getBytes, getMetadata, listAll, ref, uploadBytes } from "firebase/storage";

let env: RulesTestEnvironment;
const root = "clinic_portal_private/esocial-messaging";
const documentPaths = [
  root,
  `${root}/events/synthetic-event`,
  `${root}/events/synthetic-event/history/1`,
  `${root}/events/synthetic-event/attempts/synthetic-attempt`,
  `${root}/certificates/synthetic-certificate`,
  `${root}/settings/certificate`,
  `${root}/grants/esocial-company-a`,
  `${root}/links/synthetic-employment-link`,
  `${root}/readiness/synthetic-readiness`,
  `${root}/eventIds/synthetic-reservation`,
];
const profiles = [
  ["esocial-admin", "SUPER_ADMIN", null],
  ["esocial-internal-admin", "ADMIN", null],
  ["esocial-ops", "OPERATIONS", null],
  ["esocial-doctor", "DOCTOR", null],
  ["esocial-client", "CLIENT_ADMIN", "esocial-company-a"],
  ["esocial-foreign-client", "CLIENT_ADMIN", "esocial-company-b"],
] as const;
const objectPaths = ["esocial-company-a", "esocial-company-b"].flatMap((company) =>
  ["unsigned", "signed", "response"].map(
    (kind) => `esocial-private/v1/${company}/synthetic-event/${kind}-${"a".repeat(64)}.xml`
  )
);
const syntheticXml = new TextEncoder().encode(
  '<?xml version="1.0"?><synthetic>No clinical or certificate data</synthetic>'
);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role, tenantId] of profiles)
      await setDoc(doc(ctx.firestore(), "users", uid), {
        role,
        tenantId,
        companyId: tenantId || "nextcon",
        accessEnabled: true,
        servedCompanies: ["esocial-company-a"],
      });
    for (const path of documentPaths)
      await setDoc(doc(ctx.firestore(), path), {
        companyId: "esocial-company-a",
        synthetic: true,
        status: "draft",
        active: false,
        payload: { synthetic: true },
      });
    for (const path of objectPaths)
      await uploadBytes(ref(ctx.storage(), path), syntheticXml, {
        contentType: "application/xml",
        cacheControl: "private, no-store",
      });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
const identities = [...profiles.map(([uid]) => uid), "esocial-unregistered", "anonymous"];
function context(uid: string) {
  return uid === "anonymous"
    ? env.unauthenticatedContext()
    : env.authenticatedContext(uid, {
        role: uid.includes("admin") ? "SUPER_ADMIN" : "DOCTOR",
        servedCompanies: ["esocial-company-a", "esocial-company-b"],
      });
}

describe("eSocial: browser SDK cannot read/write private records, even with administrative claims", () => {
  it.each(identities)("server authorization is mandatory for %s", async (uid) => {
    const db = context(uid).firestore();
    for (const path of documentPaths) await assertFails(getDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, `${root}/events`)));
    await assertFails(getDocs(collection(db, `${root}/certificates`)));
    await assertFails(
      setDoc(doc(db, `${root}/events/forged-${uid}`), {
        companyId: "esocial-company-a",
        status: "accepted",
        receipt: "1.1.0000000000000000001",
        xsdValidated: true,
      })
    );
    await assertFails(
      updateDoc(doc(db, `${root}/grants/esocial-company-a`), {
        active: true,
        profiles: ["sst", "toxicology"],
      })
    );
    await assertFails(
      updateDoc(doc(db, `${root}/settings/certificate`), { activeId: "forged-certificate" })
    );
    await assertFails(
      deleteDoc(doc(db, `${root}/events/synthetic-event/attempts/synthetic-attempt`))
    );
  });
});

describe("eSocial: XML artifacts are private server objects for all clients and roles", () => {
  it.each(identities)("no direct download, metadata, listing or overwrite for %s", async (uid) => {
    const storage = context(uid).storage();
    for (const path of objectPaths) await assertFails(getBytes(ref(storage, path)));
    await assertFails(getMetadata(ref(storage, objectPaths[0])));
    await assertFails(
      listAll(ref(storage, "esocial-private/v1/esocial-company-a/synthetic-event"))
    );
    await assertFails(
      uploadBytes(ref(storage, objectPaths[0]), syntheticXml, { contentType: "application/xml" })
    );
    await assertFails(
      uploadBytes(
        ref(storage, `esocial-private/v1/esocial-company-a/forged-${uid}/signed.xml`),
        syntheticXml,
        { contentType: "application/xml" }
      )
    );
    await assertFails(deleteObject(ref(storage, objectPaths[0])));
  });
});
