import { describe, it, expect } from "vitest";
import { dailyReportSchema, activityLines, normalizedEmployeeName } from "./daily-activity-report";
describe("Daily activity reports", () => {
  it("preserves reported statuses and separates lines", () => {
    expect(activityLines("- NF enviada\n- Aguardando retorno\n\n- Enviarei hoje")).toEqual([
      "NF enviada",
      "Aguardando retorno",
      "Enviarei hoje",
    ]);
  });
  it("uses the explicit activity date and rejects impossible dates", () => {
    const report = {
      employeeName: "Kelly Tassiane",
      contractType: "CLT",
      date: "2026-10-07",
      reportText: "NF enviada",
    };
    expect(dailyReportSchema.parse(report).date).toBe("2026-10-07");
    expect(dailyReportSchema.safeParse({ ...report, date: "2026-02-30" }).success).toBe(false);
  });
  it("normalizes names consistently for duplicate prevention", () => {
    expect(normalizedEmployeeName(" KELLY  Tassiane ")).toBe("kelly tassiane");
  });
});
