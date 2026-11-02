import "server-only";
import { getStorage } from "firebase-admin/storage";
import { firebaseConfig } from "@/firebase/config";
import { AuthError } from "@/lib/auth/errors";
import { esocialDocumentId } from "./access";
import { esocialHash } from "./records";

export type EsocialArtifactKind = "unsigned" | "signed" | "response";
export interface EsocialArtifact {
  path: string;
  hash: string;
  bytes: number;
}
const MAX_BYTES = 2 * 1024 * 1024;
const prefix = (companyId: string, id: string) =>
  `esocial-private/v1/${esocialDocumentId(companyId)}/${esocialDocumentId(id)}/`;

/** Immutable, hash-addressed private objects. No Firebase download token or public URL. */
export async function saveEsocialArtifact(
  companyId: string,
  id: string,
  kind: EsocialArtifactKind,
  xml: string
): Promise<EsocialArtifact> {
  const data = Buffer.from(xml, "utf8");
  if (!data.length || data.length > MAX_BYTES)
    throw new AuthError("Documento eSocial acima do limite permitido.", 400);
  const hash = esocialHash(data);
  const path = `${prefix(companyId, id)}${kind}-${hash}.xml`;
  await getStorage()
    .bucket(firebaseConfig.storageBucket)
    .file(path)
    .save(data, {
      resumable: false,
      contentType: "application/xml; charset=utf-8",
      metadata: { cacheControl: "private, no-store", metadata: { sha256: hash } },
    });
  return { path, hash, bytes: data.length };
}

export async function readEsocialArtifact(
  companyId: string,
  id: string,
  kind: EsocialArtifactKind,
  artifact: EsocialArtifact
): Promise<string> {
  if (
    !artifact ||
    !/^[a-f0-9]{64}$/.test(artifact.hash) ||
    artifact.bytes < 1 ||
    artifact.bytes > MAX_BYTES ||
    artifact.path !== `${prefix(companyId, id)}${kind}-${artifact.hash}.xml`
  )
    throw new AuthError("Referência do documento inválida.", 409);
  const file = getStorage().bucket(firebaseConfig.storageBucket).file(artifact.path);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) !== artifact.bytes)
    throw new AuthError("Tamanho do documento divergente.", 409);
  const [bytes] = await file.download({ validation: "crc32c" });
  if (bytes.length !== artifact.bytes || esocialHash(bytes) !== artifact.hash)
    throw new AuthError("Integridade do documento não confirmada.", 409);
  return bytes.toString("utf8");
}
