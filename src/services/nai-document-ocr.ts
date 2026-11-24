import "server-only";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

let occupied = false;

/** Bounded local OCR, with no upload, shared document cache or patient data in logs. */
export async function readNaiScan(dataUri: string): Promise<string[]> {
  if (occupied) return [];
  const comma = dataUri.indexOf(",");
  const mime = dataUri.slice(5, comma).split(";")[0];
  occupied = true;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    worker = new Worker(join(process.cwd(), "scripts/nai-document-ocr.mjs"), {
      workerData: { mime, bytes: Buffer.from(dataUri.slice(comma + 1), "base64") },
      resourceLimits: { maxOldGenerationSizeMb: 160 },
    });
    const reader = worker;
    return await new Promise<string[]>((resolve) => {
      timer = setTimeout(() => resolve([]), 35000);
      reader.once("message", (texts: string[]) => resolve(texts));
      reader.once("error", () => resolve([]));
      reader.once("exit", () => resolve([]));
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    try {
      await worker?.terminate();
    } finally {
      occupied = false;
    }
  }
}
