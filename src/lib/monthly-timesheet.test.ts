import { describe, it, expect } from "vitest";
import { hours, monthPeriod, monthlyRows, type TimesheetPunch } from "./monthly-timesheet";
const punch = (type: string, time: string, id = type): TimesheetPunch => ({
  id,
  type,
  time,
  date: "2026-10-01",
  timestamp: `2026-10-01T${time}-03:00`,
  reference: `ref-${id}`,
});
const complete = () => [
  punch("entrada", "08:00:00"),
  punch("almoco_saida", "12:00:00"),
  punch("almoco_retorno", "13:00:00"),
  punch("saida", "17:00:00"),
];
describe("monthly CLT read-only report", () => {
  it("covers leap February and the December boundary, rejecting invalid periods", () => {
    expect(monthPeriod("2024-02")).toMatchObject({
      days: 29,
      end: "2024-02-29",
      next: "2024-03-01",
    });
    expect(monthPeriod("2026-12")?.next).toBe("2027-01-01");
    for (const bad of ["", "2026-13", "2026-00", "2026-1", "1899-01"])
      expect(monthPeriod(bad)).toBeNull();
  });
  it("lists all calendar days, retains original records and computes only complete consistent intervals", () => {
    const data = complete().reverse();
    const snapshot = structuredClone(data);
    const rows = monthlyRows("2026-10", data);
    expect(rows).toHaveLength(31);
    expect(rows[0].seconds).toBe(8 * 3600);
    expect(hours(rows[0].seconds!)).toBe("08:00:00");
    expect(rows[1].seconds).toBeNull();
    expect(rows[1].status).toContain("Sem marcações");
    expect(data).toEqual(snapshot);
    expect(rows[0].entries.map((p) => p.reference)).toEqual(complete().map((p) => p.reference));
  });
  it("does not erase duplicates or calculate incomplete or conflicting punches", () => {
    for (const entries of [
      complete().slice(0, 3),
      [...complete(), punch("entrada", "08:05:00", "duplicate")],
      [...complete().slice(0, 3), punch("saida", "11:00:00")],
      [{ ...complete()[0], time: "09:00:00" }, ...complete().slice(1)],
      [{ ...complete()[0], timestamp: "bad" }, ...complete().slice(1)],
    ]) {
      const row = monthlyRows("2026-10", entries)[0];
      expect(row.seconds).toBeNull();
      expect(row.entries).toHaveLength(entries.length);
      expect(row.status).toContain("conferir");
    }
  });
  it("handles a short shift without inventing an interval and formats subsecond source timestamps", () => {
    const row = monthlyRows("2026-10", [
      punch("entrada", "08:00:00"),
      punch("saida", "12:00:00"),
    ])[0];
    expect(row.seconds).toBe(4 * 3600);
    expect(hours(3600.857)).toBe("01:00:00");
  });
  it("flags night work separately without asserting reduced-hour payroll treatment", () => {
    const data = [
      punch("entrada", "18:00:00"),
      punch("almoco_saida", "20:00:00"),
      punch("almoco_retorno", "21:00:00"),
      punch("saida", "23:00:00"),
    ];
    const row = monthlyRows("2026-10", data)[0];
    expect(row.night).toBe(true);
    expect(row.seconds).toBe(4 * 3600);
    expect(row.status).toContain("hora reduzida");
  });
});
