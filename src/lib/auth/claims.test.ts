import { expect, it } from "vitest";
import { parseClaims } from "./claims";
import { requireAvpAccess } from "./avp-access";
import { dashboardScope } from "./dashboard-access";
import type { AuthContext } from "./auth-context";
import { requireClinicalAccess } from "./require-clinical-access";
import { requireFinancialAccess } from "./financial-access";
import { requirePgrCompany } from "./require-pgr-access";
it("preserves company isolation when legacy tenantId is empty", () => {
  for (const tenantId of ["", "   ", undefined]) {
    const claims = parseClaims({ role: "ADMIN", tenantId, companyId: "tenant-a" });
    expect(claims.tenantId).toBe("tenant-a");
    const user = {
      ...claims,
      uid: "test",
      email: "",
      permissions: [],
      servedCompanies: [],
    } as AuthContext;
    expect(dashboardScope(user, "all")).toBe("tenant-a");
    expect(() => dashboardScope(user, "tenant-b")).toThrow();
  }
});
it("retains an explicit tenant over the legacy company field", () => {
  expect(parseClaims({ tenantId: "tenant-a", companyId: "tenant-b" }).tenantId).toBe("tenant-a");
});

it("recognizes legacy internal administrators consistently across API guards", () => {
  for (const tenantId of [undefined, null, ""]) {
    const claims = parseClaims({ role: "ADMIN", companyId: "nextcon", tenantId });
    expect(claims.tenantId).toBeUndefined();
    const user: AuthContext = {
      ...claims,
      uid: "internal",
      email: "internal@example.test",
      tenantId: claims.tenantId || null,
      permissions: [],
      servedCompanies: [],
    };
    expect(() => requireFinancialAccess(user)).not.toThrow();
    expect(() => requireClinicalAccess(user, "tenant-b")).not.toThrow();
    expect(() => requirePgrCompany(user, "tenant-b")).not.toThrow();
    expect(dashboardScope(user, "all")).toBeNull();
  }
});

it("recognizes legacy internal operations without granting clinical or financial access", () => {
  const claims = parseClaims({ role: "OPERATIONS", companyId: "nextcon" });
  const user: AuthContext = {
    ...claims,
    uid: "operations",
    email: "",
    tenantId: claims.tenantId || null,
    permissions: [],
    servedCompanies: [],
  };
  expect(claims.tenantId).toBeUndefined();
  expect(dashboardScope(user, "all")).toBeNull();
  expect(() => requireClinicalAccess(user, "tenant-b")).toThrow();
  expect(() => requireFinancialAccess(user)).toThrow();
});

it("never treats an explicit tenant or a noninternal nextcon role as global", () => {
  for (const role of ["ADMIN", "OPERATIONS", "DOCTOR", "PROVIDER", "CLIENT_ADMIN"]) {
    expect(parseClaims({ role, companyId: "nextcon", tenantId: "tenant-a" }).tenantId).toBe(
      "tenant-a"
    );
    expect(parseClaims({ role, companyId: "nextcon", tenantId: "nextcon" }).tenantId).toBe(
      "nextcon"
    );
    expect(parseClaims({ role, companyId: "nextcon", tenantId: "   " }).tenantId).toBe("nextcon");
  }
  for (const role of ["DOCTOR", "PROVIDER", "CLIENT_ADMIN", "GUEST"])
    expect(parseClaims({ role, companyId: "nextcon", tenantId: null }).tenantId).toBe("nextcon");
});

it("unrecognized role strings never inherit tenant API access", () => {
  for (const role of ["UNKNOWN_LEGACY", 0, false, "", null]) {
    const claims = parseClaims({ role, companyId: "GRUPO_AVP" });
    expect(claims.role).toBe("GUEST");
    expect(() =>
      requireAvpAccess({
        ...claims,
        uid: "legacy",
        email: "",
        permissions: [],
        servedCompanies: [],
        tenantId: "GRUPO_AVP",
      })
    ).toThrow();
  }
});
