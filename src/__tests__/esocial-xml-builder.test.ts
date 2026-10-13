import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EsocialXmlBuilder, escapeXml } from "@/services/esocial/xml-builder";
const payload = JSON.parse(
  readFileSync("tests/fixtures/esocial/s2220-reviewed-input.json", "utf8")
);

describe("eSocial S-2220 — conteúdo revisado, rascunho sem assinatura", () => {
  it("escapa caracteres especiais", () => {
    expect(escapeXml("Empresa & Filhos <Ltda>")).toBe("Empresa &amp; Filhos &lt;Ltda&gt;");
  });
  it("reproduz a fixture validada com o XSD oficial S-1.3", () => {
    const generated = EsocialXmlBuilder.buildS2220(payload);
    expect(generated).toBe(readFileSync("tests/fixtures/esocial/s2220-unsigned.xml", "utf8"));
    expect(generated).toContain("evtMonit/v_S_01_03_00");
    expect(generated).not.toContain("Signature");
  });
  it("preserva hierarquia e exames irmãos em vez de aninhados", () => {
    const document = new DOMParser().parseFromString(
      EsocialXmlBuilder.buildS2220(payload),
      "application/xml"
    );
    expect(document.querySelector("parsererror")).toBeNull();
    expect(document.querySelectorAll("exMedOcup > aso > exame")).toHaveLength(2);
    expect(document.querySelector("exame exame")).toBeNull();
    expect(document.querySelector("ideVinculo > matricula")?.textContent).toBe("SYNTHETIC-001");
    expect(document.querySelector("exMedOcup > tpExameOcup")?.textContent).toBe("1");
    expect(document.querySelector("tpAmb")?.textContent).toBe("2");
  });
  it("recusa assinatura indisponível em vez de devolver XML inalterado", async () => {
    await expect(
      EsocialXmlBuilder.signEvent("<unsigned/>", "synthetic-certificate")
    ).rejects.toThrow("Nenhum evento foi assinado ou transmitido");
  });
});
