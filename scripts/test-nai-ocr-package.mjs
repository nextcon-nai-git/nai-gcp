import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { makeAsoScan } from "../tests/fixtures/nai-scan.mjs";

const root = await mkdtemp(join(tmpdir(), "nai-ocr-package-"));
try {
  // Parent node_modules in a checkout can mask missing native libraries or trained data.
  await cp(".next/standalone", root, { recursive: true, dereference: true });
  const { png, pdf } = await makeAsoScan();
  for (const [mime, bytes] of [
    ["image/png", png],
    ["application/pdf", pdf],
  ]) {
    const reader = new Worker(join(root, "scripts/nai-document-ocr.mjs"), {
      workerData: { mime, bytes },
      resourceLimits: { maxOldGenerationSizeMb: 160 },
    });
    let timer;
    try {
      const result = await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("OCR timed out")), 35000);
        reader.once("message", resolve);
        reader.once("error", reject);
        reader.once("exit", () => reject(new Error("OCR exited without a result")));
      });
      assert.equal(result.status, "ok");
      assert.match(result.texts[0], /Pessoa Ficticia Alfa/);
      assert.match(result.texts[0], /Analista/);
    } finally {
      clearTimeout(timer);
      await reader.terminate();
    }
  }
  process.stdout.write("Packaged OCR read the synthetic image and PDF.\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
