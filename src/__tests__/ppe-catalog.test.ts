import { describe, it, expect } from "vitest";
import { PpeCatalogService, INITIAL_PPE_CATALOG } from "@/services/ppe/ppe-catalog-service";

describe("PpeCatalogService - Conformidade NR-06 & Gestão de C.A.", () => {
  it("deve avaliar corretamente o status do C.A. do MTE", () => {
    const today = new Date("2026-09-12");

    // Validade distante
    expect(PpeCatalogService.checkCaStatus("2027-12-31", false, today)).toBe("VALIDO");

    // Vencendo nos próximos 30 dias (ex: 20 dias restantes)
    expect(PpeCatalogService.checkCaStatus("2026-09-30", false, today)).toBe("VENCENDO_30D");

    // Já vencido
    expect(PpeCatalogService.checkCaStatus("2026-08-01", false, today)).toBe("VENCIDO");

    // Cancelado pelo MTE
    expect(PpeCatalogService.checkCaStatus("2028-01-01", true, today)).toBe("CANCELADO");
  });

  it("deve recomendar EPIs adequados para o cargo solicitado", () => {
    const soldadorPpe = PpeCatalogService.getRecommendedPpeByRole("Soldador");
    const ppeNames = soldadorPpe.map((p) => p.name);

    expect(ppeNames.some((name) => name.includes("Óculos"))).toBe(true);
    expect(ppeNames.some((name) => name.includes("Respirador"))).toBe(true);

    const eletricistaPpe = PpeCatalogService.getRecommendedPpeByRole("Eletricista");
    const eletricistaNames = eletricistaPpe.map((p) => p.name);
    expect(eletricistaNames.some((name) => name.includes("Capacete"))).toBe(true);
    expect(eletricistaNames.some((name) => name.includes("Botina"))).toBe(true);
  });

  it("deve rejeitar entrega de EPI com C.A. vencido conforme NR-06", () => {
    const invalidDelivery = {
      employeeName: "João da Silva",
      cpfMatricula: "123.456.789-00",
      caNumber: "99999",
      caExpirationDate: "2025-01-01", // Vencido
      termAccepted: true,
    };

    const result = PpeCatalogService.validateDeliveryCompliance(invalidDelivery);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("VENCIDO"))).toBe(true);
  });

  it("deve exigir aceitação do termo de guarda e conservação (NR-06 item 6.6.1)", () => {
    const missingTermDelivery = {
      employeeName: "João da Silva",
      cpfMatricula: "123.456.789-00",
      caNumber: "45678",
      caExpirationDate: "2028-11-20",
      termAccepted: false, // Não aceitou o termo
    };

    const result = PpeCatalogService.validateDeliveryCompliance(missingTermDelivery);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Termo de Guarda"))).toBe(true);
  });

  it("deve aprovar entrega conforme e gerar hash de assinatura digital SHA-256", () => {
    const validDelivery = {
      employeeName: "João da Silva",
      cpfMatricula: "123.456.789-00",
      caNumber: "45678",
      caExpirationDate: "2028-11-20",
      termAccepted: true,
    };

    const compliance = PpeCatalogService.validateDeliveryCompliance(validDelivery);
    expect(compliance.valid).toBe(true);
    expect(compliance.issues.length).toBe(0);

    const hash = PpeCatalogService.generateDigitalSignatureHash({
      companyId: "comp_123",
      employeeCpf: "123.456.789-00",
      ppeName: "Capacete Classe B",
      caNumber: "45678",
      deliveryDate: "2026-09-12",
      quantity: 1,
      timestamp: "2026-09-12T10:00:00Z",
    });

    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe("string");
  });

  it("deve computar sumário de alertas de C.A. do catálogo", () => {
    const stats = PpeCatalogService.calculatePpeAlerts(INITIAL_PPE_CATALOG);
    expect(stats.total).toBe(INITIAL_PPE_CATALOG.length);
    expect(stats.valid).toBeGreaterThan(0);
    expect(stats.expiringSoon).toBeGreaterThanOrEqual(1); // ppe_respirador_pff2 vence em out/2026
  });
});
