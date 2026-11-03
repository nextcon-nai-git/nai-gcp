import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: m.collection } }));
import { requireCurrentFinancialAccess } from "./financial-access";

const admin: AuthContext = {
  uid: "internal-admin",
  email: "admin@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.collection.mockReturnValue({ doc: m.doc });
  m.doc.mockReturnValue({ get: m.get });
  m.get.mockResolvedValue({ exists: true, data: () => ({ role: "ADMIN", accessEnabled: true }) });
});
describe("current corporate finance grant", () => {
  it("rechecks the authenticated user's stored profile", async () => {
    await expect(requireCurrentFinancialAccess(admin)).resolves.toBeUndefined();
    expect(m.collection).toHaveBeenCalledWith("users");
    expect(m.doc).toHaveBeenCalledWith(admin.uid);
  });
  it("preserves the existing global SUPER_ADMIN access contract", async () => {
    m.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "SUPER_ADMIN", tenantId: "legacy-tenant", accessEnabled: true }),
    });
    await expect(requireCurrentFinancialAccess(admin)).resolves.toBeUndefined();
  });
  it("denies initially unauthorized actors before reading profiles", async () => {
    await expect(
      requireCurrentFinancialAccess({ ...admin, role: "OPERATIONS" })
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(m.collection).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    { role: "SUPER_ADMIN", accessEnabled: false },
    { role: "SUPER_ADMIN", isDeleted: true },
    { role: "OPERATIONS", accessEnabled: true },
    { role: "ADMIN", tenantId: "customer", accessEnabled: true },
    { role: "ADMIN", companyId: "legacy-customer", accessEnabled: true },
  ])("denies suspended, deleted, missing or narrowed grants: %j", async (profile) => {
    m.get.mockResolvedValue({ exists: !!profile, data: () => profile });
    await expect(requireCurrentFinancialAccess(admin)).rejects.toMatchObject({ status: 403 });
  });
  it("fails closed when current permissions cannot be read", async () => {
    m.get.mockRejectedValue(new Error("profile unavailable"));
    await expect(requireCurrentFinancialAccess(admin)).rejects.toThrow("profile unavailable");
  });
});
