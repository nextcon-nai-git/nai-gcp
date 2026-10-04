import { describe, it, expect } from "vitest";
import { NotificationService } from "@/services/notification-service";

describe("NotificationService - Periodicidade NR-07 e Alertas PCMSO", () => {
  describe("determinePeriodicity (NR-07 Item 7.5.8)", () => {
    it("deve definir periodicidade bienal (24 meses) para Grau 1/2 e idade entre 18 e 45 anos", () => {
      const res = NotificationService.determinePeriodicity({
        riskDegree: 2,
        age: 30,
      });

      expect(res.periodicity).toBe("BIENAL");
      expect(res.intervalMonths).toBe(24);
      expect(res.regulatoryBasis).toContain("Bienal");
    });

    it("deve definir periodicidade anual (12 meses) para Grau 1/2 e idade > 45 anos", () => {
      const res = NotificationService.determinePeriodicity({
        riskDegree: 1,
        age: 46,
      });

      expect(res.periodicity).toBe("ANUAL");
      expect(res.intervalMonths).toBe(12);
    });

    it("deve definir periodicidade anual (12 meses) para Grau 1/2 e idade < 18 anos", () => {
      const res = NotificationService.determinePeriodicity({
        riskDegree: 2,
        age: 17,
      });

      expect(res.periodicity).toBe("ANUAL");
      expect(res.intervalMonths).toBe(12);
    });

    it("deve definir periodicidade anual (12 meses) para Grau 3 e 4 independente da idade", () => {
      const resGrau3 = NotificationService.determinePeriodicity({
        riskDegree: 3,
        age: 28,
      });
      expect(resGrau3.periodicity).toBe("ANUAL");
      expect(resGrau3.intervalMonths).toBe(12);

      const resGrau4 = NotificationService.determinePeriodicity({
        riskDegree: 4,
        age: 35,
      });
      expect(resGrau4.periodicity).toBe("ANUAL");
      expect(resGrau4.intervalMonths).toBe(12);
    });

    it("deve definir periodicidade semestral (6 meses) para riscos especiais do Quadro 1", () => {
      const res = NotificationService.determinePeriodicity({
        riskDegree: 2,
        age: 30,
        hasSpecialExposure: true,
      });

      expect(res.periodicity).toBe("SEMESTRAL");
      expect(res.intervalMonths).toBe(6);
      expect(res.regulatoryBasis).toContain("Riscos Especiais");
    });
  });

  describe("calculateNextAsoDueDate", () => {
    it("deve somar 24 meses para Grau 2 e trabalhador de 30 anos", () => {
      const nextDate = NotificationService.calculateNextAsoDueDate("2024-05-10", {
        riskDegree: 2,
        age: 30,
      });
      expect(nextDate).toBe("2026-05-10");
    });

    it("deve somar 12 meses para Grau 4", () => {
      const nextDate = NotificationService.calculateNextAsoDueDate("2025-08-15", {
        riskDegree: 4,
        age: 30,
      });
      expect(nextDate).toBe("2026-08-15");
    });

    it("deve somar 6 meses para exposição a riscos especiais", () => {
      const nextDate = NotificationService.calculateNextAsoDueDate("2026-01-10", {
        riskDegree: 3,
        age: 30,
        hasSpecialExposure: true,
      });
      expect(nextDate).toBe("2026-07-10");
    });
  });

  describe("calculateExpirations - Janelas diferenciadas de alerta", () => {
    const refDate = new Date("2026-09-12");

    it("deve alertar com 45 dias de antecedência para Grau 4 (janela de 60 dias)", () => {
      const exams = [
        {
          id: "exam_grau4",
          name: "Audiometria e ASO Periódico",
          employeeName: "Marcos Silva",
          companyId: "comp_ind",
          validUntil: "2026-10-27", // ~45 dias
          riskDegree: 4 as const,
          employeeAge: 35,
        },
      ];

      const alerts = NotificationService.calculateExpirations(exams, refDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].riskDegree).toBe(4);
      expect(alerts[0].severity).toBe("info");
    });

    it("NÃO deve alertar com 45 dias de antecedência para Grau 1 (janela é de 30 dias)", () => {
      const exams = [
        {
          id: "exam_grau1",
          name: "Clínico Geral",
          employeeName: "Ana Souza",
          companyId: "comp_adm",
          validUntil: "2026-10-27", // ~45 dias
          riskDegree: 1 as const,
          employeeAge: 30,
        },
      ];

      const alerts = NotificationService.calculateExpirations(exams, refDate);
      expect(alerts).toHaveLength(0);
    });

    it("deve classificar como crítico quando faltarem 10 dias em Grau 3", () => {
      const exams = [
        {
          id: "exam_critico_grau3",
          name: "Raio-X Tórax OIT",
          employeeName: "Roberto Lima",
          companyId: "comp_obras",
          validUntil: "2026-09-22", // 10 dias
          riskDegree: 3 as const,
          employeeAge: 40,
        },
      ];

      const alerts = NotificationService.calculateExpirations(exams, refDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
    });

    it("deve classificar como crítico quando o exame já estiver vencido", () => {
      const exams = [
        {
          id: "exam_vencido",
          name: "ASO Periódico",
          employeeName: "Carlos Santos",
          companyId: "comp_1",
          validUntil: "2026-09-01", // Venceu há 11 dias
          riskDegree: 2 as const,
          employeeAge: 32,
        },
      ];

      const alerts = NotificationService.calculateExpirations(exams, refDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
      expect(alerts[0].title).toContain("VENCIDO");
    });
  });

  describe("WhatsApp Dispatcher & Audit", () => {
    it("deve formatar mensagem corporativa com enquadramento da NR-07", () => {
      const alert = {
        id: "alt_1",
        title: "ASO Vence em 12 dias",
        description: "Exame requerido",
        type: "aso_expiration" as const,
        severity: "critical" as const,
        employeeName: "Carlos Silva",
        companyId: "comp_1",
        dueDate: "2026-09-24",
        daysRemaining: 12,
        regulatoryBasis: 'NR-07 Item 7.5.8 alínea "b"',
      };

      const msg = NotificationService.formatWhatsAppMessage(alert, "NextCon SST");
      expect(msg).toContain("🚨 *URGENTE*");
      expect(msg).toContain("Carlos Silva");
      expect(msg).toContain("2026-09-24");
      expect(msg).toContain("Art. 168 da CLT");
      expect(msg).toContain("NR-07 Item 7.5.8");
    });

    it("deve despachar e auditar o alerta com mascaramento LGPD do número", async () => {
      const alert = {
        id: "alt_2",
        title: "ASO Vence em 5 dias",
        description: "Exame agendado",
        type: "aso_expiration" as const,
        severity: "critical" as const,
        employeeName: "João Silva",
        companyId: "comp_1",
        dueDate: "2026-09-17",
        daysRemaining: 5,
      };

      const result = await NotificationService.sendWhatsAppAlert(alert, "11987654321");
      expect(result.success).toBe(true);
      expect(result.messageId).toContain("msg_");
      expect(result.status).toBe("QUEUED");
      expect(result.maskedPhone).toContain("***");
    });
  });
});
