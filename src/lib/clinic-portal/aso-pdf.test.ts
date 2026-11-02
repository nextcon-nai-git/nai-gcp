import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ text: vi.fn(), save: vi.fn() }));
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFontSize() {}
    splitTextToSize(value: string) {
      return [value];
    }
    text = mock.text;
    addPage() {}
    save = mock.save;
  },
}));
import { downloadAsoForSignature } from "./aso-pdf";
describe("ASO excludes confidential clinical findings", () => {
  it("exports identity, requested examinations and conclusion without history or diagnoses", () => {
    downloadAsoForSignature(
      {
        identity: {
          companyName: "Company",
          cnpj: "123",
          employeeName: "Worker",
          cpf: "456",
          roleTitle: "Role",
          department: "Dept",
          examType: "periodico",
        },
        exams: [{ code: "clinical", name: "Clinical exam" }],
        risks: ["noise"],
        doctorName: "Doctor",
        crm: "123",
        uf: "PR",
      },
      {
        attendanceDate: "2026-01-01",
        history: "SECRET HISTORY",
        occupationalHistory: "SECRET OCCUPATION",
        medications: "SECRET MEDICATION",
        complaints: "SECRET COMPLAINT",
        vitalSigns: "SECRET VITALS",
        physicalExam: "SECRET PHYSICAL",
        results: "SECRET RESULTS",
        conduct: "SECRET CONDUCT",
        conclusion: "apto",
        observations: "SECRET OBSERVATIONS",
      }
    );
    const content = JSON.stringify(mock.text.mock.calls);
    expect(content).toContain("Worker");
    expect(content).toContain("APTO");
    expect(content).toContain("SEM ASSINATURA");
    expect(content).not.toContain("SECRET");
  });
});
