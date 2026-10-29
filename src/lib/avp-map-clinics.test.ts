import { describe, expect, it } from "vitest";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
import { aggregateAvpLocalities } from "./avp-geo-data";
import { buildAvpKml } from "./avp-kml-export";
import { AVP_MAP_CLINIC_HEADERS, readAvpMapClinics, avpMapClinicCost } from "./avp-map-clinics";

const row = [
  "clinic-test",
  "Salvador",
  "BA",
  "Clínica de teste",
  "",
  "R$ 70,00",
  "Contraproposta",
  "Pagamento a confirmar",
  "Fonte de teste",
  "2026-10-29",
];
const parse = (rows: unknown[][]) => readAvpMapClinics([[...AVP_MAP_CLINIC_HEADERS], ...rows]);

describe("clínicas atuais no mapa AVP", () => {
  it("preserva condições e não transforma preço desconhecido ou zero em acordo gratuito", () => {
    const clinic = parse([row])[0];
    expect(clinic).toMatchObject({ cents: 7000, status: "Contraproposta" });
    for (const price of ["", "0", "R$ 30 ou 40", "-1"]) {
      expect(parse([[...row.slice(0, 5), price, ...row.slice(6)]])[0].cents).toBeNull();
    }
  });
  it("rejeita cabeçalho incorreto e identidade duplicada", () => {
    expect(() => readAvpMapClinics([row])).toThrow();
    expect(() => parse([row, row])).toThrow();
  });
  it("inclui cidades da rede sem inventar solicitações de ASO", () => {
    const clinics = parse([row]);
    const places = aggregateAvpLocalities([], clinics);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ cidade: "Salvador", totalAsos: 0, geoKnown: true });
    expect(places[0].asos).toEqual([]);
    const withQueue = aggregateAvpLocalities(AVP_TEST_ASOS, clinics);
    expect(withQueue.reduce((total, place) => total + place.totalAsos, 0)).toBe(
      AVP_TEST_ASOS.length
    );
  });
  it("mantém o maior preço atual visível sem apagar custos históricos", () => {
    const clinics = parse([row]);
    expect(avpMapClinicCost(clinics)).toBe(7000);
    expect(avpMapClinicCost([{ ...clinics[0], cents: null }])).toBeNull();
    const asos = [{ ...AVP_TEST_ASOS[0], cidade: "Salvador", uf: "BA", valorAso: "90" }];
    const kml = buildAvpKml(asos, new Date("2026-10-29T12:00:00Z"), clinics);
    expect(kml).toContain("<styleUrl>#red</styleUrl>");
    expect(kml).toContain("Contraproposta");
    expect(kml).toContain("Pagamento a confirmar");
    expect(asos[0].valorAso).toBe("90");
  });
  it.each([
    ["39,99", "green"],
    ["40", "yellow"],
    ["49,99", "yellow"],
    ["50", "red"],
    ["70", "red"],
    ["70,01", "purple"],
  ])("usa as mesmas faixas no KML para %s", (price, color) => {
    const clinics = parse([[...row.slice(0, 5), price, ...row.slice(6)]]);
    const kml = buildAvpKml([], new Date("2026-10-29T12:00:00Z"), clinics);
    expect(kml).toContain(`<styleUrl>#${color}</styleUrl>`);
    expect(kml).toContain("Clínica de teste");
  });
});
