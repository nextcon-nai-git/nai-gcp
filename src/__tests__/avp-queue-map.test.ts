import { describe, it, expect } from "vitest";
import { AVP_TEST_ASOS as GRUPO_AVP_ASO_LIST } from "./avp-test-fixture";
import {
  aggregateAvpLocalities,
  AVP_CITY_COORDINATES,
  ASO_STATUS_CONFIG,
  projectLatLng,
} from "@/lib/avp-geo-data";

describe("NAI - Mapeamento Geográfico da Fila do Grupo AVP", () => {
  it("deve carregar a fila sintética de teste", () => {
    expect(GRUPO_AVP_ASO_LIST.length).toBeGreaterThan(100);
  });

  it("deve agregar os ASOs em municípios únicos e calcular os totais corretamente", () => {
    const aggregates = aggregateAvpLocalities(GRUPO_AVP_ASO_LIST);
    expect(aggregates.length).toBeGreaterThanOrEqual(100);

    const sumTotalAsos = aggregates.reduce((acc, curr) => acc + curr.totalAsos, 0);
    expect(sumTotalAsos).toBe(GRUPO_AVP_ASO_LIST.length);
  });

  it("Fortaleza deve ser o município com maior número de solicitações (18 ASOs)", () => {
    const aggregates = aggregateAvpLocalities(GRUPO_AVP_ASO_LIST);
    const topCity = aggregates[0];
    expect(topCity.cidade).toBe("Fortaleza");
    expect(topCity.uf).toBe("CE");
    expect(topCity.totalAsos).toBe(18);
  });

  it("deve projetar coordenadas geográficas válidas dentro do viewBox SVG (800x800)", () => {
    const coords = Object.values(AVP_CITY_COORDINATES);
    expect(coords.length).toBeGreaterThanOrEqual(100);

    coords.forEach((c) => {
      expect(c.lat).toBeGreaterThanOrEqual(-34.5);
      expect(c.lat).toBeLessThanOrEqual(6.0);
      expect(c.lng).toBeGreaterThanOrEqual(-74.5);
      expect(c.lng).toBeLessThanOrEqual(-34.0);

      // Coordenadas projetadas
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(800);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(800);
    });
  });

  it("deve priorizar status URGENTE quando o município tiver pelo menos um caso urgente", () => {
    const aggregates = aggregateAvpLocalities(GRUPO_AVP_ASO_LIST);
    const alfenas = aggregates.find((a) => a.cidade === "Alfenas" && a.uf === "MG");
    expect(alfenas).toBeDefined();
    if (alfenas) {
      expect(alfenas.hasUrgente).toBe(true);
      expect(alfenas.primaryStatus).toBe("URGENTE");
      expect(alfenas.primaryColor).toBe(ASO_STATUS_CONFIG["URGENTE"].color);
    }
  });

  it("deve cobrir as 5 macro-regiões brasileiras", () => {
    const aggregates = aggregateAvpLocalities(GRUPO_AVP_ASO_LIST);
    const regions = new Set(aggregates.map((a) => a.region));
    expect(regions.has("Nordeste")).toBe(true);
    expect(regions.has("Sudeste")).toBe(true);
    expect(regions.has("Norte")).toBe(true);
    expect(regions.has("Sul")).toBe(true);
    expect(regions.has("Centro-Oeste")).toBe(true);
  });

  it("deve ter configurações visuais de cor para todos os status cadastrados", () => {
    const statusKeys = [
      "AGENDADO",
      "NÃO INICIADO",
      "URGENTE",
      "EXAME FEITO",
      "2 VIA ASO",
      "CADASTRANDO NO SOC",
      "REAGENDAMENTO",
      "AG. RETORNO CLINICA",
      "ENVIAR COMPROV. PAG",
      "GESTOR CANCELOU",
      "DESISTIU DA VAGA",
    ];

    statusKeys.forEach((key) => {
      const cfg = ASO_STATUS_CONFIG[key];
      expect(cfg).toBeDefined();
      expect(cfg.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cfg.label).toBeTruthy();
    });
  });
});
