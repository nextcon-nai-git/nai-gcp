import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import { randomUUID } from "node:crypto";

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
          if (
            Number(expected) === 0
              ? Boolean(record)
              : !record || String(expected) !== record.generation
          )
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

import { getFinanceBook, saveFinanceCommand } from "./financial-operations";
const admin: AuthContext = {
  uid: "admin",
  email: "test@example.com",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const cmd = () => ({
  action: "account",
  name: "Banco sintético",
  requestId: randomUUID(),
  expectedVersion: 0,
});
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
  storage.sequence = 0;
  storage.writes = [];
  storage.beforeWrite = null;
  storage.failRead = false;
});
describe("financial control persistence", () => {
  it.each(["CLIENT_ADMIN", "OPERATIONS", "DOCTOR", "PROVIDER", "GUEST"] as const)(
    "denies %s before storage",
    async (role) => {
      await expect(getFinanceBook({ ...admin, role })).rejects.toMatchObject({ status: 403 });
      await expect(saveFinanceCommand({ ...admin, role }, cmd())).rejects.toMatchObject({
        status: 403,
      });
      expect(storage.calls).toBe(0);
    }
  );
  it("denies tenant admin and permits internal admin", async () => {
    await expect(
      getFinanceBook({ ...admin, role: "ADMIN", tenantId: "client" })
    ).rejects.toMatchObject({ status: 403 });
    expect(storage.calls).toBe(0);
    expect((await getFinanceBook({ ...admin, role: "ADMIN" })).version).toBe(0);
  });
  it("persists private atomic data and replays a committed command once", async () => {
    const c = cmd();
    const a = await saveFinanceCommand(admin, c);
    const b = await saveFinanceCommand(admin, c);
    expect(a).toEqual(b);
    expect(b.accounts).toHaveLength(1);
    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0].options.metadata).toEqual({ cacheControl: "private, no-store" });
  });
  it("does not overwrite a concurrent writer", async () => {
    storage.beforeWrite = () => {
      storage.files.set("financial-operations/v1/nextcon.json", {
        bytes: Buffer.from("new data"),
        generation: "42",
      });
    };
    await expect(saveFinanceCommand(admin, cmd())).rejects.toMatchObject({ status: 409 });
    expect(storage.files.get("financial-operations/v1/nextcon.json")?.bytes.toString()).toBe(
      "new data"
    );
  });
  it("does not replace unreadable data with an empty book", async () => {
    await saveFinanceCommand(admin, cmd());
    storage.failRead = true;
    await expect(getFinanceBook(admin)).rejects.toThrow("outage");
    expect(storage.writes).toHaveLength(1);
  });
});
