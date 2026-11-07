import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/integrations/soc/results/route";
import { adminDb } from "@/lib/firebase-admin";
import { parseSocExamResults } from "@/lib/integrations/soc-exam-results";

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async () => ({ uid: "test-operator", role: "ADMIN" }),
}));
vi.mock("@/lib/integrations/soc", () => ({ requireSocAccess: vi.fn() }));

let env: RulesTestEnvironment;
const root = () => adminDb.collection("webhook_deliveries").doc("soc-exam-results");
const imports = () => root().collection("imports");
const row = (code: string) => ({ EMPRESA: "1", NOMEEMPRESA: "Empresa sintética", CODEXAME: code });
const send = (rows: ReturnType<typeof row>[]) =>
  POST(new NextRequest("https://example.test/api/integrations/soc/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  }));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => {
  await env?.cleanup();
  await adminDb.terminate();
});

it("publica uma única vez sob concorrência e preserva o lote mais recente após um reenvio tardio", async () => {
  const first = [row("1"), row("2")];
  const reversed = [...first].reverse();
  const attempts = await Promise.all([send(first), send(reversed)]);
  expect(attempts.map((r) => r.status)).toEqual([200, 200]);
  const results = await Promise.all(attempts.map((r) => r.json()));
  expect(results.filter((r) => r.imported)).toHaveLength(1);
  expect(results.filter((r) => r.duplicate)).toHaveLength(1);
  const original = (await root().get()).get("importId");
  // The caller lost the previous response. Retrying must not create another entry.
  expect(await (await send(reversed)).json()).toMatchObject({ imported: false, duplicate: true });
  expect((await send([row("3")])).status).toBe(200);
  const current = (await root().get()).data();
  expect((await send(reversed)).status).toBe(409);
  expect((await root().get()).data()).toEqual(current);
  expect((await imports().get()).size).toBe(2);
  expect((await imports().doc(original).collection("chunks").get()).size).toBe(1);
});

it("reconhece lotes antigos com UUID, ordem diferente e classificação clínica anterior", async () => {
  const first = [{ ...row("250"), NOMEEXAME: "Avaliação Clínica" }, row("2")];
  const legacyRows = parseSocExamResults(first).rows;
  legacyRows[0].derivedStatus = "FALTA_AUSENCIA";
  const historical = {
    importId: randomUUID(),
    hash: createHash("sha256").update(JSON.stringify(legacyRows)).digest("hex"),
    importedAt: "2026-11-01T00:00:00.000Z",
    summary: { uniqueRows: 2 },
  };
  const ref = imports().doc(historical.importId);
  await ref.set(historical);
  await ref.collection("chunks").doc("0000").set({ index: 0, rows: legacyRows });
  await root().set(historical);
  expect(await (await send([...first].reverse())).json()).toMatchObject({ imported: false, duplicate: true });
  expect((await send([row("3")])).status).toBe(200);
  const newer = (await root().get()).data();
  expect((await send([...first].reverse())).status).toBe(409);
  expect((await root().get()).data()).toEqual(newer);
  expect((await ref.get()).data()).toEqual(historical);
});
