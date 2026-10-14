import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import { actionImportFixture } from "../../tests/fixtures/financial-actions";

const storage = vi.hoisted(() => ({
  files: new Map<string, { bytes: Buffer; generation: string }>(),
  calls: 0,
  sequence: 0,
  writes: [] as {
    name: string;
    options: { preconditionOpts?: { ifGenerationMatch?: number | string }; metadata?: unknown };
  }[],
  beforeWrite: null as (() => void) | null,
  failRead: false,
}));
vi.mock("@/lib/firebase-admin", () => ({}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => {
      storage.calls++;
      const file = (name: string, pin?: { generation?: number | string }) => ({
        name,
        getMetadata: async () => {
          const record = storage.files.get(name);
          if (!record) throw { code: 404 };
          return [{ generation: record.generation }];
        },
        download: async () => {
          if (storage.failRead) {
            storage.failRead = false;
            throw new Error("temporary storage outage");
          }
          const record = storage.files.get(name);
          if (!record || (pin?.generation && String(pin.generation) !== record.generation))
            throw { code: 404 };
          return [record.bytes];
        },
        save: async (
          data: string,
          options: {
            preconditionOpts?: { ifGenerationMatch?: number | string };
            metadata?: unknown;
          }
        ) => {
          storage.beforeWrite?.();
          storage.beforeWrite = null;
          const record = storage.files.get(name);
          const expected = options.preconditionOpts?.ifGenerationMatch;
          storage.writes.push({ name, options });
          if (expected === 0 ? Boolean(record) : !record || String(expected) !== record.generation)
            throw { code: 412 };
          storage.files.set(name, {
            bytes: Buffer.from(data),
            generation: String(++storage.sequence),
          });
        },
      });
      return {
        file,
        getFiles: async () => [[...storage.files.keys()].map((name) => file(name)), {}],
      };
    },
  }),
}));
import {
  importFinancialActions,
  listFinancialActions,
  updateFinancialAction,
} from "./financial-actions";

const admin: AuthContext = {
  uid: "test-admin",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
  storage.sequence = 0;
  storage.writes = [];
  storage.beforeWrite = null;
  storage.failRead = false;
});

describe("private financial action persistence", () => {
  it.each(["OPERATIONS", "CLIENT_ADMIN", "PROVIDER", "ENGINEER", "DOCTOR", "GUEST"] as const)(
    "denies %s before accessing storage or processing payloads",
    async (role) => {
      const user = { ...admin, role };
      await expect(listFinancialActions(user)).rejects.toMatchObject({ status: 403 });
      await expect(importFinancialActions(user, "invalid")).rejects.toMatchObject({ status: 403 });
      await expect(updateFinancialAction(user, "invalid")).rejects.toMatchObject({ status: 403 });
      expect(storage.calls).toBe(0);
    }
  );
  it("rejects tenant admins and accepts an admin without a tenant", async () => {
    await expect(
      importFinancialActions({ ...admin, role: "ADMIN", tenantId: "client-a" }, actionImportFixture)
    ).rejects.toMatchObject({ status: 403 });
    expect(storage.calls).toBe(0);
    expect(
      (await importFinancialActions({ ...admin, role: "ADMIN" }, actionImportFixture)).alreadySaved
    ).toBe(false);
  });
  it("creates an atomic private batch and confirms identical retries without duplication", async () => {
    const first = await importFinancialActions(admin, actionImportFixture);
    const second = await importFinancialActions(admin, actionImportFixture);
    expect(first.alreadySaved).toBe(false);
    expect(second.alreadySaved).toBe(true);
    expect(first.batch.id).toMatch(/^[a-f0-9]{64}$/);
    expect(second.batch).toEqual(first.batch);
    expect(storage.files.size).toBe(1);
    expect(storage.writes[0]).toMatchObject({
      name: `financial-actions/v1/${first.batch.id}.json`,
      options: {
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { cacheControl: "private, no-store" },
      },
    });
    expect((await listFinancialActions(admin)).batches).toEqual([first.batch]);
  });
  it("preserves an existing import when the same key is reused for different content", async () => {
    const first = await importFinancialActions(admin, actionImportFixture);
    await expect(
      importFinancialActions(admin, { ...actionImportFixture, title: "Another analysis" })
    ).rejects.toMatchObject({ status: 409 });
    expect((await listFinancialActions(admin)).batches[0]).toEqual(first.batch);
  });
  it("preserves checklist updates on reimport and requires the latest action version", async () => {
    const first = await importFinancialActions(admin, actionImportFixture);
    const action = first.batch.actions[0];
    const patch = {
      batchId: first.batch.id,
      actionId: action.id,
      expectedVersion: action.version,
      status: "in_progress",
      checklist: [{ id: "documento", checked: true }],
    };
    const saved = await updateFinancialAction(admin, patch);
    expect(saved.action.version).toBe(2);
    expect(saved.action.checklist[0].checked).toBe(true);
    expect(saved.action.evidence).toEqual(action.evidence);
    expect(saved.batch.version).toBe(2);
    const retried = await importFinancialActions(admin, actionImportFixture);
    expect(retried.batch.actions[0]).toEqual(saved.action);
    await expect(updateFinancialAction(admin, patch)).rejects.toMatchObject({ status: 409 });
    expect((await listFinancialActions(admin)).batches[0].actions[0]).toEqual(saved.action);
  });
  it("enforces required checks and prevents checklist text/removal or injected fields", async () => {
    const { batch } = await importFinancialActions(admin, actionImportFixture);
    const identity = { batchId: batch.id, actionId: batch.actions[0].id, expectedVersion: 1 };
    await expect(
      updateFinancialAction(admin, { ...identity, status: "done" })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateFinancialAction(admin, { ...identity, checklist: [{ id: "unknown", checked: true }] })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateFinancialAction(admin, {
        ...identity,
        checklist: [{ id: "documento", checked: true, required: false }],
      })
    ).rejects.toMatchObject({ status: 400 });
    const saved = await updateFinancialAction(admin, {
      ...identity,
      status: "done",
      checklist: [
        { id: "documento", checked: true },
        { id: "comprovante", checked: true },
      ],
    });
    expect(saved.action.checklist).toHaveLength(3);
    expect(saved.action.checklist[2].checked).toBe(false);
    await expect(
      updateFinancialAction(admin, {
        ...identity,
        expectedVersion: 2,
        checklist: [{ id: "documento", checked: false }],
      })
    ).rejects.toMatchObject({ status: 400 });
    const reopened = await updateFinancialAction(admin, {
      ...identity,
      expectedVersion: 2,
      status: "in_progress",
      checklist: [{ id: "documento", checked: false }],
    });
    expect(reopened.action.status).toBe("in_progress");
    expect(reopened.action.checklist[0].text).toBe(batch.actions[0].checklist[0].text);
  });
  it("uses a generation precondition to reject a concurrent write even after a valid read", async () => {
    const { batch } = await importFinancialActions(admin, actionImportFixture);
    const name = `financial-actions/v1/${batch.id}.json`;
    const before = storage.files.get(name)!;
    storage.beforeWrite = () =>
      storage.files.set(name, { ...before, generation: String(++storage.sequence) });
    await expect(
      updateFinancialAction(admin, {
        batchId: batch.id,
        actionId: batch.actions[0].id,
        expectedVersion: 1,
        status: "in_progress",
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.files.get(name)?.bytes).toEqual(before.bytes);
    expect(storage.writes[1].options.preconditionOpts?.ifGenerationMatch).toBe(before.generation);
  });
  it("does not report success without a confirming read; retry recovers a committed import", async () => {
    storage.failRead = true;
    await expect(importFinancialActions(admin, actionImportFixture)).rejects.toThrow("outage");
    expect(storage.files.size).toBe(1);
    const saved = await importFinancialActions(admin, actionImportFixture);
    expect(saved.alreadySaved).toBe(true);
    expect(saved.batch.actions).toHaveLength(1);
  });
  it("rejects invalid imports and paths before storing any data", async () => {
    await expect(
      importFinancialActions(admin, { ...actionImportFixture, actions: [] })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateFinancialAction(admin, {
        batchId: "../other",
        actionId: "a".repeat(64),
        expectedVersion: 1,
        status: "done",
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(storage.calls).toBe(0);
  });
});
