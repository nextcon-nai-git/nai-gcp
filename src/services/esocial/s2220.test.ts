import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildS2220Xml } from "./s2220";
const input = () =>
  JSON.parse(readFileSync("tests/fixtures/esocial/s2220-reviewed-input.json", "utf8"));
describe("validação dos dados S-2220", () => {
  it.each([
    (d: any) => {
      delete d.id;
    },
    (d: any) => {
      d.id = 'ID1"/><forged/>';
    },
    (d: any) => {
      d.aso.exames = [];
    },
    (d: any) => {
      d.aso.dtAso = "2026-02-30";
    },
    (d: any) => {
      d.aso.dtAso = "2099-01-01";
    },
    (d: any) => {
      d.aso.exames[0].dtExm = "2026-10-11";
    },
    (d: any) => {
      d.aso.exames[1].obsProc = undefined;
    },
    (d: any) => {
      d.aso.exames[0].procRealizado = "0281";
    },
    (d: any) => {
      d.aso.medico.nmMed = "";
    },
    (d: any) => {
      d.ideEmpregador.tpInsc = 2;
    },
    (d: any) => {
      d.ideTrabalhador.codCateg = 101;
    },
    (d: any) => {
      delete d.ideTrabalhador.matricula;
    },
  ])("recusa dados ausentes/inválidos sem gerar arquivo", (mutate) => {
    const data = input();
    mutate(data);
    expect(() => buildS2220Xml(data)).toThrow("incompletos ou inválidos");
  });
  it("omite resultado de aptidão não informado", () => {
    const data = input();
    delete data.aso.resAso;
    expect(buildS2220Xml(data)).not.toContain("resAso");
  });
  it("aceita TSVE sem matrícula quando categoria foi informada explicitamente", () => {
    const data = input();
    delete data.ideTrabalhador.matricula;
    data.ideTrabalhador.codCateg = 701;
    expect(buildS2220Xml(data)).toContain("<codCateg>701</codCateg>");
  });
  it("aceita CNPJ alfanumérico normalizado", () => {
    const data = input();
    data.ideEmpregador.nrInsc = "AB.CDE.FGH/IJKL-12";
    data.id = "ID1ABCDEFGHIJKL122026101212345600001";
    expect(buildS2220Xml(data)).toContain("<nrInsc>ABCDEFGHIJKL12</nrInsc>");
  });
});
