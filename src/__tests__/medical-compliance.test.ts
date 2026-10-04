import { describe, it, expect } from "vitest";
import { MedicalAuditLogger } from "@/lib/medical-audit-logger";
import { maskPatientName, maskCpf, maskPhone } from "@/lib/logger";

describe("NAI - Medical Compliance & Occupational Health Rules (NR-07, NR-35, CFM)", () => {
  describe("NR-35 - Trabalho em Altura: Bloqueio de Aptidão por Ausência de Exames Mandatórios", () => {
    const NR35_MANDATORY_EXAMS = [
      { code: "0295", name: "Exame Clínico Ocupacional" },
      { code: "0010", name: "Eletrocardiograma (ECG)" },
      { code: "0011", name: "Eletroencefalograma (EEG)" },
      { code: "0012", name: "Glicemia em Jejum" },
      { code: "0013", name: "Acuidade Visual" },
    ];

    function validateHeightWorkCompliance(performedExamCodes: string[]): {
      compliant: boolean;
      missingExams: string[];
    } {
      const missing = NR35_MANDATORY_EXAMS.filter((m) => !performedExamCodes.includes(m.code));
      return {
        compliant: missing.length === 0,
        missingExams: missing.map((m) => m.name),
      };
    }

    it("deve aprovar colaborador com todos os exames mandatórios da NR-35", () => {
      const performed = ["0295", "0010", "0011", "0012", "0013"];
      const result = validateHeightWorkCompliance(performed);
      expect(result.compliant).toBe(true);
      expect(result.missingExams.length).toBe(0);
    });

    it("deve bloquear aptidão e listar exames faltantes quando faltar EEG ou ECG", () => {
      const performed = ["0295", "0010", "0012"]; // Falta EEG (0011) e Acuidade (0013)
      const result = validateHeightWorkCompliance(performed);
      expect(result.compliant).toBe(false);
      expect(result.missingExams).toContain("Eletroencefalograma (EEG)");
      expect(result.missingExams).toContain("Acuidade Visual");
    });
  });

  describe("NR-07 - PCMSO: Validade e Periodicidade de Exames Clínicos por Grau de Risco", () => {
    function calculateAsoValidityMonths(riskDegree: 1 | 2 | 3 | 4, age: number): number {
      // Regras oficiais da NR-07 (item 7.5.8):
      // Empresas de graus de risco 1 e 2: a cada 2 anos para trabalhadores entre 18 e 45 anos; anual se <18 ou >45
      // Empresas de graus de risco 3 e 4: a cada ano
      if (riskDegree === 3 || riskDegree === 4) return 12;
      if (age >= 18 && age <= 45) return 24;
      return 12;
    }

    it("graus de risco 3 e 4 devem exigir periodicidade estritamente anual (12 meses)", () => {
      expect(calculateAsoValidityMonths(3, 25)).toBe(12);
      expect(calculateAsoValidityMonths(4, 30)).toBe(12);
    });

    it("graus de risco 1 e 2 para trabalhadores de 18 a 45 anos permitem periodicidade bienal (24 meses)", () => {
      expect(calculateAsoValidityMonths(1, 28)).toBe(24);
      expect(calculateAsoValidityMonths(2, 40)).toBe(24);
    });

    it("graus de risco 1 e 2 para menores de 18 ou maiores de 45 devem ser anuais", () => {
      expect(calculateAsoValidityMonths(1, 17)).toBe(12);
      expect(calculateAsoValidityMonths(2, 52)).toBe(12);
    });
  });

  describe("Sigilo Médico CFM & LGPD (Resolução CFM nº 2.314/2022 & Art. 11 LGPD)", () => {
    it("deve registrar acesso em trilha de auditoria CFM com identificação imutável", () => {
      const entry = MedicalAuditLogger.logAccess({
        userId: "MED_01",
        userName: "Dr. Roberto Medeiros",
        userRole: "DOCTOR",
        userCrmCoren: "CRM/PR 12345",
        action: "READ_PRONTUARIO",
        patientEmployeeId: "EMP_99",
        patientName: "Sebastião Souza e Silva",
        companyId: "COMP_1",
        ipAddress: "127.0.0.1",
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.action).toBe("READ_PRONTUARIO");
      expect(entry.userCrmCoren).toBe("CRM/PR 12345");
    });

    it("mascaramento de dados sensíveis de pacientes deve impedir vazamento de nomes completos e CPFs em logs", () => {
      const rawName = "Sebastião Souza e Silva";
      const masked = maskPatientName(rawName);
      expect(masked).toBe("Sebastião S. e. S.");
      expect(masked).not.toBe(rawName);

      const rawCpf = "987.654.321-99";
      expect(maskCpf(rawCpf)).toBe("***.***.***-99");
    });
  });
});
