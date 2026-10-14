import { expect, it } from "vitest";
import { parseClaims } from "./claims";
import { dashboardScope } from "./dashboard-access";
import type { AuthContext } from "./auth-context";
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
