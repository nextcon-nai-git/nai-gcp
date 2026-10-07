import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
const mock = vi.hoisted(() => ({ collection: vi.fn(), avp: vi.fn(), failEmployees: false }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mock.collection } }));
vi.mock("@/services/avp-sheet-sync", () => ({ getAvpSnapshot: mock.avp }));
import { getExecutiveDashboard } from "./executive-dashboard";
const user = (role: AuthContext["role"], tenantId: string | null = null): AuthContext => ({
  uid: "synthetic",
  email: "synthetic@example.test",
  role,
  tenantId,
  servedCompanies: [],
  permissions: [],
});
const company = (id: string) => ({
  id,
  exists: true,
  data: () => ({
    name: `Company ${id}`,
    city: "Brasília",
    state: "DF",
    active: true,
    omie_app_secret: "NEVER_SERIALIZE",
  }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.failEmployees = false;
  const subcollection = (name: string) => ({
    select: () => ({
      limit: () => ({
        get: async () => ({
          size: 1,
          docs: [
            {
              id: "task",
              data: () => ({
                title: "Synthetic task",
                status: "todo",
                dueDate: "2026-01-01",
                description: "PRIVATE_DESCRIPTION",
              }),
            },
          ],
        }),
      }),
    }),
    count: () => ({
      get: async () => {
        if (mock.failEmployees && name === "employees") throw new Error("offline");
        return { data: () => ({ count: name === "employees" ? 12 : 2 }) };
      },
    }),
    where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 3 }) }) }) }),
  });
  mock.collection.mockImplementation(() => ({
    select: () => ({
      limit: () => ({ get: async () => ({ docs: [company("a"), company("b")] }) }),
    }),
    doc: (id: string) => ({ get: async () => company(id), collection: subcollection }),
  }));
  mock.avp.mockResolvedValue({ revision: "", items: [], status: "CONFIGURATION_REQUIRED" });
});
describe("Dashboard server data boundary", () => {
  it("rejects a foreign company before reading the database", async () => {
    await expect(getExecutiveDashboard(user("HR", "a"), "b")).rejects.toThrow();
    expect(mock.collection).not.toHaveBeenCalled();
  });
  it("returns only a tenant's own aggregates and no raw sensitive fields", async () => {
    const result = await getExecutiveDashboard(user("HR", "a"), "all");
    expect(result.choices).toEqual([{ id: "a", name: "Company a" }]);
    expect(result.clients).toHaveLength(1);
    expect(result.clients[0]).toMatchObject({ employees: 12, pgr: 2, risksToReview: 3 });
    expect(JSON.stringify(result)).not.toMatch(/NEVER_SERIALIZE|PRIVATE_DESCRIPTION/);
    expect(mock.avp).not.toHaveBeenCalled();
  });
  it("keeps failed sources null and flags the incomplete view", async () => {
    mock.failEmployees = true;
    const result = await getExecutiveDashboard(user("SUPER_ADMIN"), "all");
    expect(result.clients.every((c) => c.employees === null)).toBe(true);
    expect(result.issues.some((s) => s.includes("colaboradores"))).toBe(true);
    expect(result.clients[0].tasks?.total).toBe(1);
    expect(result.avp).toBeNull();
  });
});
