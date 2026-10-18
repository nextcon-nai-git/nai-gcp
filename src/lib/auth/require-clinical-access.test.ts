import { describe, expect, it } from "vitest";
import { requireClinicalAccess } from "./require-clinical-access";
import type { AuthContext, UserRole } from "./auth-context";
const context = (
  role: UserRole,
  tenantId: string | null = "tenant-a",
  servedCompanies: string[] = []
): AuthContext => ({
  uid: "test",
  email: "test@example.test",
  role,
  tenantId,
  servedCompanies,
  permissions: [],
});
describe("clinical authorization", () => {
  it.each(["ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "PROVIDER"] as const)(
    "requires scope for %s",
    (role) => {
      expect(() => requireClinicalAccess(context(role), "tenant-a")).not.toThrow();
      expect(() => requireClinicalAccess(context(role), "tenant-b")).toThrow(
        "Empresa não liberada"
      );
      expect(() =>
        requireClinicalAccess(context(role, "tenant-a", ["tenant-b"]), "tenant-b")
      ).not.toThrow();
    }
  );
  it.each([
    "HR",
    "RH",
    "OPERATIONS",
    "ENGINEER",
    "CLIENT_ADMIN",
    "GUEST",
    "SAFETY_TECH",
    "COMPLIANCE",
  ] as const)("denies nonclinical %s even with a served company", (role) => {
    expect(() => requireClinicalAccess(context(role, null, ["tenant-a"]), "tenant-a")).toThrow(
      "Seu perfil"
    );
  });
  it("allows only global administrators across tenants", () => {
    expect(() => requireClinicalAccess(context("SUPER_ADMIN"), "tenant-b")).not.toThrow();
    expect(() => requireClinicalAccess(context("ADMIN", null), "tenant-b")).not.toThrow();
  });
  it.each([
    null,
    42,
    "",
    " ",
    " a",
    "a ",
    "a/b",
    "a\\b",
    "a\n",
    "all",
    "unauthorized",
    "x".repeat(129),
  ])("rejects malformed company %j", (company) => {
    expect(() => requireClinicalAccess(context("SUPER_ADMIN"), company as string)).toThrow(
      "empresa válida"
    );
  });
});
