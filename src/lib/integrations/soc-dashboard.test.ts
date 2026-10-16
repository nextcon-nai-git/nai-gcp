import { describe, expect, it } from "vitest";
import { socDashboardSchema, summarizeSocDashboard } from "./soc-dashboard";

export const fixture = {
  schemaVersion: 1 as const,
  source: "SOC · consulta manual" as const,
  observedAt: "2026-01-15T09:00:00-03:00",
  dueSoonEnd: "2026-02-14",
  inactiveExcluded: 1,
  activeCompanies: [{ id: "101", name: "Empresa de teste" }],
  reports: [
    {
      id: "201",
      title: "Convocação",
      category: "convocation" as const,
      status: "ready" as const,
      scope: "Empresas ativas",
      periodStart: null,
      periodEnd: null,
      scheduledFor: null,
      note: "Conteúdo ainda não lido.",
    },
  ],
  administrativeTasks: [],
  limitation: "Contagens de ASOs ainda não confirmadas.",
};

describe("SOC dashboard evidence", () => {
  it("never derives ASO counts from available or empty reports", () => {
    for (const status of ["ready", "empty"] as const) {
      const result = summarizeSocDashboard({
        ...fixture,
        reports: [{ ...fixture.reports[0], status }],
      });
      expect(result.overdue).toBeNull();
      expect(result.dueSoon).toBeNull();
      expect(result.pendingAsos).toBeNull();
    }
  });
  it("preserves distinct SOC codes with the same company name", () => {
    const snapshot = socDashboardSchema.parse({
      ...fixture,
      activeCompanies: [...fixture.activeCompanies, { id: "102", name: "Empresa de teste" }],
    });
    expect(summarizeSocDashboard(snapshot).activeCompanies).toBe(2);
  });
  it("rejects duplicate codes, unrecognized fields and personal record payloads", () => {
    expect(
      socDashboardSchema.safeParse({
        ...fixture,
        activeCompanies: [...fixture.activeCompanies, ...fixture.activeCompanies],
      }).success
    ).toBe(false);
    expect(
      socDashboardSchema.safeParse({ ...fixture, employees: [{ cpf: "secret" }] }).success
    ).toBe(false);
    expect(
      socDashboardSchema.safeParse({
        ...fixture,
        activeCompanies: [{ ...fixture.activeCompanies[0], active: false }],
      }).success
    ).toBe(false);
  });
  it("rejects impossible dates, malformed timestamps and reversed periods without throwing", () => {
    expect(socDashboardSchema.safeParse({ ...fixture, dueSoonEnd: "2026-02-30" }).success).toBe(
      false
    );
    expect(socDashboardSchema.safeParse({ ...fixture, observedAt: "invalid" }).success).toBe(false);
    expect(
      socDashboardSchema.safeParse({
        ...fixture,
        reports: [{ ...fixture.reports[0], periodStart: "2026-02-01", periodEnd: "2026-01-01" }],
      }).success
    ).toBe(false);
  });
  it("requires a date for a scheduled report and forbids it for a ready report", () => {
    expect(
      socDashboardSchema.safeParse({
        ...fixture,
        reports: [{ ...fixture.reports[0], status: "scheduled" }],
      }).success
    ).toBe(false);
    expect(
      socDashboardSchema.safeParse({
        ...fixture,
        reports: [{ ...fixture.reports[0], scheduledFor: "2026-01-16" }],
      }).success
    ).toBe(false);
  });
});
