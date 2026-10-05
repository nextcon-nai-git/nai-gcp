import "server-only";
import { google } from "googleapis";
import { createHash, randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { parseAvpSourceValues } from "@/lib/avp-source-parser";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { AVP_STATUSES } from "@/lib/grupo-avp-asos-data";

const metaRef = () => adminDb.collection("integrations").doc("grupo-avp");
const editable = new Set([
  "urgencia",
  "status",
  "responsavel",
  "dataAgendada",
  "tipoSolicitacao",
  "nomeClinica",
  "telefoneClinica",
  "emailClinica",
  "valorAso",
  "cnpjClinica",
  "chavePix",
  "pixRealizado",
  "enderecoClinica",
  "oQueFazer",
  "observacoes",
]);
type EditFields = Record<string, string>;
type Override = {
  fields: EditFields;
  baseFields: EditFields;
  updatedBy: string;
  updatedAt: string;
};

export function applyAvpOverrides(rows: GrupoAvpAso[], overrides: Map<string, Override>) {
  const conflicts: Array<{ id: string; field: string }> = [];
  const items = rows.map((row) => {
    const override = overrides.get(row.id);
    if (!override) return row;
    const result = { ...row };
    for (const [field, value] of Object.entries(override.fields)) {
      if (!editable.has(field)) continue;
      const current = String(row[field as keyof GrupoAvpAso] ?? "");
      if (current !== override.baseFields[field] && current !== value) {
        conflicts.push({ id: row.id, field });
        continue;
      }
      (result as unknown as Record<string, unknown>)[field] = value;
    }
    return result;
  });
  return { items, conflicts };
}

/** ADC utiliza a identidade do App Hosting; a planilha continua privada. */
export async function readPrivateAvpSheet() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get(
    { spreadsheetId: AVP_SOURCE.spreadsheetId, fields: "sheets.properties" },
    { timeout: 20000 }
  );
  const sheet = metadata.data.sheets?.find(
    (item) => item.properties?.sheetId === AVP_SOURCE.sheetId
  )?.properties;
  if (!sheet || sheet.title !== AVP_SOURCE.sheetTitle)
    throw new Error("A aba configurada da fila AVP não foi encontrada. Confira a fonte.");
  const grid = sheet.gridProperties;
  if (!grid?.rowCount || grid.rowCount > 10001 || (grid.columnCount || 0) < 22)
    throw new Error(
      "A estrutura da planilha excede o limite ou não contém os 22 campos esperados."
    );
  const title = AVP_SOURCE.sheetTitle.replace(/'/g, "''");
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: AVP_SOURCE.spreadsheetId,
      range: `'${title}'!A1:V${grid.rowCount}`,
      valueRenderOption: "FORMATTED_VALUE",
    },
    { timeout: 20000 }
  );
  return parseAvpSourceValues(result.data.values || []);
}

export async function syncAvpSource(force = false, actor = "scheduler") {
  const ref = metaRef();
  const lease = randomUUID();
  const now = Date.now();
  const acquired = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    if (
      Number(data.leaseUntil) > now ||
      now - Number(data.lastAttemptMs || 0) < (force ? 30000 : AVP_SOURCE.intervalSeconds * 1000)
    )
      return false;
    tx.set(ref, { lease, leaseUntil: now + 120000, lastAttemptMs: now }, { merge: true });
    return true;
  });
  if (!acquired) return { started: false };
  try {
    const { rows, warnings } = await readPrivateAvpSheet();
    const digest = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    const previous = (await ref.get()).data() || {};
    if (previous.sourceVersion !== digest) {
      const version = ref.collection("versions").doc(digest);
      for (let offset = 0; offset < rows.length; offset += 400) {
        const batch = adminDb.batch();
        for (const row of rows.slice(offset, offset + 400))
          batch.set(version.collection("rows").doc(row.id), row);
        await batch.commit();
      }
      await version.set({ createdAt: new Date().toISOString(), rowCount: rows.length });
    }
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.data()?.lease !== lease)
        throw new Error(
          "Outra sincronização assumiu a execução. A versão anterior foi preservada."
        );
      tx.set(
        ref,
        {
          sourceVersion: digest,
          checkedAt: new Date().toISOString(),
          rowCount: rows.length,
          warnings: warnings.slice(0, 200),
          status: "CONNECTED",
          lastError: null,
          lease: null,
          leaseUntil: 0,
        },
        { merge: true }
      );
      tx.set(ref.collection("audit").doc(randomUUID()), {
        action: "SOURCE_SYNC",
        actor,
        sourceVersion: digest,
        rowCount: rows.length,
        createdAt: new Date().toISOString(),
      });
    });
    return { started: true, rowCount: rows.length };
  } catch (error) {
    const code = (error as { code?: number }).code;
    const message =
      code === 403 || code === 404
        ? "A identidade do NAI não tem permissão de leitura na planilha ou a API Google Sheets não está habilitada."
        : "Não foi possível atualizar a fonte Google. A última fila válida foi preservada.";
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.data()?.lease === lease)
        tx.set(
          ref,
          { status: "ERROR", lastError: message, lease: null, leaseUntil: 0 },
          { merge: true }
        );
    });
    return { started: true, error: message };
  }
}

export async function getAvpSnapshot() {
  const ref = metaRef();
  const data = (await ref.get()).data() || {};
  if (!data.sourceVersion)
    return {
      items: [] as GrupoAvpAso[],
      conflicts: [],
      revision: "",
      source: AVP_SOURCE,
      checkedAt: null,
      status: data.status || "CONFIGURATION_REQUIRED",
      error: data.lastError || "A primeira leitura da planilha ainda não foi concluída.",
      warnings: [],
    };
  const [rows, overrideDocs] = await Promise.all([
    ref.collection("versions").doc(data.sourceVersion).collection("rows").get(),
    ref.collection("overrides").get(),
  ]);
  const items = rows.docs
    .map((doc) => doc.data() as GrupoAvpAso)
    .sort((a, b) => (a.sourceRow || 0) - (b.sourceRow || 0));
  const overrides = new Map(overrideDocs.docs.map((doc) => [doc.id, doc.data() as Override]));
  return {
    ...applyAvpOverrides(items, overrides),
    revision: `${data.sourceVersion}:${data.manualRevision || "0"}`,
    source: AVP_SOURCE,
    checkedAt: data.checkedAt,
    status: data.status,
    error: data.lastError,
    warnings: data.warnings || [],
  };
}

export async function patchAvpQueue(
  revision: string,
  changes: Array<{ id: string; fields: EditFields }>,
  actor: string
) {
  if (!revision || !Array.isArray(changes) || changes.length < 1 || changes.length > 100)
    throw new Error("Envie de 1 a 100 alterações com a versão da fila.");
  if (new Set(changes.map((change) => change?.id)).size !== changes.length)
    throw new Error("Cada solicitação deve aparecer uma única vez por atualização.");
  for (const change of changes) {
    if (
      !change ||
      !/^avp_[a-f0-9]{32}$/.test(change.id) ||
      !change.fields ||
      typeof change.fields !== "object" ||
      Array.isArray(change.fields) ||
      !Object.keys(change.fields).length ||
      Object.entries(change.fields).some(
        ([k, v]) => !editable.has(k) || typeof v !== "string" || v.length > 5000
      )
    )
      throw new Error("Alteração de fila inválida.");
    if (
      change.fields.status !== undefined &&
      !AVP_STATUSES.includes(change.fields.status as GrupoAvpAso["status"])
    )
      throw new Error("Status inválido.");
    if (
      change.fields.urgencia !== undefined &&
      !["URGENTE", "NORMAL", "E-MAIL"].includes(change.fields.urgencia)
    )
      throw new Error("Urgência inválida.");
  }
  const ref = metaRef();
  return adminDb.runTransaction(async (tx) => {
    const meta = await tx.get(ref);
    const data = meta.data() || {};
    if (revision !== `${data.sourceVersion}:${data.manualRevision || "0"}`)
      throw new Error("CONFLICT");
    const rowRefs = changes.map((c) =>
      ref.collection("versions").doc(data.sourceVersion).collection("rows").doc(c.id)
    );
    const overrideRefs = changes.map((c) => ref.collection("overrides").doc(c.id));
    const snapshots = await tx.getAll(...rowRefs, ...overrideRefs);
    for (let i = 0; i < changes.length; i++) {
      if (!snapshots[i].exists) throw new Error("Solicitação não encontrada na versão atual.");
      const source = snapshots[i].data() as Record<string, unknown>;
      const previous = snapshots[i + changes.length].data() as Override | undefined;
      const fields = { ...previous?.fields, ...changes[i].fields };
      const baseFields = { ...previous?.baseFields };
      for (const field of Object.keys(changes[i].fields))
        baseFields[field] = String(source[field] ?? "");
      tx.set(overrideRefs[i], {
        fields,
        baseFields,
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      });
    }
    const manualRevision = randomUUID();
    tx.set(ref, { manualRevision }, { merge: true });
    tx.set(ref.collection("audit").doc(randomUUID()), {
      action: "QUEUE_EDIT",
      actor,
      changes: changes.map((c) => ({ id: c.id, fields: Object.keys(c.fields) })),
      createdAt: new Date().toISOString(),
    });
    return `${data.sourceVersion}:${manualRevision}`;
  });
}
