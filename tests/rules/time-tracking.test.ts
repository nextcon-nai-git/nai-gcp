import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "@/app/api/time-tracking/punch/route";
import { brasiliaDay } from "@/lib/time-tracking";
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async (r: NextRequest) => ({ uid: r.headers.get("tester") }),
}));
let env: RulesTestEnvironment;
const employee = { name: "Trabalhador sintético", contractType: "CLT", status: "active" };
const post = (uid: string, companyId = "all", employeeId = "clock-worker", extra = {}) =>
  POST(
    new NextRequest("https://test/api/time-tracking/punch", {
      method: "POST",
      headers: { "content-type": "application/json", tester: uid },
      body: JSON.stringify({ companyId, employeeId, type: "entrada", ...extra }),
    })
  );
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await Promise.all([
    adminDb.doc("users/clock-ops").set({ role: "OPERATIONS", companyId: "nextcon" }),
    adminDb.doc("users/clock-hr").set({ role: "HR", companyId: "clock-a" }),
    adminDb.doc("users/clock-client").set({ role: "CLIENT_ADMIN", companyId: "clock-a" }),
    adminDb.doc("users/clock-suspended").set({ role: "SUPER_ADMIN", accessEnabled: false }),
    adminDb.doc("companies/clock-a").set({ active: true }),
    adminDb.doc("nxc_employees/clock-worker").set(employee),
    adminDb
      .doc("companies/clock-a/employees/clock-worker")
      .set({ ...employee, companyId: "clock-a" }),
    adminDb.doc("companies/clock-a/employees/archived").set({ ...employee, isArchived: true }),
  ]);
});
afterAll(async () => {
  await env?.cleanup();
});
it("serializa dois pedidos simultâneos e consulta a batida pelo mesmo caminho usado no espelho", async () => {
  const replies = await Promise.all([post("clock-ops"), post("clock-ops")]);
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  const { punch } = await replies.find((r) => r.ok)!.json();
  expect(punch.date).toBe(brasiliaDay(new Date(punch.timestamp)));
  const path = "nxc_employees/clock-worker/time_clock_entries";
  const sdk = env.authenticatedContext("clock-ops").firestore();
  const entries = await assertSucceeds(getDocs(collection(sdk, path)));
  expect(entries.docs.map((d) => d.id)).toEqual([punch.id]);
  expect(entries.docs[0].data()).toMatchObject({
    createdBy: "clock-ops",
    employeeId: "clock-worker",
    reference: punch.reference,
  });
  await assertFails(updateDoc(doc(sdk, path, punch.id), { time: "00:00:00" }));
  await assertFails(deleteDoc(doc(sdk, path, punch.id)));
  await assertFails(
    getDoc(doc(env.authenticatedContext("clock-client").firestore(), path, punch.id))
  );
});
it("limita o administrador à sua empresa e rejeita dados de batida e identidade fornecidos pelo navegador", async () => {
  expect((await post("clock-client", "clock-a")).status).toBe(200);
  expect((await post("clock-client", "clock-a", "archived")).status).toBe(400);
  expect((await post("clock-client", "clock-b")).status).toBe(403);
  expect((await post("clock-hr", "clock-a")).status).toBe(403);
  expect((await post("clock-suspended")).status).toBe(403);
  expect((await post("clock-client")).status).toBe(403);
  expect((await post("clock-ops", "all", "clock-worker", { time: "00:01:00" })).status).toBe(400);
  const sdk = env.authenticatedContext("clock-client").firestore();
  await assertFails(
    setDoc(doc(sdk, "companies/clock-a/employees/clock-worker/time_clock_entries/fake"), {
      time: "00:00:00",
    })
  );
});
