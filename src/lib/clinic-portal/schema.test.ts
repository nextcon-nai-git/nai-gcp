import { describe, it, expect } from "vitest";
import { grantFor, portalView, inviteSchema, clinicalSchema, type PortalRecord } from "./schema";
const record: PortalRecord = {
  ownerUid: "owner",
  sourcePath: "users/owner/asoRequests/request",
  requestId: "request",
  clinicName: "Clinic",
  doctorName: "Doctor",
  crm: "123",
  uf: "PR",
  grants: [
    { email: "doctor@example.test", role: "doctor", uid: "doctor" },
    { email: "reception@example.test", role: "reception" },
  ],
  expiresAt: "2030-01-01T00:00:00Z",
  revoked: false,
  version: 0,
  state: "invited",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  identity: {
    companyName: "Company",
    cnpj: "123",
    employeeName: "Employee",
    cpf: "456",
    roleTitle: "Role",
    department: "Dept",
    examType: "periodico",
  },
  exams: [{ code: "clinical", name: "Clinical" }],
  risks: ["noise"],
  audit: [],
  clinical: {
    attendanceDate: "2026-01-01",
    history: "confidential",
    occupationalHistory: "",
    medications: "secret medicine",
    complaints: "",
    vitalSigns: "",
    physicalExam: "normal",
    results: "secret result",
    conduct: "",
    conclusion: "apto",
    observations: "",
  },
};
const doctor = { uid: "doctor", email: "doctor@example.test", email_verified: true };
describe("clinic portal isolation", () => {
  it("requires verified exact email and bound UID", () => {
    expect(grantFor(record, doctor)).toMatchObject({ role: "doctor" });
    expect(grantFor(record, { ...doctor, email_verified: false })).toBeNull();
    expect(grantFor(record, { ...doctor, uid: "another" })).toBeNull();
    expect(grantFor(record, { ...doctor, email: "other@example.test" })).toBeNull();
    expect(grantFor(record, { ...doctor, email: undefined })).toBeNull();
  });
  it("rejects expired and revoked invites", () => {
    expect(grantFor({ ...record, revoked: true }, doctor)).toBeNull();
    expect(grantFor(record, doctor, Date.parse(record.expiresAt))).toBeNull();
  });
  it("does not expose any clinical data or grants to reception", () => {
    const view = portalView(record, "reception");
    for (const key of ["clinical", "risks", "exams", "grants", "audit", "sourcePath", "ownerUid"])
      expect(view).not.toHaveProperty(key);
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(portalView(record, "doctor")).toHaveProperty("clinical.history", "confidential");
  });
  it("forbids shared reception and doctor identities and unreviewed invitations", () => {
    const input = {
      requestId: "request",
      clinicName: "Clinic",
      receptionEmail: "DOCTOR@example.test",
      doctorEmail: "doctor@example.test",
      doctorName: "Doctor",
      crm: "123",
      uf: "PR",
      days: 14,
      reviewed: true,
    };
    expect(inviteSchema.safeParse(input).success).toBe(false);
    expect(inviteSchema.safeParse({ ...input, receptionEmail: "", reviewed: false }).success).toBe(
      false
    );
    expect(inviteSchema.safeParse({ ...input, receptionEmail: "", days: 31 }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...input, receptionEmail: "" }).success).toBe(true);
  });
  it("rejects forged server fields, invalid dates and automatic clinical conclusions", () => {
    expect(
      clinicalSchema.safeParse({ ...record.clinical, attendanceDate: "2026-02-30" }).success
    ).toBe(false);
    expect(
      clinicalSchema.safeParse({ ...record.clinical, attendanceDate: "2999-01-01" }).success
    ).toBe(false);
    expect(clinicalSchema.safeParse({ ...record.clinical, ownerUid: "attacker" }).success).toBe(
      false
    );
    expect(clinicalSchema.safeParse({ ...record.clinical, conclusion: "approved" }).success).toBe(
      false
    );
    expect(clinicalSchema.safeParse(record.clinical).success).toBe(true);
  });
});
