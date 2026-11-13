import "server-only";
import { getStorage } from "firebase-admin/storage";
import { firebaseConfig } from "@/firebase/config";
import { AuthError } from "@/lib/auth/errors";

// Both aggregates are generation-checked Storage objects. Hold the shared guard
// across validation AND the object write. Never steal an expired lease from a
// writer that may still commit. Two hours exceeds the Cloud Run request limit.
export async function withProductionFinanceLock<T>(
  requestId: string,
  write: () => Promise<T>
): Promise<T> {
  const file = getStorage()
    .bucket(firebaseConfig.storageBucket)
    .file("financial-operations/v1/locks/service-associations");
  const acquire = (generation: number | string) =>
    file.save(requestId, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: generation },
      metadata: { cacheControl: "private, no-store" },
    });
  try {
    await acquire(0);
  } catch (error) {
    const busy = () =>
      new AuthError(
        "Outra alteração de contrato ou distribuição está em andamento. Atualize antes de repetir.",
        409
      );
    if (Number((error as { code?: number }).code) !== 412) throw error;
    const [held] = await file.getMetadata().catch((failure: { code?: number }) => {
      if (Number(failure.code) === 404) throw busy();
      throw failure;
    });
    const created = Date.parse(String(held.timeCreated));
    if (!held.generation || !Number.isFinite(created) || Date.now() - created < 2 * 60 * 60 * 1000)
      throw busy();
    try {
      await acquire(String(held.generation));
    } catch (failure) {
      if (Number((failure as { code?: number }).code) === 412) throw busy();
      throw failure;
    }
  }
  const [meta] = await file.getMetadata();
  try {
    return await write();
  } finally {
    await file.delete({ ifGenerationMatch: String(meta.generation) });
  }
}
