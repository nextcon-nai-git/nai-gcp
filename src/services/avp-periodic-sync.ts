import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { readAvpPeriodicControl, getAvpReaderEmail } from "./avp-periodic-control";
import { PeriodicSourcesSchema, type PeriodicSources } from "@/lib/avp-periodic-live";
import { AVP_PERIODIC_INTERVAL_MS } from "@/lib/avp-periodic-status";
import type { AvpPeriodicControl } from "@/lib/avp-periodic-control";

// Existing server-only namespace: no direct Firestore access, including administrators.
const ref = () => adminDb.collection("clinic_portal_private").doc("avp_periodic_control");
const arrays = ["people", "clinics", "cities", "unmatchedPrices", "mapClinics"] as const;
const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const hour = (now: number) => Math.floor(now / AVP_PERIODIC_INTERVAL_MS);
const safeError =
  "Não foi possível ler as duas fontes AVP. Confira o acesso de leitura do NAI e os cabeçalhos. A última versão válida foi preservada.";

async function writeVersion(data: AvpPeriodicControl) {
  const versionId = hash({ ...data, checkedAt: "" });
  const version = ref().collection("versions").doc(versionId);
  const parts: Record<string, number> = {};
  const sizes: Record<string, number> = {};
  // Publish the pointer only after all chunks and the manifest have been written.
  for (const key of arrays) {
    const rows = data[key] || [];
    parts[key] = Math.ceil(rows.length / 100);
    sizes[key] = rows.length;
    for (let start = 0; start < rows.length; start += 100) {
      const items = JSON.parse(JSON.stringify(rows.slice(start, start + 100)));
      if (Buffer.byteLength(JSON.stringify(items)) > 700000)
        throw new Error("Parte excede o limite.");
      await version
        .collection("parts")
        .doc(`${key}-${start / 100}`)
        .set({ items });
    }
  }
  await version.set({ summary: data.summary, sources: data.sources || null, parts, sizes });
  return versionId;
}

async function readVersion(versionId: string, checkedAt: string) {
  const version = ref().collection("versions").doc(versionId);
  const manifest = (await version.get()).data();
  if (!manifest) throw new Error("Versão incompleta.");
  const data = {
    checkedAt,
    summary: manifest.summary,
    sources: manifest.sources,
  } as AvpPeriodicControl;
  for (const key of arrays) {
    const count = Number(manifest.parts?.[key]);
    if (!Number.isInteger(count) || count < 0 || count > 500)
      throw new Error("Manifesto inválido.");
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => version.collection("parts").doc(`${key}-${i}`).get())
    );
    if (chunks.some((c) => !c.exists || !Array.isArray(c.data()?.items)))
      throw new Error("Versão incompleta.");
    const items = chunks.flatMap((c) => c.data()!.items);
    if (items.length !== manifest.sizes[key]) throw new Error("Contagem da versão diverge.");
    Object.assign(data, { [key]: items });
  }
  return data;
}

export async function getAvpPeriodicSettings() {
  const [snapshot, readerEmail] = await Promise.all([
    ref().get(),
    getAvpReaderEmail().catch(() => null),
  ]);
  const meta = snapshot.data() || {};
  return {
    readerEmail,
    configured: !!meta.sources,
    revision: String(meta.configRevision || ""),
    campaignUrl: meta.sources
      ? `https://docs.google.com/spreadsheets/d/${meta.sources.campaignSpreadsheetId}/edit`
      : "",
    accreditationUrl: meta.sources
      ? `https://docs.google.com/spreadsheets/d/${meta.sources.accreditationSpreadsheetId}/edit`
      : "",
    checkedAt: meta.checkedAt || null,
    lastScheduledAt: meta.lastScheduledAt || null,
    schedulerSeenAt: meta.schedulerSeenAt || null,
  };
}

export async function configureAvpPeriodicSources(
  sources: PeriodicSources,
  expectedRevision: string,
  actor: string
) {
  const parsed = PeriodicSourcesSchema.parse(sources);
  const data = await readAvpPeriodicControl(parsed);
  const version = await writeVersion(data);
  const now = Date.now();
  const revision = hash(parsed);
  await adminDb.runTransaction(async (tx) => {
    const current = (await tx.get(ref())).data() || {};
    if (
      String(current.configRevision || "") !== expectedRevision ||
      Number(current.leaseUntil) > now
    )
      throw new Error("CONFLICT");
    tx.set(
      ref(),
      {
        sources: parsed,
        configRevision: revision,
        sourceVersion: version,
        checkedAt: data.checkedAt,
        status: "CONNECTED",
        lastError: null,
        lastSuccessHour: hour(now),
        lastAttemptMs: now,
        lease: null,
        leaseUntil: 0,
        configuredBy: actor,
        configuredAt: new Date(now).toISOString(),
      },
      { merge: true }
    );
  });
  return {
    revision,
    sourceRows: data.summary.sourceRows,
    uniquePeople: data.summary.uniquePeople,
    clinics: data.mapClinics?.length || 0,
  };
}

export async function syncAvpPeriodicControl({ force = false, scheduled = false } = {}) {
  const now = Date.now();
  const lease = randomUUID();
  const acquired = await adminDb.runTransaction(async (tx) => {
    const meta = (await tx.get(ref())).data() || {};
    if (!meta.sources) return null;
    if (scheduled) tx.set(ref(), { schedulerSeenAt: new Date(now).toISOString() }, { merge: true });
    if (
      Number(meta.leaseUntil) > now ||
      now - Number(meta.lastAttemptMs || 0) < 30000 ||
      (!force && meta.lastSuccessHour === hour(now))
    )
      return null;
    const sources = PeriodicSourcesSchema.parse(meta.sources);
    tx.set(ref(), { lease, leaseUntil: now + 180000, lastAttemptMs: now }, { merge: true });
    return { sources, revision: String(meta.configRevision) };
  });
  if (!acquired) return { started: false };
  try {
    const data = await readAvpPeriodicControl(acquired.sources);
    const version = await writeVersion(data);
    await adminDb.runTransaction(async (tx) => {
      const current = (await tx.get(ref())).data() || {};
      if (current.lease !== lease || current.configRevision !== acquired.revision)
        throw new Error("CONFLICT");
      tx.set(
        ref(),
        {
          sourceVersion: version,
          checkedAt: data.checkedAt,
          status: "CONNECTED",
          lastError: null,
          lastSuccessHour: hour(now),
          lease: null,
          leaseUntil: 0,
          ...(scheduled ? { lastScheduledAt: new Date().toISOString() } : {}),
        },
        { merge: true }
      );
    });
    return { started: true, sourceRows: data.summary.sourceRows };
  } catch {
    await adminDb.runTransaction(async (tx) => {
      const current = (await tx.get(ref())).data() || {};
      if (current.lease === lease)
        tx.set(
          ref(),
          { status: "ERROR", lastError: safeError, lease: null, leaseUntil: 0 },
          { merge: true }
        );
    });
    return { started: true, error: safeError };
  }
}

export async function readAvpPeriodicSnapshot(force = false): Promise<AvpPeriodicControl> {
  let meta = (await ref().get()).data() || {};
  if (!meta.sources) return readAvpPeriodicControl();
  await syncAvpPeriodicControl({ force });
  meta = (await ref().get()).data() || {};
  if (!meta.sourceVersion || !meta.checkedAt) throw new Error(safeError);
  const data = await readVersion(meta.sourceVersion, meta.checkedAt);
  return {
    ...data,
    sync: {
      status: meta.status,
      error: meta.lastError || null,
      lastScheduledAt: meta.lastScheduledAt || null,
      nextCheckAt: new Date(
        (Number(meta.lastSuccessHour) + 1) * AVP_PERIODIC_INTERVAL_MS
      ).toISOString(),
      intervalSeconds: AVP_PERIODIC_INTERVAL_MS / 1000,
    },
  };
}

export async function readAvpPeriodicMapSource() {
  if (!(await ref().get()).data()?.sources) return null;
  const data = await readAvpPeriodicSnapshot();
  return { clinics: data.mapClinics || [], checkedAt: data.checkedAt, sync: data.sync };
}
