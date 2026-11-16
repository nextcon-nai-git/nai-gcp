import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getDoc, getDocs, doc, setDoc, collection, updateDoc } from "firebase/firestore";
import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "@/app/api/operational/tasks/route";
import { BRITANIA_ANCHOR as anchor } from "@/lib/britania-group";
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async (req: NextRequest) => ({ uid: req.headers.get("tester") }),
}));
let env: RulesTestEnvironment;
const root = "companies/" + anchor + "/tasks/";
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.clearFirestore();
  const batch = adminDb.batch();
  for (const [uid, profile] of Object.entries({
    site: { role: "HR", companyId: anchor },
    foreign: { role: "HR", tenantId: "foreign" },
    ops: { role: "OPERATIONS", companyId: "nextcon" },
    admin: { role: "ADMIN" },
    mixed: { role: "OPERATIONS", tenantId: "nextcon" },
    provider: { role: "PROVIDER", servedCompanies: [anchor] },
    suspended: { role: "SUPER_ADMIN", accessEnabled: false },
  }))
    batch.set(adminDb.doc("users/" + uid), profile);
  for (const [path, title] of [
    [root + "document_hash_0", "INSTRUÇÃO RESTRITA"],
    [root + "public", "Tarefa da unidade"],
    ["companies/foreign/tasks/sample", "Outra unidade"],
  ])
    batch.set(adminDb.doc(path), {
      title,
      companyId: path.split("/")[1],
      dueDate: "2026-11-19",
      createdAt: "2026-11-01",
    });
  await batch.commit();
});
afterAll(async () => {
  await env?.cleanup();
});
const query = (u: string, company: string, order = "due") =>
  GET(
    new NextRequest(
      "https://test/api/operational/tasks?" + new URLSearchParams({ company, order }),
      { headers: { tester: u } }
    )
  );
it("mantém as ações operacionais no quadro sem expor instruções consolidadas", async () => {
  for (const uid of ["site", "ops", "provider"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, root + "document_hash_0")));
    await assertFails(getDocs(collection(db, "companies", anchor, "tasks")));
    await assertFails(updateDoc(doc(db, root + "document_hash_0"), { companyId: "foreign" }));
    const response = await query(uid, anchor);
    expect(response.status).toBe(200);
    expect((await response.json()).tasks.map((t: { title: string }) => t.title)).toEqual([
      "Tarefa da unidade",
    ]);
  }
  for (const [uid, scope] of [
    ["foreign", anchor],
    ["site", "all"],
    ["mixed", "all"],
    ["suspended", "all"],
  ])
    expect((await query(uid, scope)).status).toBe(403);
});
it("trata a carteira global, a lista multiempresa e a consulta comercial", async () => {
  for (const order of ["due", "recent"]) {
    const ops = (await (await query("ops", "all", order)).json()).tasks;
    expect(ops).toHaveLength(2);
    expect(JSON.stringify(ops)).not.toContain("INSTRUÇÃO RESTRITA");
    const admin = (await (await query("admin", anchor, order)).json()).tasks;
    expect(JSON.stringify(admin)).toContain("INSTRUÇÃO RESTRITA");
  }
  expect((await (await query("provider", "assigned")).json()).tasks).toHaveLength(1);
});
