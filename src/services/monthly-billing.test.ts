import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  create: vi.fn(),
  collection: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mocks.collection, runTransaction: mocks.runTransaction },
}));
import { listMonthlyBilling, saveMonthlyBilling } from "./monthly-billing";

const user: AuthContext = {
  uid: "admin",
  role: "SUPER_ADMIN",
  email: "test@example.com",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
let companies: ReturnType<typeof snapshot>[];
let contracts: Map<string, ReturnType<typeof snapshot>>;
function ref(path: string): FirebaseFirestore.DocumentReference {
  const parts = path.split("/");
  return {
    path,
    id: parts.at(-1),
    parent: { parent: parts.length > 2 ? { id: parts.at(-3) } : null },
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    get: async () => read({ path }),
  } as unknown as FirebaseFirestore.DocumentReference;
}
function snapshot(id: string, data?: Record<string, unknown>, contract = false) {
  const path = contract ? `companies/${id}/contracts/fixed-monthly-billing` : `companies/${id}`;
  return {
    id: contract ? "fixed-monthly-billing" : id,
    exists: !!data,
    ref: ref(path),
    data: () => data,
    updateTime: data ? { toMillis: () => 100 } : undefined,
  };
}
function read(target: { path: string }) {
  if (target.path === "companies") return { docs: companies, size: companies.length };
  const id = target.path.split("/")[1];
  return contracts.get(id) || snapshot(id, undefined, true);
}
beforeEach(() => {
  vi.clearAllMocks();
  contracts = new Map();
  companies = [
    snapshot("GROUP", {
      name: "Grupo Exemplo",
      active: true,
      portfolioClientId: "group",
      portfolioClientName: "Grupo Exemplo",
    }),
  ];
  mocks.collection.mockImplementation((name: string) => ({
    path: name,
    limit: () => ({ path: name, get: async () => read({ path: name }) }),
    doc: (id = "audit") => ref(`${name}/${id}`),
  }));
  mocks.get.mockImplementation(read);
  mocks.runTransaction.mockImplementation((callback) =>
    callback({ get: mocks.get, set: mocks.set, create: mocks.create })
  );
});
async function input() {
  return {
    groupCompanyId: "GROUP",
    sourceName: "example.xlsx",
    revision: (await listMonthlyBilling(user, "GROUP")).revision,
    confirmed: true as const,
    rows: [{ cnpj: "11222333000181", name: "Empresa Exemplo", valueCents: 12345 }],
  };
}
describe("monthly billing transaction", () => {
  it("writes a company, one monthly contract and an audit, all inside the transaction", async () => {
    const result = await saveMonthlyBilling(user, await input());
    expect(result).toMatchObject({ saved: true, changed: 1, count: 1, totalCents: 12345 });
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[0][0].path).toBe("companies/11222333000181");
    expect(mocks.set.mock.calls[0][1]).toMatchObject({
      portfolioClientId: "group",
      name: "Empresa Exemplo",
    });
    expect(mocks.set.mock.calls[0][1]).not.toHaveProperty("risk_degree");
    expect(mocks.set.mock.calls[1][1]).toMatchObject({
      valueCents: 12345,
      value: 123.45,
      frequency: "monthly",
      billingType: "fixed_monthly",
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const lastRead = Math.max(...mocks.get.mock.invocationCallOrder);
    expect(lastRead).toBeLessThan(mocks.set.mock.invocationCallOrder[0]);
  });
  it("makes a repeated identical import a no-op", async () => {
    companies.push(
      snapshot("legacy", {
        name: "Empresa Exemplo",
        cnpj: "11.222.333/0001-81",
        active: true,
        portfolioClientId: "group",
      })
    );
    contracts.set(
      "legacy",
      snapshot(
        "legacy",
        {
          companyName: "Empresa Exemplo",
          cnpj: "11222333000181",
          valueCents: 12345,
          portfolioClientId: "group",
          billingType: "fixed_monthly",
          status: "active",
        },
        true
      )
    );
    expect((await saveMonthlyBilling(user, await input())).changed).toBe(0);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects stale revisions and cross-group conflicts without any writes", async () => {
    const stale = await input();
    companies.push(snapshot("new", { name: "Outro" }));
    await expect(saveMonthlyBilling(user, stale)).rejects.toMatchObject({ status: 409 });
    companies.push(snapshot("legacy", { cnpj: "11222333000181", portfolioClientId: "different" }));
    await expect(saveMonthlyBilling(user, await input())).rejects.toMatchObject({ status: 409 });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not read or write data for a tenant administrator", async () => {
    const payload = await input();
    mocks.collection.mockClear();
    await expect(
      saveMonthlyBilling({ ...user, role: "CLIENT_ADMIN" }, payload)
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.collection).not.toHaveBeenCalled();
  });
});
