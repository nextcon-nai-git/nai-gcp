// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { SOC_DASHBOARD_MAX_BYTES } from "@/lib/integrations/soc-dashboard";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mocks.get }) }),
    runTransaction: mocks.transaction,
  },
}));
import { GET, PUT } from "./route";

const snapshot = {
  schemaVersion: 1,
  source: "SOC · consulta manual",
  observedAt: "2026-01-15T12:00:00Z",
  dueSoonEnd: "2026-02-14",
  inactiveExcluded: 1,
  activeCompanies: [{ id: "101", name: "Empresa de teste" }],
  reports: [],
  administrativeTasks: [],
  limitation: "Aguardando leitura dos relatórios.",
};
const request = (body?: unknown) =>
  new NextRequest(
    "https://nai.test/api/integrations/soc/dashboard",
    body === undefined
      ? {}
      : {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
  );
const write = (overrides = {}) => request({ snapshot, expectedVersion: null, ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ uid: "admin-test", role: "ADMIN", tenantId: null });
  mocks.get.mockResolvedValue({ exists: false, data: () => undefined });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ get: mocks.get, set: mocks.set })
  );
});

describe("protected SOC dashboard", () => {
  it("requires authentication for reads and writes before accessing storage", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Entre novamente.", 401));
    expect((await GET(request())).status).toBe(401);
    expect((await PUT(write())).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("blocks client tenants for both reads and writes", async () => {
    mocks.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await GET(request())).status).toBe(403);
    expect((await PUT(write())).status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("permits operations to read but not publish", async () => {
    mocks.auth.mockResolvedValue({ role: "OPERATIONS", tenantId: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ canPublish: false, snapshot: null });
    expect((await PUT(write())).status).toBe(403);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("returns a private empty state without claiming a zero count", async () => {
    const response = await GET(request());
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(await response.json()).toEqual({
      snapshot: null,
      version: null,
      savedAt: null,
      canPublish: true,
    });
  });
  it("publishes only validated data with a server audit timestamp and actor", async () => {
    const response = await PUT(write());
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        snapshot,
        updatedBy: "admin-test",
        version: expect.any(String),
        savedAt: expect.any(String),
      })
    );
    expect(await response.json()).not.toHaveProperty("updatedBy");
  });
  it("rejects unsupported fields rather than storing raw report data", async () => {
    expect((await PUT(write({ snapshot: { ...snapshot, credentials: "secret" } }))).status).toBe(
      400
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("enforces a streaming size limit", async () => {
    expect((await PUT(request({ payload: "x".repeat(SOC_DASHBOARD_MAX_BYTES) }))).status).toBe(413);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    expect(
      (
        await PUT(
          new NextRequest("https://nai.test", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: "{",
          })
        )
      ).status
    ).toBe(400);
  });
  it("rejects stale concurrent updates", async () => {
    mocks.get.mockResolvedValue({
      exists: true,
      data: () => ({ version: "9ae33640-8042-4bcb-8ed1-611fdb552a8c", snapshot }),
    });
    expect((await PUT(write())).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rejects replacing a newer observation with an older one", async () => {
    const version = "9ae33640-8042-4bcb-8ed1-611fdb552a8c";
    mocks.get.mockResolvedValue({
      exists: true,
      data: () => ({ version, snapshot: { ...snapshot, observedAt: "2026-02-15T12:00:00Z" } }),
    });
    expect((await PUT(write({ expectedVersion: version }))).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rejects future observations", async () => {
    expect(
      (
        await PUT(
          write({
            snapshot: { ...snapshot, observedAt: "2099-01-15T12:00:00Z", dueSoonEnd: "2099-02-14" },
          })
        )
      ).status
    ).toBe(400);
  });
  it("reports storage failures instead of showing an empty healthy dashboard", async () => {
    mocks.get.mockRejectedValue(new Error("private database details"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database");
  });
});

const summary = {
  companyId: "101",
  importedAt: "2026-01-15T12:00:00Z",
  referenceDate: "2026-01-15",
  dueSoonEnd: "2026-02-14",
  source: "SOC · Convocação de Exames CSV",
  total: 2,
  overdue: 1,
  dueSoon: 1,
  later: 0,
  unknown: 0,
  excludedInactive: 0,
  duplicates: 0,
};
it("preserves coverage when an older JSON layout omits summaries", async () => {
  const version = "9ae33640-8042-4bcb-8ed1-611fdb552a8c";
  mocks.get.mockResolvedValue({
    data: () => ({ version, snapshot: { ...snapshot, examSummaries: [summary] } }),
  });
  const response = await PUT(write({ expectedVersion: version }));
  expect(response.status).toBe(200);
  expect((await response.json()).snapshot.examSummaries).toEqual([summary]);
  expect(mocks.set.mock.calls[0][1].snapshot.examSummaries).toEqual([summary]);
});
it("rejects removing companies with preserved coverage unless summaries are explicitly consolidated", async () => {
  const version = "9ae33640-8042-4bcb-8ed1-611fdb552a8c";
  mocks.get.mockResolvedValue({
    data: () => ({ version, snapshot: { ...snapshot, examSummaries: [summary] } }),
  });
  expect(
    (
      await PUT(
        write({
          expectedVersion: version,
          snapshot: { ...snapshot, activeCompanies: [{ id: "102", name: "Outra" }] },
        })
      )
    ).status
  ).toBe(400);
  expect(mocks.set).not.toHaveBeenCalled();
});
it.each(["importedAt", "observedAt"])(
  "rejects invalid offsets in %s before persistence",
  async (field) => {
    const bad = "2026-01-15T12:00:00+24:00";
    const candidate =
      field === "observedAt"
        ? { ...snapshot, observedAt: bad }
        : { ...snapshot, examSummaries: [{ ...summary, importedAt: bad }] };
    expect((await PUT(write({ snapshot: candidate }))).status).toBe(400);
    expect(mocks.set).not.toHaveBeenCalled();
  }
);
