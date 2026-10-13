import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EsocialXmlService } from "@/services/esocial/xml-generator";
const fixture = JSON.parse(
  readFileSync("tests/fixtures/esocial/s2220-reviewed-input.json", "utf8")
);
const flat = {
  id: fixture.id,
  cnpjEmpregador: fixture.ideEmpregador.nrInsc,
  cpfTrabalhador: fixture.ideTrabalhador.cpfTrab,
  matricula: fixture.ideTrabalhador.matricula,
  dataAso: fixture.aso.dtAso,
  tipoAso: "1",
  resultadoAso: "1",
  exames: fixture.aso.exames,
  medicoNome: "Profissional & Sintético <Revisão>",
  medicoCrm: "12345",
  medicoUf: "PR",
};
describe("adaptação S-2220 sem inferência clínica", () => {
  it("aceita dados explícitos do formato anterior com XML escapado", () => {
    const xml = EsocialXmlService.generateS2220(flat);
    expect(xml).toContain("Profissional &amp; Sintético &lt;Revisão&gt;");
    expect(xml).toContain("<nrInsc>12345678000190</nrInsc>");
  });
  it.each([null, undefined, "", "desconhecido"])(
    "não transforma tipo ausente %j em ASO admissional",
    (tipoAso) => {
      expect(() => EsocialXmlService.generateS2220({ ...flat, tipoAso })).toThrow();
    }
  );
  it("não inventa exame clínico quando a lista não foi informada", () => {
    expect(() => EsocialXmlService.generateS2220({ ...flat, exames: undefined })).toThrow();
  });
  it.each(["S2210", "S2240"] as const)("bloqueia %s até adequação do leiaute", (event) => {
    expect(() =>
      EsocialXmlService[event === "S2210" ? "generateS2210" : "generateS2240"]({})
    ).toThrow("leiaute vigente");
  });
});
