import { describe, expect, it } from "vitest";
import { buildNursingAttendance, type NursingAttendanceValues } from "./nursing-attendance";
const values: NursingAttendanceValues = {
  companyId: "tenant-a",
  employeeId: "patient",
  complaint: "Queixa relatada",
  conduct: "observation",
  care_lines: [],
  coren: "DECLARADO-SP",
};
const employee = { id: "patient", name: "Paciente de teste", companyId: "tenant-a" };
const actor = {
  uid: "nurse",
  displayName: "Profissional responsável",
  email: "nurse@example.test",
};
describe("nursing attendance attribution", () => {
  it("retains supplied credential, real employee identity and authenticated actor without declaring transmission", () => {
    const record = buildNursingAttendance(
      values,
      employee,
      actor,
      new Date("2026-10-18T05:00:00Z")
    );
    expect(record).toMatchObject({
      employeeName: employee.name,
      nurseName: actor.displayName,
      createdBy: actor.uid,
      coren: values.coren,
      status_esocial: "Não transmitido",
      createdAt: "2026-10-18T05:00:00.000Z",
    });
  });
  it.each(["", "   ", undefined])("requires an explicitly supplied credential %j", (coren) => {
    expect(() =>
      buildNursingAttendance({ ...values, coren } as NursingAttendanceValues, employee, actor)
    ).toThrow();
  });
  it.each([
    undefined,
    { ...employee, id: "other" },
    { ...employee, companyId: "tenant-b" },
    { ...employee, name: "" },
    { ...employee, isDeleted: true },
  ])("rejects missing, stale, deleted or foreign employee %j", (patient) => {
    expect(() => buildNursingAttendance(values, patient, actor)).toThrow("colaborador válido");
  });
  it.each([null, { uid: "" }, { uid: "nurse", displayName: " " }])(
    "does not invent a professional identity %j",
    (user) => {
      expect(() => buildNursingAttendance(values, employee, user)).toThrow("Identifique");
    }
  );
  it("can attribute the authenticated email when display name is absent", () => {
    expect(
      buildNursingAttendance(values, employee, { ...actor, displayName: null }).nurseName
    ).toBe(actor.email);
  });
  it.each(["all", "unauthorized", "a/b"])("rejects non-company scope %s", (companyId) => {
    expect(() => buildNursingAttendance({ ...values, companyId }, employee, actor)).toThrow();
  });
});
