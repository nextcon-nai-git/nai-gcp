import { expect, it } from "vitest";
import { canAccessAvpEvidence } from "./avp-access";
it.each([
  ["SUPER_ADMIN", "client", [], true],
  ["ADMIN", null, [], true],
  ["OPERATIONS", null, ["GRUPO_AVP"], true],
  ["ADMIN", "GRUPO_AVP", [], false],
  ["OPERATIONS", null, [], false],
  ["OPERATIONS", "GRUPO_AVP", ["GRUPO_AVP"], false],
  ["DOCTOR", null, ["GRUPO_AVP"], false],
  [null, null, [], false],
] as const)(
  "matches internal evidence access for %s / %s",
  (role, tenantId, servedCompanies, allowed) => {
    expect(canAccessAvpEvidence({ role, tenantId, servedCompanies: [...servedCompanies] })).toBe(
      allowed
    );
  }
);
