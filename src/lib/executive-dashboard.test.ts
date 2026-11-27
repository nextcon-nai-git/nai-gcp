import { describe, expect, it } from "vitest";
import { avpUnitLink } from "./avp-workforce";
import {
  type ExecutiveDashboard,
  workforceSource,
  dateOnly,
  saoPauloDay,
  summarizeTasks,
  summarizeAvp,
} from "./executive-dashboard";
import { dashboardScope } from "./auth/dashboard-access";
import type { AuthContext } from "./auth/auth-context";
import type { GrupoAvpAso } from "./grupo-avp-asos-data";

const now = new Date("2026-10-08T01:00:00Z"); // still October 7 in Sao Paulo
const company = { id: "a", name: "Client A" };
const task = (id: string, data: Record<string, unknown>) => ({ id, data });
const user = (role: AuthContext["role"], tenantId: string | null = null): AuthContext => ({
  uid: "test",
  email: "test@example.test",
  role,
  tenantId,
  permissions: [],
  servedCompanies: [],
});

describe("Executive dashboard source calculations", () => {
  it("does not classify today as overdue, and validates source dates", () => {
    expect(saoPauloDay(now)).toBe("2026-10-07");
    expect(dateOnly("31/02/2026")).toBeNull();
    expect(dateOnly("2026-02-30")).toBeNull();
    expect(dateOnly("07/10/2026")).toBe("2026-10-07");
    expect(dateOnly({ seconds: now.getTime() / 1000 })).toBe("2026-10-07");
    const summary = summarizeTasks(
      [
        task("late", { status: "todo", dueDate: "2026-10-06" }),
        task("today", { status: "doing", dueDate: "2026-10-07" }),
        task("done", { status: "done", dueDate: "2026-01-01" }),
        task("deleted", { status: "todo", dueDate: "2026-01-01", isDeleted: true }),
        task("unknown", { status: "mystery", dueDate: "2026-01-01" }),
        task("undated", { status: "todo", dueDate: "not-a-date" }),
      ],
      company,
      now
    );
    expect(summary).toMatchObject({
      total: 5,
      open: 3,
      overdue: 1,
      completed: 1,
      dueSoon: 1,
      undated: 1,
      unknownStatus: 1,
    });
    expect(summary.priorities[0].id).toBe("late");
  });
  it("keeps unknown states separate and carries incomplete source flags", () => {
    expect(summarizeTasks([], company, now, true)).toMatchObject({ total: 0, truncated: true });
    expect(summarizeTasks([task("archived", { status: "archived" })], company, now)).toMatchObject({
      open: 0,
      completed: 0,
    });
  });
  it("separates scheduling, completion, cancellations and unquoted values", () => {
    const row = (status: string, valorAso: string, dataPedidoIso = "2026-10-07") =>
      ({ status, valorAso, dataPedidoIso, urgencia: "URGENTE" }) as GrupoAvpAso;
    const result = summarizeAvp(
      [
        row("AGENDADO", "45"),
        row("NÃO INICIADO", "40"),
        row("EXAME FEITO", ""),
        row("GESTOR CANCELOU", "40 / 50"),
        row("STATUS NÃO RECONHECIDO", "", ""),
      ],
      "2026-10-08T00:55:00Z",
      "CONNECTED",
      now
    );
    expect(result).toMatchObject({
      total: 5,
      scheduled: 1,
      waiting: 2,
      completed: 1,
      cancelled: 1,
      urgentWaiting: 2,
      aboveTarget: 1,
      atLeast40: 2,
      missingCost: 3,
      unknownStatus: 1,
      invalidDates: 1,
      stale: false,
    });
    expect(result.timeline.reduce((n, p) => n + p.count, 0)).toBe(4);
    expect(result.stages.reduce((n, p) => n + p.count, 0)).toBe(5);
    expect(summarizeAvp([], "2026-10-07T20:00:00Z", "CONNECTED", now).stale).toBe(true);
    expect(summarizeAvp([], "2026-10-08T00:55:00Z", "ERROR", now).stale).toBe(true);
  });
});

describe("Dashboard tenant boundary", () => {
  it("allows global views only to global staff", () => {
    expect(dashboardScope(user("SUPER_ADMIN"), "all")).toBeNull();
    expect(dashboardScope(user("ADMIN"), "all")).toBeNull();
    expect(dashboardScope(user("OPERATIONS"), "all")).toBeNull();
    expect(dashboardScope(user("ADMIN", "a"), "all")).toBe("a");
    expect(dashboardScope(user("HR", "a"), "all")).toBe("a");
  });
  it("rejects foreign tenants, unprovisioned users and paths before any source read", () => {
    expect(() => dashboardScope(user("HR", "a"), "b")).toThrow();
    expect(() => dashboardScope(user("ADMIN", "a"), "b")).toThrow();
    expect(() => dashboardScope(user("GUEST", "a"), "all")).toThrow();
    expect(() => dashboardScope(user("HR"), "all")).toThrow();
    expect(() => dashboardScope(user("SUPER_ADMIN"), "a/tasks")).toThrow();
  });
});

describe("AVP company and unit reconciliation", () => {
  const record = (id: string, data: Record<string, string> = {}) => ({
    id,
    name: "Mesmo nome",
    portfolioClientId: data.portfolioClientId,
    avpUnit: avpUnitLink(id, data),
    employees: 3,
    active: true,
    tasks: null,
    pgr: 0,
    risksToReview: 0,
    location: "",
  });
  const group = record("GRUPO_AVP", { portfolioClientId: "avp" });
  const linked = record("02843943000101", { portfolioClientId: "avp", socCompanyId: "2306171" });
  const historical = { records: 5685, observedOn: "2026-10-16" };
  const data: ExecutiveDashboard = {
    avpWorkforce: { source: "manual", reading: null, issue: "configuration", historical },
    generatedAt: "2026-11-20T12:00:00Z",
    scope: "all",
    choices: [],
    clients: [group, linked],
    avp: null,
    avpAvailable: true,
    issues: [],
    clientsTruncated: false,
  };
  it("requires the company/portfolio identity and preserves separate SOC codes for same-name units", () => {
    expect(linked.avpUnit?.units).toEqual(["286", "300"]);
    expect(workforceSource(group, data)).toBe("soc");
    expect(workforceSource(linked, data)).toBe("group");
    expect(workforceSource(record("unrelated"), data)).toBe("nai");
    expect(workforceSource(record("orphan", { socCode: "2306171" }), data)).toBe("review");
    expect(workforceSource(record(linked.id), data)).toBe("review");
    expect(
      workforceSource(record(linked.id, { portfolioClientId: "avp", socCode: "999" }), data)
    ).toBe("review");
    expect(
      workforceSource(record(linked.id, { portfolioClientId: "avp", cnpj: "31300858000286" }), data)
    ).toBe("review");
  });
  it("flags overlapping local mappings and absent unit codes without counting local employees again", () => {
    const alias = record("legacy", { cnpj: "02.843.943/0001-01", portfolioClientId: "avp" });
    const duplicate = { ...data, clients: [group, linked, alias] };
    expect(workforceSource(alias, duplicate)).toBe("review");
    expect(workforceSource(linked, duplicate)).toBe("review");
    const reading = {
      checkedAt: data.generatedAt,
      active: 2,
      other: 0,
      unknown: 0,
      records: 2,
      observedUnits: ["286"],
      unmappedUnitRecords: 0,
    };
    expect(
      workforceSource(linked, {
        ...data,
        avpWorkforce: { source: "connector", issue: null, historical, reading },
      })
    ).toBe("review");
    expect(workforceSource(linked, { ...data, avpWorkforce: null })).toBe("nai");
  });
});
