import { describe, expect, it } from "vitest";
import {
  ESOCIAL_EVENT_FORMS,
  ESOCIAL_EVENT_TYPES,
  EsocialEventInputSchema,
  createEsocialEventDefaults,
  isValidEsocialRegistration,
} from "./esocial-events";
import { esocialTableOptions, isEsocialTableCode, ESOCIAL_TP_ASO } from "./esocial-codes";
import { currentEventFixture } from "../../tests/fixtures/esocial/current-events";
const accepts = (type: string, mutate: (input: any) => void) => {
  const input = currentEventFixture(type);
  mutate(input);
  return EsocialEventInputSchema.safeParse(input).success;
};

describe("dados revisados de eventos, regras locais e catálogo oficial", () => {
  it("possui formulário de todos os eventos com seções próprias, sem fabricar conteúdo clínico", () => {
    for (const type of ESOCIAL_EVENT_TYPES) {
      expect(ESOCIAL_EVENT_FORMS[type].sections.length).toBeGreaterThanOrEqual(2);
      expect(EsocialEventInputSchema.safeParse(createEsocialEventDefaults(type)).success).toBe(
        false
      );
    }
    expect(ESOCIAL_TP_ASO.map((v) => v.value)).toEqual([0, 1, 2, 3, 4, 9]);
    expect(
      ESOCIAL_EVENT_FORMS.S2221.sections
        .flatMap((s) => s.fields)
        .some((f) => f.name === "ideVinculo.codCateg")
    ).toBe(false);
    expect(
      ESOCIAL_EVENT_FORMS.S3000.sections
        .flatMap((s) => s.fields)
        .some((f) => f.name === "ideEvento.indRetif")
    ).toBe(false);
  });
  it("verifica CPF/CNPJ e dígitos alfa; base8 exige amarração externa ao S-1000", () => {
    expect(isValidEsocialRegistration(1, "12.ABC.345/01DE-35")).toBe(true);
    expect(isValidEsocialRegistration(1, "12ABC34501DE34")).toBe(false);
    expect(isValidEsocialRegistration(1, "12345678000190")).toBe(false);
    expect(isValidEsocialRegistration(2, "123.456.789-09")).toBe(true);
    expect(isValidEsocialRegistration(2, "00000000000")).toBe(false);
    expect(isValidEsocialRegistration(1, "12ABC345")).toBe(true);
    expect(isValidEsocialRegistration(1, "12ABC345<script>")).toBe(false);
  });
  it("códigos são oficiais e motivos do pacote futuro não entram em outubro", () => {
    expect(isEsocialTableCode("27", "0295")).toBe(true);
    expect(isEsocialTableCode("27", "8888")).toBe(false);
    expect(isEsocialTableCode("24", "09.01.001")).toBe(true);
    expect(isEsocialTableCode("24", "09.99.999")).toBe(false);
    expect(esocialTableOptions("18").some((v) => ["44", "45"].includes(v.value))).toBe(true);
    expect(esocialTableOptions("18").some((v) => Number(v.value) >= 46)).toBe(false);
  });
  it.each([
    [
      "S2220",
      (d: any) => {
        d.aso.exames[0].procRealizado = "8888";
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.aso.exames[0].procRealizado = "0281";
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.aso.exames[0].indResult = 2;
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.aso.medico.nrCrm = undefined;
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.context = { pcmsoCoordinatorExists: true };
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.aso.dtAso = "2026-02-30";
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.ideVinculo.codCateg = 701;
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.ideEvento.indRetif = 2;
      },
    ],
    [
      "S2220",
      (d: any) => {
        d.ideEvento.nrRecibo = "1.1.0000000000000000001";
      },
    ],
    [
      "S2210",
      (d: any) => {
        delete d.cat.atestado;
      },
    ],
    [
      "S2210",
      (d: any) => {
        d.cat.tpCat = 3;
      },
    ],
    [
      "S2210",
      (d: any) => {
        d.cat.atestado.codCID = "Z";
      },
    ],
    [
      "S2210",
      (d: any) => {
        d.cat.localAcidente.tpLocal = 2;
      },
    ],
    [
      "S2240",
      (d: any) => {
        d.infoExpRisco.agNoc.push({ codAgNoc: "01.01.001" });
      },
    ],
    [
      "S2240",
      (d: any) => {
        d.infoExpRisco.agNoc[0].tpAval = 1;
      },
    ],
    [
      "S2240",
      (d: any) => {
        d.infoExpRisco.infoAmb[0].nrInsc = "12345678000190";
      },
    ],
    [
      "S2221",
      (d: any) => {
        d.toxicologico.cnpjLab = "12345678000190";
      },
    ],
    [
      "S2221",
      (d: any) => {
        delete d.ideVinculo.matricula;
        d.ideVinculo.codCateg = 701;
      },
    ],
    [
      "S2230",
      (d: any) => {
        d.infoAfastamento = {};
      },
    ],
    [
      "S2230",
      (d: any) => {
        d.infoAfastamento.iniAfastamento.codMotAfast = "46";
      },
    ],
    [
      "S2230",
      (d: any) => {
        d.infoAfastamento.iniAfastamento.codMotAfast = "14";
      },
    ],
    [
      "S3000",
      (d: any) => {
        d.ideEvento.indRetif = 2;
      },
    ],
    [
      "S3000",
      (d: any) => {
        d.infoExclusao.tpEvento = "S-1000";
      },
    ],
  ] as const)("recusa dado inconsistente %s, caso %#", (type, mutate) =>
    expect(accepts(type, mutate)).toBe(false)
  );
  it("exceções explícitas preservam autonomia do responsável e não pressupõem RET", () => {
    expect(
      accepts("S2220", (d) => {
        d.aso.exames[0].indResult = 1;
        d.aso.resultDisclosureAuthorized = true;
      })
    ).toBe(true);
    expect(
      accepts("S2220", (d) => {
        delete d.aso.medico.nrCrm;
        delete d.aso.medico.ufCrm;
        d.context = { workerAbroad: true };
      })
    ).toBe(true);
    expect(
      accepts("S2230", (d) => {
        delete d.infoAfastamento.iniAfastamento;
      })
    ).toBe(true);
  });
});
