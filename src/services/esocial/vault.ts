import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { auth, secretmanager } from "googleapis/build/src/apis/secretmanager";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest } from "@/lib/auth/errors";
import type { EsocialCertificateStatus } from "@/lib/esocial-messaging";
import { inspectPkcs12, type CertificateMaterial } from "./certificate";
import {
  currentEsocialUser,
  esocialDocumentId,
  esocialPrivateRoot,
  requireEsocialAdministrator,
} from "./access";

// JSON/base64 must fit the Secret Manager 64 KiB payload limit.
const MAX_PFX_BYTES = 40 * 1024;
type StoredCertificate = {
  id: string;
  secretVersion: string;
  holder: string;
  issuer: string;
  registration: string;
  registrationType: "1" | "2";
  serialNumber: string;
  fingerprint: string;
  validFrom: string;
  validUntil: string;
  uploadedAt: string;
  uploadedBy: string;
  active: boolean;
  verifiedInRestricted?: boolean;
};
const certificates = () => esocialPrivateRoot().collection("certificates");
const activeRef = () => esocialPrivateRoot().collection("settings").doc("certificate");
const registration = (input: string) => input.replace(/[.\-/\s]/g, "").toUpperCase();
function secretName() {
  const name = process.env.ESOCIAL_A1_SECRET_NAME || "";
  if (!/^projects\/[a-zA-Z0-9-]+\/secrets\/nai-esocial-a1(?:-[a-zA-Z0-9-]+)?$/.test(name))
    return null;
  return name;
}
function isPinnedSecretVersion(value: unknown, name: string): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(`${name}/versions/`) &&
    /^\d+$/.test(value.slice(`${name}/versions/`.length))
  );
}
async function manager() {
  const secretManagerAuth = new auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  return secretmanager({ version: "v1", auth: secretManagerAuth });
}
/** Tests actual permissions; a variable being present is not connection readiness. */
export async function esocialVaultReady(): Promise<boolean> {
  const name = secretName();
  if (!name) return false;
  try {
    const api = await manager();
    const result = await api.projects.secrets.testIamPermissions(
      {
        resource: name,
        requestBody: {
          permissions: ["secretmanager.versions.add", "secretmanager.versions.access"],
        },
      },
      { timeout: 10000, retry: false }
    );
    const permissions = result.data.permissions || [];
    return (
      permissions.includes("secretmanager.versions.add") &&
      permissions.includes("secretmanager.versions.access")
    );
  } catch {
    return false;
  }
}
export async function esocialCertificateStatus(): Promise<EsocialCertificateStatus> {
  const vaultConfigured = await esocialVaultReady();
  const pointer = (await activeRef().get()).data();
  const id = typeof pointer?.activeId === "string" ? pointer.activeId : "";
  const record = id
    ? ((await certificates().doc(esocialDocumentId(id)).get()).data() as
        StoredCertificate | undefined)
    : undefined;
  if (!record || !record.active)
    return {
      configured: false,
      vaultConfigured,
      localValid: false,
      reason: vaultConfigured
        ? "Envie o certificado A1 para configurar a assinatura."
        : "O cofre do certificado aguarda provisionamento e permissão do serviço.",
    };
  const now = Date.now();
  const localValid = Date.parse(record.validFrom) <= now && Date.parse(record.validUntil) > now;
  return {
    configured: true,
    vaultConfigured,
    localValid,
    id: record.id,
    holder: record.holder,
    issuer: record.issuer,
    registration: record.registration,
    registrationType: record.registrationType,
    serialNumber: record.serialNumber,
    fingerprint: record.fingerprint,
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    uploadedAt: record.uploadedAt,
    verifiedInRestricted: record.verifiedInRestricted === true,
    reason: !localValid
      ? "Certificado fora da validade. Envie a renovação."
      : !vaultConfigured
        ? "Permissão de acesso ao cofre indisponível."
        : record.verifiedInRestricted
          ? undefined
          : "Formato e validade conferidos localmente; autorização e cadeia aguardam validação pelo eSocial em produção restrita.",
  };
}
export async function uploadEsocialCertificate(
  user: AuthContext,
  bytes: Buffer,
  password: string,
  expectedRegistration: string
) {
  const current = await currentEsocialUser(user);
  requireEsocialAdministrator(current);
  if (bytes.length < 100 || bytes.length > MAX_PFX_BYTES || password.length > 1024)
    throw badRequest("Envie um certificado PFX/P12 válido de até 40 KB.");
  const name = secretName();
  if (!name || !(await esocialVaultReady()))
    throw new AuthError("O cofre seguro precisa estar provisionado antes do upload do A1.", 503);
  let material: CertificateMaterial;
  try {
    material = await inspectPkcs12(bytes, password);
  } catch {
    throw badRequest(
      "Não foi possível validar o certificado A1. Confira arquivo, senha, titular, finalidade e validade."
    );
  }
  if (
    !expectedRegistration ||
    registration(expectedRegistration) !== material.metadata.holder.number
  )
    throw badRequest("O titular do certificado não corresponde ao CPF/CNPJ confirmado.");
  const id = randomUUID().replaceAll("-", "");
  const api = await manager();
  let secretVersion: string;
  try {
    const value = JSON.stringify({ format: 1, pfx: bytes.toString("base64"), password });
    const response = await api.projects.secrets.addVersion(
      { parent: name, requestBody: { payload: { data: Buffer.from(value).toString("base64") } } },
      { timeout: 15000, retry: false }
    );
    if (!isPinnedSecretVersion(response.data.name, name)) throw new Error("Missing version");
    secretVersion = response.data.name;
  } catch {
    throw new AuthError(
      "O cofre não confirmou o armazenamento do certificado. Nenhuma transmissão foi liberada.",
      503
    );
  }
  const at = new Date().toISOString();
  const record: StoredCertificate = {
    id,
    secretVersion,
    holder: material.metadata.subject,
    issuer: material.metadata.issuer,
    registration: material.metadata.holder.number,
    registrationType: material.metadata.holder.type,
    serialNumber: material.metadata.serialNumber,
    fingerprint: material.metadata.fingerprint256,
    validFrom: material.metadata.validFrom,
    validUntil: material.metadata.validUntil,
    uploadedAt: at,
    uploadedBy: user.uid,
    active: true,
  };
  await adminTransaction(async (tx) => {
    const previous = (await tx.get(activeRef())).data();
    tx.create(certificates().doc(id), record);
    if (typeof previous?.activeId === "string")
      tx.update(certificates().doc(previous.activeId), {
        active: false,
        retiredAt: at,
        retiredBy: user.uid,
      });
    tx.set(activeRef(), { activeId: id, updatedAt: at, updatedBy: user.uid });
    tx.create(esocialPrivateRoot().collection("audit").doc(randomUUID()), {
      action: "certificate_uploaded",
      certificateId: id,
      fingerprint: record.fingerprint,
      actor: user.uid,
      at,
    });
  });
  return esocialCertificateStatus();
}
// Kept local so test doubles do not have to emulate a second Firestore instance.
async function adminTransaction<T>(
  run: (tx: import("firebase-admin/firestore").Transaction) => Promise<T>
) {
  const { adminDb } = await import("@/lib/firebase-admin");
  return adminDb.runTransaction(run);
}
export async function retireEsocialCertificate(user: AuthContext) {
  const current = await currentEsocialUser(user);
  requireEsocialAdministrator(current);
  await adminTransaction(async (tx) => {
    const pointer = (await tx.get(activeRef())).data();
    const at = new Date().toISOString();
    if (typeof pointer?.activeId === "string")
      tx.update(certificates().doc(pointer.activeId), {
        active: false,
        retiredAt: at,
        retiredBy: user.uid,
      });
    tx.set(activeRef(), { activeId: null, updatedAt: at, updatedBy: user.uid });
    tx.create(esocialPrivateRoot().collection("audit").doc(randomUUID()), {
      action: "certificate_retired",
      certificateId: pointer?.activeId ?? null,
      actor: user.uid,
      at,
    });
  });
  return esocialCertificateStatus();
}
export async function loadEsocialCertificate(
  id?: string,
  allowRetired = false
): Promise<{ id: string; material: CertificateMaterial }> {
  if (!id) id = (await activeRef().get()).data()?.activeId;
  if (!id) throw new AuthError("Envie o certificado A1 antes de transmitir.", 409);
  const record = (await certificates().doc(esocialDocumentId(id)).get()).data() as
    StoredCertificate | undefined;
  if (!record || (!allowRetired && !record.active))
    throw new AuthError("Certificado indisponível para novos envios.", 409);
  const name = secretName();
  if (!name || !isPinnedSecretVersion(record.secretVersion, name))
    throw new AuthError("Referência do certificado fora do cofre autorizado.", 503);
  try {
    const api = await manager();
    const response = await api.projects.secrets.versions.access(
      { name: record.secretVersion },
      { timeout: 15000, retry: false }
    );
    const encoded = response.data.payload?.data;
    if (typeof encoded !== "string" || encoded.length > MAX_PFX_BYTES * 3)
      throw new Error("Invalid secret payload");
    const secret = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (
      secret.format !== 1 ||
      typeof secret.pfx !== "string" ||
      typeof secret.password !== "string"
    )
      throw new Error("Invalid secret");
    const material = await inspectPkcs12(Buffer.from(secret.pfx, "base64"), secret.password);
    if (
      material.metadata.fingerprint256 !== record.fingerprint ||
      material.metadata.holder.number !== record.registration
    )
      throw new Error("Certificate integrity");
    return { id, material };
  } catch {
    throw new AuthError(
      "Não foi possível abrir um A1 válido no cofre. Confira validade e permissões.",
      503
    );
  }
}
export async function markEsocialCertificateRestrictedVerified(id: string) {
  await certificates().doc(esocialDocumentId(id)).update({ verifiedInRestricted: true });
}
export const esocialCertificateFingerprint = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
