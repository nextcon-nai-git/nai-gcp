import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { firebaseConfig } from "@/firebase/config";
import { AuthError } from "@/lib/auth/errors";
export const maxPdfBytes = 15 * 1024 * 1024;
export const sourceBucket = () => getStorage().bucket(firebaseConfig.storageBucket);
export const pdfPath = (id: string, hash: string) =>
  `client-dossiers/v1/${encodeURIComponent(id)}/${hash}/source.pdf`;
export async function verifiedPdf(id: string, hash: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error("Leitura de documento cancelada.");
  // Request a bounded range, but also enforce the cap locally: Storage may
  // ignore Range when transcoding an object with unexpected encoding metadata.
  const stream = sourceBucket().file(pdfPath(id, hash)).createReadStream({
    start: 0,
    end: maxPdfBytes,
    validation: false,
    decompress: false,
  });
  const abort = () => stream.destroy(new Error("Leitura de documento cancelada."));
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    if (signal.aborted) abort();
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxPdfBytes)
        throw new AuthError("O PDF armazenado excede o limite permitido.", 409);
      chunks.push(bytes);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    stream.destroy();
  }
  const bytes = Buffer.concat(chunks, size);
  if (
    bytes.subarray(0, 5).toString() !== "%PDF-" ||
    createHash("sha256").update(bytes).digest("hex") !== hash
  )
    throw new AuthError(
      "A integridade do PDF não foi confirmada. Revise o documento original.",
      409
    );
  return bytes;
}
