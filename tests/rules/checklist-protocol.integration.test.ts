import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { privateBucket } from "@/services/private-json-store";
import { POST } from "@/app/api/checklists/route";
vi.mock("@/firebase/config", () => ({
  firebaseConfig: { storageBucket: "demo-nai-security.appspot.com" },
}));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async (r: NextRequest) => ({ uid: r.headers.get("tester") }),
}));
const companyId = "checklist-unit";
const company = adminDb.collection("companies").doc(companyId);
const auditor = "checklist-engineer";
let env: RulesTestEnvironment;
beforeAll(async () => {
  expect(process.env.FIREBASE_STORAGE_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):/);
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
  await company.set({ name: "Unidade sintética", active: true });
  await adminDb.doc("users/" + auditor).set({ role: "ENGINEER", tenantId: companyId });
  await adminDb.doc("users/checklist-foreign").set({ role: "ENGINEER", tenantId: "foreign" });
  await adminDb.doc("users/checklist-admin").set({ role: "ADMIN", tenantId: companyId });
});
afterAll(async () => {
  await env?.cleanup();
});
const request = (payload: object, uid = auditor) =>
  POST(
    new NextRequest("https://example.test/api/checklists", {
      method: "POST",
      headers: { tester: uid, "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
const input = () => ({
  protocolId: randomUUID(),
  companyId,
  nr: "nr07",
  responses: { "7.1": "CONFORME", "7.2": "NÃO AVALIADO" },
});
it("apenas uma versão vence em duas abas; a repetição preserva o PDF e o registro", async () => {
  const a = input();
  const b = { ...a, responses: { ...a.responses, "7.1": "NÃO CONFORME" } };
  const replies = await Promise.all([request(a), request(b)]);
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = replies[0].ok ? a : b;
  const report = company.collection("reports").doc("checklist_" + a.protocolId);
  const data = (await report.get()).data()!;
  expect(data.auditData.responses).toEqual(winner.responses);
  const file = privateBucket().file(data.storagePath);
  const [bytes] = await file.download();
  expect(bytes.toString("latin1", 0, 5)).toBe("%PDF-");
  const [metadata] = await file.getMetadata();
  expect((await (await request(winner)).json()).alreadyRegistered).toBe(true);
  expect((await file.getMetadata())[0].generation).toBe(metadata.generation);
  expect((await company.collection("checklist_reservations").doc(a.protocolId).get()).exists).toBe(
    false
  );
  const ctx = env.authenticatedContext("checklist-admin");
  const storageRef = ref(ctx.storage("gs://demo-nai-security.appspot.com"), data.storagePath);
  await assertSucceeds(getBytes(storageRef));
  await assertFails(
    uploadBytes(storageRef, new Uint8Array([1]), { contentType: "application/pdf" })
  );
  await assertFails(updateDoc(doc(ctx.firestore(), report.path), { name: "Outro" }));
  await assertFails(deleteDoc(doc(ctx.firestore(), report.path)));
});
it("rejeita campos faltantes, autoridade externa e a falsificação do auditor", async () => {
  const a = input();
  expect((await request({ ...a, responses: { "7.1": "CONFORME" } })).status).toBe(400);
  expect((await request({ ...a, auditorId: "outro" })).status).toBe(400);
  expect((await request(a, "checklist-foreign")).status).toBe(403);
  expect((await company.collection("checklist_reservations").doc(a.protocolId).get()).exists).toBe(
    false
  );
});

it("retoma o protocolo se o PDF foi gravado antes de concluir o registro", async () => {
  const payload = input();
  expect((await request(payload)).status).toBe(200);
  const report = company.collection("reports").doc("checklist_" + payload.protocolId);
  const archived = (await report.get()).data()!;
  // Reproduce the boundary between the durable object upload and Firestore commit.
  const tx = adminDb.batch();
  tx.delete(report);
  tx.create(company.collection("checklist_reservations").doc(payload.protocolId), {
    auditData: archived.auditData,
    companyName: archived.companyName,
  });
  await tx.commit();
  const retried = await request(payload);
  expect(retried.status).toBe(200);
  expect((await report.get()).data()?.auditData).toEqual(archived.auditData);
  const before = await privateBucket().file(archived.storagePath).download();
  const after = await request(payload);
  expect((await after.json()).alreadyRegistered).toBe(true);
  expect((await privateBucket().file(archived.storagePath).download())[0]).toEqual(before[0]);
});
