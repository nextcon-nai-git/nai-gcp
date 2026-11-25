import "server-only";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { NaiOcrFailure } from "@/lib/pgr-schema";

type Scan = { status: "ok"; texts: string[] } | { status: NaiOcrFailure };
let occupied = false;

/** One bounded reader per process. Worker errors may contain file data; never log them. */
export async function readNaiScan(dataUri: string, pageCount: number): Promise<Scan> {
  if (pageCount > 3) return { status: "page_limit" };
  if (occupied) return { status: "busy" };
  const comma = dataUri.indexOf(",");
  const mime = dataUri.slice(5, comma).split(";")[0];
  occupied = true;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    worker = new Worker(join(process.cwd(), "scripts/nai-document-ocr.mjs"), {
      workerData: { mime, bytes: Buffer.from(dataUri.slice(comma + 1), "base64") },
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 160 },
    });
    // The OCR and rendering libraries can write diagnostics directly to the worker streams.
    // Expose only the fixed status emitted by the parent.
    worker.stdout?.resume();
    worker.stderr?.resume();
    const reader = worker;
    return await new Promise<Scan>((resolve) => {
      timer = setTimeout(() => resolve({ status: "timeout" }), 35000);
      reader.once("message", resolve);
      reader.once("error", (error: NodeJS.ErrnoException) =>
        resolve({
          status: ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(error.code || "")
            ? "dependency"
            : "failed",
        })
      );
      reader.once("exit", () => resolve({ status: "failed" }));
    });
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
    try {
      await worker?.terminate();
    } finally {
      occupied = false;
    }
  }
}
