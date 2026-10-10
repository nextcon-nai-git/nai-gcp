import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ files: new Map<string, Buffer>(), calls: 0, failJson: false }));
const extract = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase-admin", () => ({}));
vi.mock("./financial-balance-pdf", () => ({ extractBalancePdf: extract }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => {
      storage.calls++;
      const file = (name: string) => ({
        name,
        save: async (
          value: Buffer | string,
          options: {
            preconditionOpts: { ifGenerationMatch: number };
            metadata: { cacheControl: string };
          }
        ) => {
          expect(options.preconditionOpts.ifGenerationMatch).toBe(0);
          expect(options.metadata.cacheControl).toBe("private, no-store");
          if (storage.files.has(name)) throw { code: 412 };
          if (storage.failJson && name.endsWith(".json")) throw new Error("write failed");
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
import { listBalances, readBalance, readBalancePdf, saveBalance } from "./financial-balance";
import type { AuthContext } from "@/lib/auth/auth-context";
const admin: AuthContext = {
  uid: "admin",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const pdf = Buffer.from("%PDF-1.5 synthetic fixture");
const data = {
  company: "Empresa Teste",
  cnpj: "00.000.000/0001-00",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  rows: [
    { label: "ATIVO", openingCents: 100, closingCents: 200, page: 1 },
    { label: "PASSIVO", openingCents: 100, closingCents: 200, page: 1 },
    { label: "PATRIMÔNIO LÍQUIDO", openingCents: 50, closingCents: 100, page: 1 },
  ],
};
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
  storage.failJson = false;
  extract.mockReset().mockResolvedValue(data);
});
describe("private balance storage", () => {
  it("denies unauthorized listing, imports and original PDF before storage or parsing", async () => {
    for (const user of [
      { ...admin, role: "OPERATIONS" as const },
      { ...admin, role: "ADMIN" as const, tenantId: "client" },
    ]) {
      await expect(listBalances(user)).rejects.toThrow();
      await expect(saveBalance(user, "test.pdf", pdf)).rejects.toThrow();
      await expect(readBalancePdf(user, "a".repeat(64))).rejects.toThrow();
    }
    expect(storage.calls).toBe(0);
    expect(extract).not.toHaveBeenCalled();
  });
  it("validates PDF and IDs and rejects failed extraction without writing", async () => {
    await expect(saveBalance(admin, "bad.pdf", Buffer.from("text"))).rejects.toThrow("PDF");
    await expect(readBalance(admin, "../../file")).rejects.toThrow("inválido");
    extract.mockRejectedValue(new Error("internal detail"));
    await expect(saveBalance(admin, "test.pdf", pdf)).rejects.toThrow("conferir");
    expect(storage.files.size).toBe(0);
  });
  it("preserves original bytes and reuses identical files without overwriting", async () => {
    const saved = await saveBalance(admin, "test.pdf", pdf);
    expect(saved.alreadySaved).toBe(false);
    const again = await saveBalance(admin, "renamed.pdf", pdf);
    expect(again.alreadySaved).toBe(true);
    expect(again.balance.sourceName).toBe("test.pdf");
    expect(storage.files.size).toBe(2);
    expect(await readBalancePdf(admin, saved.balance.id)).toEqual(pdf);
    expect((await listBalances(admin))[0].id).toBe(saved.balance.id);
  });
  it("does not list incomplete imports and can finish them on retry", async () => {
    storage.failJson = true;
    await expect(saveBalance(admin, "test.pdf", pdf)).rejects.toThrow();
    expect(await listBalances(admin)).toEqual([]);
    storage.failJson = false;
    await saveBalance(admin, "test.pdf", pdf);
    expect(await listBalances(admin)).toHaveLength(1);
  });
});
