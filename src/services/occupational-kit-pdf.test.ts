import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { generateOccupationalKitPdf, occupationalKitFilename } from "./occupational-kit-pdf";
import type { DigitalKit } from "@/types/aso-scheduler-types";
export const sampleKit: DigitalKit = {
  kitId: "KIT-TEST",
  requestId: "request-sintetico",
  guiaNumber: "MINUTA-TEST",
  generatedAt: "2026-10-01T00:00:00Z",
  companyDetails: { name: "Empresa de Demonstração", cnpj: "DADO SINTÉTICO", contact: "" },
  employeeDetails: {
    name: "Pessoa de Demonstração",
    cpf: "DADO SINTÉTICO",
    roleTitle: "Administrativo",
    department: "Operações",
  },
  examType: "periodico",
  clinicDetails: {
    name: "Clínica de Demonstração",
    address: "Endereço de demonstração",
    phone: "",
  },
  appointmentDateTime: "A confirmar",
  examList: [
    {
      code: "CLINICO",
      name: "Avaliação clínica ocupacional",
      mandatory: "OBRIGATORIO",
      pcmsoJustification: "Conferir PCMSO",
      patientPreparo: "Confirmar com a clínica",
    },
  ],
  patientInstructions: ["Apresentar documento de identificação."],
  clinicInstructions: [],
  returnDeadlineDays: 0,
  asoTemplate: {
    declaredRisks: [],
    fitnessChecklist: "APTO ASSINADO NÃO COPIAR",
    doctorNotes: "DIAGNÓSTICO NÃO COPIAR",
  },
  qrCodeUrl: "",
};
describe("Kit ocupacional PDF", () => {
  it("gera quatro páginas e mantém conclusões e datas clínicas em branco", () => {
    const doc = generateOccupationalKitPdf(sampleKit, undefined, new Date("2026-10-23T01:00:00Z"));
    const output = doc.output();
    expect(doc.getNumberOfPages()).toBe(4);
    expect(output).toContain("22/10/2026");
    expect(output).not.toContain("APTO ASSINADO");
    expect(output).not.toContain("DIAGNÓSTICO");
    expect(output).toContain("____/____/________");
    if (process.env.KIT_PDF_QA)
      writeFileSync(process.env.KIT_PDF_QA, Buffer.from(doc.output("arraybuffer")));
  });
  it("pagina conteúdo extenso sem truncar as instruções", () => {
    const doc = generateOccupationalKitPdf({
      ...sampleKit,
      patientInstructions: Array.from(
        { length: 120 },
        (_, i) => `Instrução ${i}: conferir preparo com a clínica.`
      ),
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(4);
    expect(doc.output()).toContain("119");
  });
  it("recusa identidade ausente e sanitiza nome do arquivo", () => {
    expect(() =>
      generateOccupationalKitPdf({
        ...sampleKit,
        employeeDetails: { ...sampleKit.employeeDetails, name: " " },
      })
    ).toThrow("empresa e colaborador");
    expect(occupationalKitFilename(sampleKit)).toBe("Kit-NAI-Pessoa de Demonstracao.pdf");
  });
});
