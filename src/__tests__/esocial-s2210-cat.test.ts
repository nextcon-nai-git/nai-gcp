import { describe, it, expect } from "vitest";
import {
  EsocialXmlBuilder,
  type S2210Payload,
  type S2240Payload,
} from "@/services/esocial/xml-builder";
import { EsocialXmlService } from "@/services/esocial/xml-generator";
describe("eventos sem leiaute homologado falham de forma explícita", () => {
  it("não fabrica CPF, médico, CRM, CID, endereço ou dias de afastamento para CAT incompleta", () => {
    expect(() => EsocialXmlService.generateS2210({ description: "Relato sintético" })).toThrow(
      "Nenhum XML foi emitido"
    );
  });
  it("não permite contornar bloqueio do S-2210 pelo construtor legado", () => {
    expect(() => EsocialXmlBuilder.buildS2210({} as S2210Payload)).toThrow("S-2210 indisponível");
  });
  it("não permite contornar bloqueio do S-2240 pelo construtor legado", () => {
    expect(() => EsocialXmlBuilder.buildS2240({} as S2240Payload)).toThrow("S-2240 indisponível");
  });
});
