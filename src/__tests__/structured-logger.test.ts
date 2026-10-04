import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { maskCpf, maskPhone, maskPatientName, sanitizeLogData, logger } from "@/lib/logger";

describe("NAI - Enterprise Structured Logger & LGPD/CFM Data Sanitizer", () => {
  describe("Funções de Mascaramento de PII / PHI", () => {
    it("deve mascarar CPF mantendo apenas os dois dígitos finais", () => {
      expect(maskCpf("123.456.789-00")).toBe("***.***.***-00");
      expect(maskCpf("12345678900")).toBe("***.***.***-00");
      expect(maskCpf("invalid")).toBe("***.***.***-**");
    });

    it("deve mascarar telefone preservando apenas os últimos 4 dígitos", () => {
      expect(maskPhone("85999887766")).toBe("(**) *****-7766");
      expect(maskPhone("(11) 98765-4321")).toBe("(**) *****-4321");
      expect(maskPhone("123")).toBe("(**) *****-****");
    });

    it("deve abreviar nomes de pacientes para conformidade LGPD/CFM", () => {
      expect(maskPatientName("Carlos Eduardo Silva")).toBe("Carlos E. S.");
      expect(maskPatientName("Maria Santos")).toBe("Maria S.");
      expect(maskPatientName("João")).toBe("J.");
      expect(maskPatientName("")).toBe("Anônimo");
    });
  });

  describe("sanitizeLogData - Remoção de Segredos e PII", () => {
    it("deve redigir chaves com senhas, segredos e tokens", () => {
      const sensitiveObj = {
        companyId: "COMP_123",
        userPassword: "supersecret123",
        appSecret: "sec_xyz_890",
        senior_app_secret: "key_999",
        safeData: "dados publicos",
      };

      const sanitized = sanitizeLogData(sensitiveObj) as Record<string, unknown>;
      expect(sanitized.companyId).toBe("COMP_123");
      expect(sanitized.userPassword).toBe("[REDACTED]");
      expect(sanitized.appSecret).toBe("[REDACTED]");
      expect(sanitized.senior_app_secret).toBe("[REDACTED]");
      expect(sanitized.safeData).toBe("dados publicos");
    });

    it("deve mascarar CPFs encontrados dentro de textos de log", () => {
      const text = "Colaborador com CPF 123.456.789-00 agendou exame ASO";
      const sanitized = sanitizeLogData(text) as string;
      expect(sanitized).toBe("Colaborador com CPF ***.***.***-00 agendou exame ASO");
    });
  });

  describe("Emissão de Logs Estruturados", () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("logger.info deve emitir log estruturado com prefixo", () => {
      logger.info("Teste operacional", { module: "SST" });
      expect(consoleSpy).toHaveBeenCalled();
      const firstArg = consoleSpy.mock.calls[0][0];
      expect(JSON.parse(firstArg)).toMatchObject({
        severity: "INFO",
        message: "Teste operacional",
        module: "SST",
      });
    });

    it("logger.audit deve registrar evento com tag de auditoria", () => {
      logger.audit("ACCESS_PHI", "Acesso ao prontuário médico", { userId: "USR_1" });
      expect(consoleSpy).toHaveBeenCalled();
      const firstArg = consoleSpy.mock.calls[0][0];
      expect(JSON.parse(firstArg)).toMatchObject({ action: "ACCESS_PHI", audit: true });
    });
  });
});
