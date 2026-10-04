import { describe, it, expect } from "vitest";
import {
  BRAZIL_STATE_VIEWBOXES,
  getStateViewBox,
  getCityViewBox,
  BRAZIL_STATES_PATHS,
} from "@/lib/brazil-states-paths";
import { aggregateAvpLocalities, AVP_CITY_COORDINATES } from "@/lib/avp-geo-data";
import { AVP_TEST_ASOS as GRUPO_AVP_ASO_LIST } from "./avp-test-fixture";

describe("NAI - Sistema de Zoom em Nível de Estado e Cidades do Mapa AVP", () => {
  it("deve conter bounding boxes oficiais para todos os 27 estados (26 UFs + DF)", () => {
    const states = Object.keys(BRAZIL_STATE_VIEWBOXES);
    expect(states.length).toBe(27);

    // Valida que todos os estados de BRAZIL_STATES_PATHS têm viewBox
    Object.keys(BRAZIL_STATES_PATHS).forEach((sigla) => {
      expect(BRAZIL_STATE_VIEWBOXES[sigla]).toBeDefined();
      const vb = BRAZIL_STATE_VIEWBOXES[sigla];
      expect(vb.w).toBeGreaterThan(20);
      expect(vb.h).toBeGreaterThan(20);
      expect(vb.x).toBeGreaterThanOrEqual(0);
      expect(vb.y).toBeGreaterThanOrEqual(0);
      expect(vb.x + vb.w).toBeLessThanOrEqual(800.1);
      expect(vb.y + vb.h).toBeLessThanOrEqual(800.1);
    });
  });

  it("getStateViewBox deve retornar dados válidos para estados-chave", () => {
    const ce = getStateViewBox("CE");
    expect(ce).not.toBeNull();
    if (ce) {
      expect(ce.viewBox).toBe("632.7 161.9 123.8 123.8");
      // As coordenadas de Fortaleza (x: 662.6, y: 268.0) devem estar dentro da caixa do Ceará
      expect(662.6).toBeGreaterThanOrEqual(ce.x);
      expect(662.6).toBeLessThanOrEqual(ce.x + ce.w);
      expect(268.0).toBeGreaterThanOrEqual(ce.y);
      expect(268.0).toBeLessThanOrEqual(ce.y + ce.h);
    }

    const sp = getStateViewBox("SP");
    expect(sp).not.toBeNull();
    if (sp) {
      expect(sp.w).toBeGreaterThan(100);
      expect(sp.h).toBeGreaterThan(100);
    }
  });

  it("getCityViewBox deve gerar uma caixa quadrada de alta definição centralizada na cidade", () => {
    const coords = AVP_CITY_COORDINATES["Fortaleza-CE"];
    expect(coords).toBeDefined();

    const cityVb = getCityViewBox(coords.x, coords.y, 90);
    expect(cityVb.w).toBe(90);
    expect(cityVb.h).toBe(90);
    expect(cityVb.x).toBeGreaterThanOrEqual(0);
    expect(cityVb.y).toBeGreaterThanOrEqual(0);
    expect(cityVb.x + cityVb.w).toBeLessThanOrEqual(800);
    expect(cityVb.y + cityVb.h).toBeLessThanOrEqual(800);
    expect(cityVb.viewBox).toContain("90 90");
  });

  it("todas as 101 localidades de ASOs devem gerar zoom de cidade dentro do canvas 800x800", () => {
    const aggregates = aggregateAvpLocalities(GRUPO_AVP_ASO_LIST);
    expect(aggregates.length).toBeGreaterThanOrEqual(100);

    aggregates.forEach((loc) => {
      const vb = getCityViewBox(loc.x, loc.y, 95);
      expect(vb.x).toBeGreaterThanOrEqual(0);
      expect(vb.y).toBeGreaterThanOrEqual(0);
      expect(vb.x + vb.w).toBeLessThanOrEqual(800.1);
      expect(vb.y + vb.h).toBeLessThanOrEqual(800.1);
    });
  });
});
