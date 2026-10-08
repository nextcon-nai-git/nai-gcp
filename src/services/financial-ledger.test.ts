import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const storage = vi.hoisted(() => ({ files: new Map<string, Buffer>(), calls: 0 }));
vi.mock("@/lib/firebase-admin", () => ({}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => {
      storage.calls++;
      const file = (name: string) => ({
        name,
        save: async (value: Buffer | string) => {
          if (storage.files.has(name)) throw { code: 412 };
          storage.files.set(name, Buffer.from(value));
        },
        download: async () => {
          if (!storage.files.has(name)) throw { code: 404 };
          return [storage.files.get(name)!];
        },
      });
      return { file, getFiles: async () => [[...storage.files.keys()].map(file)] };
    },
  }),
}));
import { listLedgers, readLedger, readLedgerPdf, saveLedger } from "./financial-ledger";
import type { AuthContext } from "@/lib/auth/auth-context";
const admin: AuthContext = {
  uid: "test-admin",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const pdf = Buffer.from("%PDF-1.5 test fixture");
const data = {
  schemaVersion: 1,
  company: "Empresa Teste",
  cnpj: "00.000.000/0001-00",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  bookNumber: "1",
  sourceName: "test.pdf",
  sourceSha256: createHash("sha256").update(pdf).digest("hex"),
  pageCount: 1,
  rows: [
    {
      id: "r1",
      date: "2025-01-01",
      account: "1.1.1",
      accountName: "Caixa",
      costCenter: "",
      history: "Teste",
      entry: "1",
      amountCents: 100,
      side: "D",
      page: 1,
      endPage: 1,
    },
    {
      id: "r2",
      date: "2025-01-01",
      account: "2.1.1",
      accountName: "Capital",
      costCenter: "",
      history: "Teste",
      entry: "1",
      amountCents: 100,
      side: "C",
      page: 1,
      endPage: 1,
    },
  ],
};
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
});
describe("private ledger persistence", () => {
  it("denies unauthorized users before any storage access", async () => {
    await expect(listLedgers({ ...admin, role: "OPERATIONS" })).rejects.toThrow();
    await expect(saveLedger({ ...admin, role: "CLIENT_ADMIN" }, data, pdf)).rejects.toThrow();
    expect(storage.calls).toBe(0);
  });
  it("checks the PDF fingerprint before writing and rejects invalid paths", async () => {
    await expect(saveLedger(admin, data, Buffer.from("%PDF-other"))).rejects.toThrow("PDF");
    expect(storage.files.size).toBe(0);
    await expect(readLedger(admin, "../../source")).rejects.toThrow("inválido");
  });
  it("persists both files, recalculates totals, and reuses an identical upload", async () => {
    const first = await saveLedger(admin, data, pdf);
    const again = await saveLedger(admin, data, pdf);
    expect(first.alreadySaved).toBe(false);
    expect(again.alreadySaved).toBe(true);
    expect(storage.files.size).toBe(2);
    expect(first.book.id).toBe(again.book.id);
    expect(await readLedgerPdf(admin, first.book.id)).toEqual(pdf);
    expect(await listLedgers(admin)).toMatchObject([
      { debit: 100, credit: 100, rowCount: 2, entryCount: 1, unbalanced: 0 },
    ]);
  });
  it("does not overwrite an existing extraction for the same PDF", async () => {
    const first = await saveLedger(admin, data, pdf);
    await expect(
      saveLedger(admin, { ...data, rows: data.rows.map((r) => ({ ...r, amountCents: 200 })) }, pdf)
    ).rejects.toThrow("preservada");
    expect((await readLedger(admin, first.book.id)).rows[0].amountCents).toBe(100);
  });
});
