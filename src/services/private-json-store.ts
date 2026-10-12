import "server-only";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { z } from "zod";
import { AuthError } from "@/lib/auth/errors";
export const privateBucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number(e.code) : 0);
export async function readPrivate<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  initial: () => T
) {
  const file = privateBucket().file(path);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (e) {
    if (code(e) === 404) return { value: initial(), generation: "0" };
    throw e;
  }
  const generation = String(metadata.generation || "");
  if (!/^\d+$/.test(generation) || Number(metadata.size) > 16 * 1024 * 1024)
    throw new Error("Invalid private object metadata");
  let bytes: Buffer;
  try {
    [bytes] = await privateBucket().file(path, { generation }).download();
  } catch (e) {
    if (code(e) === 404) throw new AuthError("Registro alterado. Atualize a consulta.", 409);
    throw e;
  }
  if (bytes.length > 16 * 1024 * 1024)
    throw new AuthError("Acervo acima do limite operacional.", 413);
  return { value: schema.parse(JSON.parse(bytes.toString("utf8"))), generation };
}
export async function writePrivate(path: string, value: unknown, generation: string) {
  const data = JSON.stringify(value);
  if (Buffer.byteLength(data) > 16 * 1024 * 1024)
    throw new AuthError("Acervo acima do limite operacional.", 413);
  try {
    await privateBucket()
      .file(path)
      .save(data, {
        resumable: false,
        contentType: "application/json",
        metadata: { cacheControl: "private, no-store" },
        preconditionOpts: { ifGenerationMatch: generation },
      });
  } catch (e) {
    if (code(e) === 412)
      throw new AuthError(
        "Outra sessão alterou o registro. Atualize antes de tentar novamente.",
        409
      );
    throw e;
  }
}
