import { describe, it, expect } from "vitest";
import { summarizePeriodics, periodicsCsv, ClientRequestSchema } from "./client-center";
const now = new Date("2026-10-10T02:00:00Z"); // October 9 in São Paulo
const record = (id: string, nextAsoDate: unknown, status = "active") => ({
  id,
  data: { name: id, nextAsoDate, status, cpf: "secret", fitnessStatus: "private" },
});
describe("Client center deadlines", () => {
  it("uses São Paulo dates and includes the 30 day boundary", () => {
    const result = summarizePeriodics(
      [
        record("past", "2026-10-08"),
        record("today", "2026-10-09"),
        record("boundary", "2026-11-08"),
        record("future", "2026-11-09"),
        record("unknown", "2026-02-30"),
        record("fired", "2026-01-01", "fired"),
      ],
      now
    );
    expect(result).toMatchObject({ total: 5, overdue: 1, soon: 2, current: 1, missing: 1 });
    expect(JSON.stringify(result)).not.toMatch(/secret|private|cpf|fitnessStatus/);
  });
  it("does not invent a next date from last ASO", () => {
    expect(
      summarizePeriodics([{ id: "a", data: { lastAsoDate: "2026-01-01" } }], now).missing
    ).toBe(1);
  });
  it("exports filtered rows and neutralizes spreadsheet formulas", () => {
    const csv = periodicsCsv([
      {
        id: "a",
        name: '=HYPERLINK("evil")',
        department: "HR",
        dueDate: null,
        situation: "missing",
      },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv).not.toContain("cpf");
  });
  it("rejects status or author supplied by callers", () => {
    expect(
      ClientRequestSchema.safeParse({
        companyId: "a",
        requestId: crypto.randomUUID(),
        department: "support",
        title: "Ajuda no acesso",
        description: "Preciso de ajuda no acesso.",
        priority: "medium",
        status: "done",
      }).success
    ).toBe(false);
  });
});
