// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ESOCIAL_EVENT_TYPES, EsocialEventInputSchema } from "@/lib/esocial-events";
import type { AsoFlowCard } from "@/lib/aso-flow";
import { currentEventFixture } from "../../../tests/fixtures/esocial/current-events";
import {
  assertSafeEsocialXml,
  buildEsocialEventXml,
  createEsocialEventId,
  createS2220DraftFromReviewedAso,
  generateEsocialEvent,
  validateEsocialXml,
} from "./events";
import { buildS2220Xml } from "./s2220";
const NOW = new Date("2026-11-01T12:00:00Z");
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());
const generate = (type: string) =>
  generateEsocialEvent(currentEventFixture(type), { now: NOW, sequence: 1 });
const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><DigestValue>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</DigestValue></Reference></SignedInfo><SignatureValue>AQID</SignatureValue><KeyInfo><X509Data><X509Certificate>AQID</X509Certificate></X509Data></KeyInfo></Signature>`;

describe("geradores atuais e XSDs oficiais S-1.3 / 26-10-2026", () => {
  it.each(ESOCIAL_EVENT_TYPES)(
    "gera %s original validado pelo libxml2 real e mantém ausência de aceite/assinatura",
    async (type) => {
      const result = await generate(type);
      expect(result).toMatchObject({
        eventType: type,
        environment: "restricted",
        employer: { type: "1", number: "12345678" },
        layout: "S-1.3-20261026",
        xsdValidated: true,
        signed: false,
        businessValidation: "NOT_EVALUATED",
      });
      expect(result.eventId).toBe("ID1123456780000002026110109000000001");
      expect(result.xml).not.toContain("Signature");
      expect(result.worker).toEqual(
        type === "S3000" ? null : { cpf: "12345678909", matricula: "SYNTHETIC-001" }
      );
      expect(
        (await validateEsocialXml(result.xml, { allowUnsigned: true })).payload?.eventType
      ).toBe(type);
    }
  );
  it.each(ESOCIAL_EVENT_TYPES.filter((type) => type !== "S3000"))(
    "gera %s retificador com recibo completo e valida o XSD",
    async (type) => {
      const input = currentEventFixture(type);
      input.ideEvento.indRetif = 2;
      input.ideEvento.nrRecibo = "1.1.0000000000000000001";
      const result = await generateEsocialEvent(input, { now: NOW, sequence: 2 });
      expect(result.xml).toContain(
        "<indRetif>2</indRetif>\n      <nrRecibo>1.1.0000000000000000001</nrRecibo>"
      );
    }
  );
  it("serializa exposição quantitativa, EPI e responsáveis em grupos oficiais", async () => {
    const input = currentEventFixture("S2240");
    input.infoExpRisco.agNoc = [
      {
        codAgNoc: "02.01.001",
        tpAval: 1,
        intConc: "86.5",
        unMed: 4,
        tecMedicao: "Técnica sintética",
        epcEpi: {
          utilizEPC: 1,
          utilizEPI: 2,
          eficEpi: "S",
          epi: [{ docAval: "CA sintético" }],
          epiCompl: {
            medProtecao: "S",
            condFuncto: "S",
            usoInint: "S",
            przValid: "S",
            periodicTroca: "S",
            higienizacao: "S",
          },
        },
      },
    ];
    input.infoExpRisco.respReg = [{ cpfResp: "12345678909", ideOC: 4, nrOC: "12345", ufOC: "PR" }];
    const result = await generateEsocialEvent(input);
    expect(result.xml).toContain("<epiCompl>");
    expect(result.xml).toContain("<intConc>86.5</intConc>");
    expect(result.xsdValidated).toBe(true);
  });
  it("serializa CAT de reabertura e cessão com grupos condicionais", async () => {
    const cat = currentEventFixture("S2210");
    cat.cat.tpCat = 2;
    cat.cat.catOrigem = { nrRecCatOrig: "1.1.0000000000000000001" };
    expect((await generateEsocialEvent(cat)).xml).toContain("<catOrigem>");
    const leave = currentEventFixture("S2230");
    leave.infoAfastamento.iniAfastamento.codMotAfast = "14";
    leave.infoAfastamento.iniAfastamento.dtIniAfast = "2021-07-17";
    leave.infoAfastamento.fimAfastamento.dtTermAfast = "2021-07-18";
    delete leave.infoAfastamento.iniAfastamento.infoMesmoMtv;
    leave.infoAfastamento.iniAfastamento.infoCessao = { cnpjCess: "12345678000195", infOnus: 2 };
    expect((await generateEsocialEvent(leave)).xml).toContain("<infoCessao>");
  });
  it("recusa retificação XML sem recibo mesmo quando o XSD permite o elemento ausente", async () => {
    const { xml } = await generate("S2220");
    await expect(
      validateEsocialXml(xml.replace("<indRetif>1</indRetif>", "<indRetif>2</indRetif>"), {
        allowUnsigned: true,
      })
    ).rejects.toThrow("recibo");
  });
  it("XSD real rejeita um campo válido fora da ordem oficial", async () => {
    const { xml } = await generate("S2220");
    const malformed = xml.replace(
      "<tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>",
      "<procEmi>1</procEmi><tpAmb>2</tpAmb>"
    );
    await expect(validateEsocialXml(malformed, { allowUnsigned: true })).rejects.toThrow(
      "XSD oficial"
    );
  });
  it("XSD real rejeita atributo/elemento não oficial e nome de CRM com case errado", async () => {
    const { xml } = await generate("S2220");
    for (const bad of [
      xml.replace("<dtAso>", '<dtAso forged="true">'),
      xml.replaceAll("nrCRM", "nrCrm"),
      xml.replace("</aso>", "<pdf>abc</pdf></aso>"),
    ])
      await expect(validateEsocialXml(bad, { allowUnsigned: true })).rejects.toThrow("XSD oficial");
  });
  it("exige assinatura quando o chamador não permite rascunhos", async () => {
    const { xml } = await generate("S2220");
    await expect(validateEsocialXml(xml)).rejects.toThrow("sem assinatura");
    // XSD guarantees only structure: a synthetic signature is not cryptographic approval.
    const structured = await validateEsocialXml(
      xml.replace("</eSocial>", `${signature}</eSocial>`)
    );
    expect(structured.signed).toBe(true);
    expect(structured.businessValidation).toBe("NOT_EVALUATED");
    expect(structured).not.toHaveProperty("signatureVerified");
  });
  it("mantém contexto declarado de produção sem presumir que existe autorização para enviar", async () => {
    const input = currentEventFixture("S2220");
    input.ideEvento.tpAmb = 1;
    const result = await generateEsocialEvent(input);
    expect(result.environment).toBe("production");
    expect(result).not.toHaveProperty("submitted");
  });
  it("padroniza CNPJ completo/alfa e CPF com dígitos verificadores e padding à direita", async () => {
    for (const employer of [
      { tpInsc: 1 as const, nrInsc: "12.ABC.345/01DE-35" },
      { tpInsc: 2 as const, nrInsc: "123.456.789-09" },
    ]) {
      const input = currentEventFixture("S2220");
      input.ideEmpregador = employer;
      const result = await generateEsocialEvent(input, { now: NOW, sequence: 2 });
      expect(result.eventId).toContain(
        employer.tpInsc === 1 ? "ID112ABC34501DE35" : "ID212345678909000"
      );
      expect(result.xsdValidated).toBe(true);
    }
    expect(() => createEsocialEventId({ tpInsc: 1, nrInsc: "12345678" }, NOW, 0)).toThrow();
  });
  it("escapa texto sem permitir criar novos nós", async () => {
    const input = currentEventFixture("S2220");
    input.aso.medico.nmMed = 'Médico & Sintético <script> "A"';
    const result = await generateEsocialEvent(input);
    expect(result.xml).toContain("Médico &amp; Sintético &lt;script&gt; &quot;A&quot;");
  });
  it("gera rascunho legado idêntico à fixture vigente", () => {
    const input = JSON.parse(
      readFileSync("tests/fixtures/esocial/s2220-reviewed-input.json", "utf8")
    );
    const xml = buildS2220Xml(input);
    expect(xml).toBe(readFileSync("tests/fixtures/esocial/s2220-unsigned.xml", "utf8"));
  });
  it("valida consultas concorrentes com XSD imutável e sem compartilhar documentos", async () => {
    const results = await Promise.all(ESOCIAL_EVENT_TYPES.map((type) => generate(type)));
    expect(new Set(results.map((v) => v.eventType)).size).toBe(6);
  });
});

describe("entrada XML estrita sem carregamento de recursos externos", () => {
  it.each([
    '<!DOCTYPE eSocial [<!ENTITY x SYSTEM "file:///etc/passwd">]><eSocial>&x;</eSocial>',
    '<!DOCTYPE eSocial SYSTEM "https://example.invalid/xxe"><eSocial/>',
    '<?xml version="1.0" encoding="UTF-16"?><eSocial/>',
    '<?xml-stylesheet href="https://example.invalid/x"?><eSocial/>',
    '<eSocial xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///tmp/x"/></eSocial>',
    '<eSocial xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://example.invalid/x"/>',
    "<eSocial>\u0000</eSocial>",
    "<eSocial>\ud800</eSocial>",
    "a".repeat(1024 * 1024 + 1),
  ])("recusa XML ativo/malformado antes de inicializar parser: caso %#", (xml) =>
    expect(() => assertSafeEsocialXml(xml)).toThrow()
  );
  it("rejeita evento duplicado, assinatura aninhada, namespace trocado e identidade forjada", async () => {
    const { xml } = await generate("S2220");
    const event = xml.match(/<evtMonit[\s\S]*<\/evtMonit>/)![0];
    const bad = [
      xml.replace("</eSocial>", `${event}</eSocial>`),
      xml.replace("</evtMonit>", `${signature}</evtMonit>`),
      xml.replaceAll("v_S_01_03_00", "v_S_99_99_99"),
      xml.replace("<cpfTrab>12345678909</cpfTrab>", "<cpfTrab>12345678900</cpfTrab>"),
      xml.replace("ID112345678000000", "ID187654321000000"),
      xml.replace("</eSocial>", `${signature}${signature}</eSocial>`),
    ];
    for (const item of bad)
      await expect(validateEsocialXml(item, { allowUnsigned: true })).rejects.toThrow();
  });
  it("rejeita árvore exageradamente profunda mesmo abaixo do limite de bytes", async () => {
    const { xml } = await generate("S2220");
    const deep = xml.replace(
      "</evtMonit>",
      `${"<deep>".repeat(33)}${"</deep>".repeat(33)}</evtMonit>`
    );
    await expect(validateEsocialXml(deep, { allowUnsigned: true })).rejects.toThrow(
      "limites de estrutura"
    );
  });
});

function reviewedCard(): AsoFlowCard {
  return {
    id: "case-a",
    version: 7,
    companyId: "company-a",
    employeeId: "employee-a",
    cnpj: "12.345.678/0001-95",
    status: "reviewed",
    examType: "periodico",
    employeeIdentityHash: createHash("sha256")
      .update(JSON.stringify(["company-a", "employee-a", "12345678909"]))
      .digest("hex"),
    aso: { hash: "a".repeat(64), examDate: "2026-10-19" },
    review: {
      hash: "a".repeat(64),
      identityConfirmed: true,
      documentChecked: true,
      reviewedAt: "2026-10-21T10:00:00Z",
      reviewedBy: "reviewer",
    },
  } as AsoFlowCard;
}
const identity = {
  employer: { type: "1" as const, number: "12345678" },
  worker: { cpf: "12345678909", matricula: "SYNTHETIC-001" },
};
describe("origem S-2220 exclusivamente ASO conferido", () => {
  it("vincula hash/versão e deixa fatos clínicos para transcrição revisada", () => {
    const draft = createS2220DraftFromReviewedAso(reviewedCard(), identity);
    expect(draft.source).toMatchObject({
      cardId: "case-a",
      version: 7,
      documentHash: "a".repeat(64),
    });
    expect(draft.payload).toMatchObject({
      eventType: "S2220",
      aso: { dtAso: "", tpAso: 1, exames: [{ procRealizado: "" }], medico: { nmMed: "" } },
    });
    expect(JSON.stringify(draft.payload)).not.toContain("2026-10-19");
    expect(EsocialEventInputSchema.safeParse(draft.payload).success).toBe(false);
  });
  it.each([
    (c: AsoFlowCard) => {
      c.status = "received";
    },
    (c: AsoFlowCard) => {
      c.review!.hash = "b".repeat(64);
    },
    (c: AsoFlowCard) => {
      c.employeeIdentityHash = "a".repeat(64);
    },
    (c: AsoFlowCard) => {
      c.cnpj = "11.222.333/0001-81";
    },
    (c: AsoFlowCard) => {
      c.archive = {
        companyId: "other",
        employeeId: c.employeeId,
        hash: c.aso!.hash,
      } as AsoFlowCard["archive"];
    },
  ])("recusa perda de conferência/identidade/origem %#", (mutate) => {
    const card = reviewedCard();
    mutate(card);
    expect(() => createS2220DraftFromReviewedAso(card, identity)).toThrow();
  });
});
