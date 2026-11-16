import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { getStorage } from "firebase-admin/storage";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { adminDb } from "@/lib/firebase-admin";

it("converte uma referência já revogada mesmo quando o Firebase criou um token substituto", async () => {
  const project = "demo-nai-security";
  const bucket = project + ".appspot.com";
  expect(process.env.FIREBASE_STORAGE_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):/);
  expect(process.env.FIRESTORE_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):/);
  const env = await initializeTestEnvironment({ projectId: project });
  try {
    await env.clearFirestore();
    const old = randomUUID(),
      current = randomUUID();
    const path = "clientes/migrate/colaboradores/worker/" + randomUUID() + ".pdf";
    const object = getStorage().bucket(bucket).file(path);
    await object.save(Buffer.from("%PDF-1.4 synthetic"), {
      resumable: false,
      contentType: "application/pdf",
      metadata: { metadata: { firebaseStorageDownloadTokens: current } },
    });
    const base = "/v0/b/" + bucket + "/o/" + encodeURIComponent(path) + "?alt=media&token=";
    const record = adminDb.doc("companies/migrate/employees/worker");
    const legacy = "https://firebasestorage.googleapis.com" + base + old;
    await record.set({ documents: [{ name: "Teste", url: legacy }] });
    const endpoint = "http://" + process.env.FIREBASE_STORAGE_EMULATOR_HOST + base;
    expect([401, 403, 404]).toContain((await fetch(endpoint + old)).status);
    expect((await fetch(endpoint + current)).status).toBe(200);
    const args = [
      "--import",
      "tsx",
      "scripts/security/migrate-employee-attachments.ts",
      "--project",
      project,
      "--bucket",
      bucket,
    ];
    const run = promisify(execFile);
    const preview = JSON.parse((await run(process.execPath, args)).stdout);
    expect(preview).toMatchObject({ matchingProfiles: 1, migratedProfiles: 0 });
    expect((await record.get()).data()?.documents[0].url).toBe(legacy);
    const result = JSON.parse((await run(process.execPath, [...args, "--apply"])).stdout);
    expect(result).toMatchObject({ migratedProfiles: 1, revoked: 0, pendingRevocations: 0 });
    expect((await record.get()).data()?.documents).toEqual([{ name: "Teste", storagePath: path }]);
  } finally {
    await env.cleanup();
  }
});
