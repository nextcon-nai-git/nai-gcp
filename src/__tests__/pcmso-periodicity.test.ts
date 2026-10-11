import { describe, it, expect } from "vitest";
import { NotificationService } from "@/services/notification-service";

describe("NotificationService - Periodicidade NR-07 e Alertas PCMSO", () => {
  describe("periodicidade clínica baseada no PCMSO", () => {
    it("não calcula prazo a partir de idade ou grau isolados", () => {
      for (const params of [
        { age: 17, riskDegree: 2 as const },
        { age: 46, riskDegree: 4 as const },
        { hasSpecialExposure: true },
      ]) {
        expect(NotificationService.determinePeriodicity(params).intervalMonths).toBeNull();
        expect(NotificationService.calculateNextAsoDueDate("2026-01-01", params)).toBe("");
      }
    });
    it("aplica prazo bienal apenas com enquadramento conferido", () => {
      const params = {
        pcmsoReviewed: true,
        hasPgrExposure: false,
        chronicSusceptibility: false,
        age: 50,
      };
      expect(NotificationService.determinePeriodicity(params).intervalMonths).toBe(24);
      expect(NotificationService.calculateNextAsoDueDate("2024-05-10", params)).toBe("2026-05-10");
    });
    it("aplica anual para exposição confirmada sem depender da idade", () => {
      const params = { pcmsoReviewed: true, hasPgrExposure: true, chronicSusceptibility: false };
      expect(NotificationService.determinePeriodicity(params).intervalMonths).toBe(12);
      expect(NotificationService.calculateNextAsoDueDate("2024-02-29", params)).toBe("2025-02-28");
    });
    it("respeita intervalo menor definido pelo médico e limita fim de mês", () => {
      const params = {
        pcmsoReviewed: true,
        hasPgrExposure: true,
        chronicSusceptibility: false,
        physicianIntervalMonths: 6,
      };
      expect(NotificationService.calculateNextAsoDueDate("2026-08-31", params)).toBe("2027-02-28");
      expect(
        NotificationService.determinePeriodicity({ ...params, physicianIntervalMonths: 18 })
          .intervalMonths
      ).toBeNull();
    });
    it("exige prazo específico para condições hiperbáricas", () => {
      expect(
        NotificationService.determinePeriodicity({
          pcmsoReviewed: true,
          hasPgrExposure: true,
          chronicSusceptibility: false,
          hyperbaricExposure: true,
        }).intervalMonths
      ).toBeNull();
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

    it("não declara enfileiramento quando não existe canal configurado", async () => {
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
      expect(result.success).toBe(false);
      expect(result.messageId).toContain("msg_");
      expect(result.status).toBe("FAILED");
      expect(result.maskedPhone).toContain("***");
    });
  });
});
