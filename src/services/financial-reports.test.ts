import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ files: new Map<string, Buffer>(), calls: 0, failJson: false }));
vi.mock("@/lib/firebase-admin", () => ({}));
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
import { listReports, readReport, readReportPdf, saveReport } from "./financial-reports";
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
  title: "Resumo",
  periodStart: "2026-01-01",
  periodEnd: "2026-10-18",
  description: "Teste",
};
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
  storage.failJson = false;
});
describe("private balance storage", () => {
  it("denies unauthorized listing, imports and original PDF before storage or parsing", async () => {
    for (const user of [
      { ...admin, role: "OPERATIONS" as const },
      { ...admin, role: "ADMIN" as const, tenantId: "client" },
    ]) {
      await expect(listReports(user)).rejects.toThrow();
      await expect(saveReport(user, data, "test.pdf", pdf)).rejects.toThrow();
      await expect(readReportPdf(user, "a".repeat(64))).rejects.toThrow();
    }
    expect(storage.calls).toBe(0);
  });
  it("validates PDF and IDs and rejects failed extraction without writing", async () => {
    await expect(saveReport(admin, data, "bad.pdf", Buffer.from("text"))).rejects.toThrow("PDF");
    await expect(readReport(admin, "../../file")).rejects.toThrow("inválido");
    await expect(
      saveReport(admin, { ...data, periodEnd: "2025-01-01" }, "test.pdf", pdf)
    ).rejects.toThrow();
    expect(storage.files.size).toBe(0);
  });
  it("preserves original bytes and reuses identical files without overwriting", async () => {
    const saved = await saveReport(admin, data, "test.pdf", pdf);
    expect(saved.alreadySaved).toBe(false);
    const again = await saveReport(admin, data, "renamed.pdf", pdf);
    expect(again.alreadySaved).toBe(true);
    expect(again.report.sourceName).toBe("test.pdf");
    expect(storage.files.size).toBe(2);
    expect(await readReportPdf(admin, saved.report.id)).toEqual(pdf);
    expect((await listReports(admin))[0].id).toBe(saved.report.id);
  });
  it("does not list incomplete imports and can finish them on retry", async () => {
    storage.failJson = true;
    await expect(saveReport(admin, data, "test.pdf", pdf)).rejects.toThrow();
    expect(await listReports(admin)).toEqual([]);
    storage.failJson = false;
    await saveReport(admin, data, "test.pdf", pdf);
    expect(await listReports(admin)).toHaveLength(1);
  });
});
