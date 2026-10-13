import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDocs, writeBatch, updateDoc, type Firestore } from "firebase/firestore";
import {
  clinicalQueuePage,
  clinicalQueueQuery,
  clinicalQueueToday,
} from "../../src/services/clinical-queue";

let env: RulesTestEnvironment;
const day = "2026-10-13";
const count = 65;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "users/queue-admin-a"), {
      role: "ADMIN",
      companyId: "queue-tenant-a",
      tenantId: "queue-tenant-a",
    });
    for (const companyId of ["queue-tenant-a", "queue-tenant-b"]) {
      const put = (id: string, data: Record<string, unknown>) =>
        batch.set(doc(db, `companies/${companyId}/agendamentos/${id}`), {
          companyId,
          colaborador_nome: "Pessoa sintética",
          ...data,
        });
      // More historical rows than the old unfiltered query could display.
      for (let i = 0; i < 100; i++)
        put(`history-${i}`, { status: "Concluído", data_hora: "2025-01-01T08:00:00" });
      for (let i = 0; i < count; i++) {
        put(`scheduled-${String(i).padStart(3, "0")}`, {
          status: "Agendado",
          data_hora: `${day}T${i === 0 ? "00:00:00" : i === count - 1 ? "23:59:59.999" : "08:00:00"}`,
        });
        put(`active-${String(i).padStart(3, "0")}`, {
          status: i % 2 === 0 ? "Em Atendimento" : "Em Espera",
          ...(i ? { data_hora: "2025-02-01T08:00:00" } : {}),
        });
      }
      put("tomorrow", { status: "Agendado", data_hora: "2026-10-14T00:00:00" });
    }
    await batch.commit();
  });
});
afterAll(async () => {
  await env?.cleanup();
});
// rules-unit-testing exposes the compat handle; the modular APIs unwrap it at runtime.
const db = () => env.authenticatedContext("queue-admin-a").firestore() as unknown as Firestore;
const read = async (mode: "scheduled" | "active", size = 50, selectedDay = day) => {
  const result = await getDocs(
    clinicalQueueQuery(db(), "queue-tenant-a", mode, selectedDay, size)!
  );
  return result.docs.map((record) => ({ ...record.data(), id: record.id }));
};

describe("fila clínica real no emulador: recorte, expansão e tenant", () => {
  it("não deixa os 100 históricos ocultarem os agendamentos atuais e expande além de 50", async () => {
    const first = clinicalQueuePage(await read("scheduled"), 50);
    expect(first.items).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect(first.items.every((record) => record.id.startsWith("scheduled-"))).toBe(true);
    const expanded = clinicalQueuePage(await read("scheduled", 100), 100);
    expect(expanded.items).toHaveLength(count);
    expect(expanded.hasMore).toBe(false);
    expect(new Set(expanded.items.map((record) => record.id)).size).toBe(count);
    for (const record of first.items) expect(expanded.items).toContainEqual(record);
  });
  it("inclui as duas extremidades do dia e exclui a meia-noite seguinte", async () => {
    const current = await read("scheduled", 100);
    expect(current.map((record) => record.id)).toContain("scheduled-000");
    expect(current.map((record) => record.id)).toContain("scheduled-064");
    expect(current.map((record) => record.id)).not.toContain("tomorrow");
    expect((await read("scheduled", 100, "2026-10-14")).map((record) => record.id)).toEqual([
      "tomorrow",
    ]);
  });
  it("preserva ativos antigos e sem horário, com expansão e sem influência da data escolhida", async () => {
    const first = clinicalQueuePage(await read("active"), 50);
    expect(first.items).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    const all = clinicalQueuePage(await read("active", 100), 100);
    expect(all.items).toHaveLength(count);
    expect(all.hasMore).toBe(false);
    expect(all.items.map((record) => record.id)).toContain("active-000");
    expect(await read("active", 100, "2099-01-01")).toEqual(all.items);
  });
  it.each(["scheduled", "active"] as const)("nega consulta %s em outra empresa", async (mode) => {
    await assertFails(getDocs(clinicalQueueQuery(db(), "queue-tenant-b", mode, day)!));
  });
  it("um check-in sai da agenda e aparece na fila aberta sem duplicar ou perder o registro", async () => {
    const ref = doc(db(), "companies/queue-tenant-a/agendamentos/scheduled-000");
    await updateDoc(ref, { status: "Em Espera" });
    try {
      expect((await read("scheduled", 100)).map((record) => record.id)).not.toContain(
        "scheduled-000"
      );
      expect((await read("active", 100)).map((record) => record.id)).toContain("scheduled-000");
    } finally {
      await updateDoc(ref, { status: "Agendado" });
    }
  });
  it("não cria consulta para tenant global/ausente nem datas impossíveis", () => {
    for (const company of ["all", "unauthorized", "", "a/b"])
      expect(clinicalQueueQuery(db(), company, "scheduled", day)).toBeNull();
    for (const invalidDay of ["", "2026-02-30", "not-a-date"])
      expect(clinicalQueueQuery(db(), "queue-tenant-a", "scheduled", invalidDay)).toBeNull();
  });
  it("o dia inicial respeita São Paulo, inclusive depois da meia-noite UTC", () => {
    expect(clinicalQueueToday(new Date("2026-10-14T01:00:00Z"))).toBe("2026-10-13");
  });
  it("versiona o índice composto necessário à agenda por data", () => {
    const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
    expect(config.indexes).toContainEqual({
      collectionGroup: "agendamentos",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "data_hora", order: "ASCENDING" },
      ],
    });
  });
});
