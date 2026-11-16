/**
 * Inspect: npx tsx scripts/security/migrate-employee-attachments.ts --project <id> --bucket <bucket>
 * Apply the same inventory after the authenticated viewer is deployed by adding --apply.
 * Uses ADC. Reports counts only; document names, object paths and tokens stay private.
 */
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { applicationDefault, initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { employeeAttachmentPath } from "../../src/lib/employee-attachment-path";

export function attachmentReplacements(
  documents: unknown[],
  target: { companyId?: string; employeeId: string; internal?: boolean },
  bucket: string
) {
  const tokensByPath = new Map<string, Set<string>>();
  let skipped = 0;
  const updated = documents.map((item) => {
    if (!item || typeof item !== "object" || !("url" in item) || typeof item.url !== "string")
      return item;
    const path = employeeAttachmentPath({ url: item.url }, target, bucket);
    if (!path || ("storagePath" in item && item.storagePath !== path)) {
      skipped++;
      return item;
    }
    const tokens = tokensByPath.get(path) ?? new Set<string>();
    for (const token of new URL(item.url).searchParams.getAll("token"))
      if (token) tokens.add(token);
    tokensByPath.set(path, tokens);
    const fields: Record<string, unknown> = { ...item };
    delete fields.url;
    return { ...fields, storagePath: path };
  });
  return { tokensByPath, updated, skipped };
}

async function main() {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      bucket: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.project || !values.bucket) throw new Error("Informe o projeto e o bucket.");
  const app = initializeApp({
    projectId: values.project,
    storageBucket: values.bucket,
    credential: applicationDefault(),
  });
  const db = getFirestore(app),
    bucket = getStorage(app).bucket();
  const report = {
    apply: values.apply,
    profiles: 0,
    matchingProfiles: 0,
    migratedProfiles: 0,
    objectsChecked: 0,
    revoked: 0,
    pendingRevocations: 0,
    skippedLinks: 0,
    failedProfiles: 0,
  };
  async function inspect(doc: QueryDocumentSnapshot) {
    const segments = doc.ref.path.split("/");
    const internal = segments.length === 2 && segments[0] === "nxc_employees";
    if (
      !internal &&
      !(segments.length === 4 && segments[0] === "companies" && segments[2] === "employees")
    )
      return;
    const documents = doc.get("documents");
    if (!Array.isArray(documents)) return;
    report.profiles++;
    const changes = attachmentReplacements(
      documents,
      { internal, companyId: internal ? undefined : segments[1], employeeId: doc.id },
      bucket.name
    );
    report.skippedLinks += changes.skipped;
    if (!changes.tokensByPath.size) return;
    report.matchingProfiles++;
    for (const [path, tokens] of changes.tokensByPath) {
      const file = bucket.file(path);
      const [metadata] = await file.getMetadata();
      report.objectsChecked++;
      // Firebase can issue a replacement token. Only handles embedded in legacy
      // references need revocation. A link without a token is reconciled
      // conservatively against every token initially present on the object.
      const active = String(metadata.metadata?.firebaseStorageDownloadTokens || "")
        .split(",")
        .filter(Boolean);
      const legacy = tokens.size ? tokens : new Set(active);
      if (!values.apply || !active.some((token) => legacy.has(token))) continue;
      if (!metadata.generation || !metadata.metageneration) throw new Error("Objeto sem geração.");
      await file.setMetadata(
        { metadata: { firebaseStorageDownloadTokens: null } },
        {
          ifGenerationMatch: metadata.generation,
          ifMetagenerationMatch: metadata.metageneration,
        }
      );
      const [verified] = await file.getMetadata();
      const remaining = String(verified.metadata?.firebaseStorageDownloadTokens || "").split(",");
      if (
        verified.generation !== metadata.generation ||
        remaining.some((token) => legacy.has(token))
      ) {
        report.pendingRevocations++;
        throw new Error("Revogue o link antigo no Firebase e repita a conferência.");
      }
      report.revoked++;
    }
    // Old metadata is preserved on a concurrent change. A retry also completes
    // a profile whose tokens were revoked just before a previous interruption.
    if (values.apply) {
      await doc.ref.update({ documents: changes.updated }, { lastUpdateTime: doc.updateTime });
      report.migratedProfiles++;
    }
  }
  try {
    for (const source of [db.collection("nxc_employees"), db.collectionGroup("employees")]) {
      for await (const snapshot of source.select("documents").stream() as AsyncIterable<unknown>) {
        try {
          if (
            !snapshot ||
            typeof snapshot !== "object" ||
            !("ref" in snapshot) ||
            !("get" in snapshot)
          )
            throw new Error("Registro de inventário inválido.");
          await inspect(snapshot as QueryDocumentSnapshot);
        } catch {
          report.failedProfiles++;
        }
      }
    }
    process.stdout.write(JSON.stringify(report) + "\n");
    if (report.pendingRevocations)
      console.error(
        "Há links antigos ainda ativos ou objetos alterados. Confira a geração e revogue os links pendentes em Storage > Files no Firebase antes de repetir."
      );
    if (report.failedProfiles) process.exitCode = 1;
  } finally {
    await deleteApp(app);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Conferência incompleta. Verifique projeto, bucket e credenciais.");
    process.exitCode = 1;
  });
}
