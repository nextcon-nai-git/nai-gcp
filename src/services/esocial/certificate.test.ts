// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createHash, verify } from "node:crypto";
import forge from "node-forge";
import { XmlDocument } from "libxml2-wasm";
import {
  ESOCIAL_XMLDSIG,
  inspectPkcs12,
  parseEsocialXmlSafely,
  signEsocialXml,
  verifyEsocialXmlSignature,
  type CertificateMaterial,
} from "./certificate";
import {
  makeSyntheticA1,
  SYNTHETIC_CNPJ,
  SYNTHETIC_CPF,
  SYNTHETIC_EVENT_ID,
  SYNTHETIC_PASSWORD,
  syntheticUnsignedXml,
} from "./certificate.test-fixtures";

let material: CertificateMaterial;
beforeAll(async () => {
  material = await inspectPkcs12(makeSyntheticA1().pfx, SYNTHETIC_PASSWORD);
});

describe("eSocial A1 inspection — synthetic certificates only", () => {
  it("checks key pairing, declared ICP A1 profile and CNPJ without pretending trust or authorization", () => {
    expect(material.metadata).toMatchObject({
      type: "A1",
      keyPairMatches: true,
      keyBits: 2048,
      holder: { type: "1", number: SYNTHETIC_CNPJ },
      trustChain: "NOT_VALIDATED",
      revocation: "NOT_CHECKED",
      authorization: "NOT_CHECKED",
    });
    expect(material.privateKeyPem).toContain("PRIVATE KEY");
    expect(JSON.stringify(material)).not.toContain("PRIVATE KEY");
  });
  it("extracts the e-CPF holder from the ICP otherName offset", async () => {
    expect(
      (await inspectPkcs12(makeSyntheticA1({ cpf: true }).pfx, SYNTHETIC_PASSWORD)).metadata.holder
    ).toEqual({ type: "2", number: SYNTHETIC_CPF });
  });
  it("supports an alphanumeric CNPJ with check digits", async () => {
    expect(
      (await inspectPkcs12(makeSyntheticA1({ holder: "12ABC34501DE35" }).pfx, SYNTHETIC_PASSWORD))
        .metadata.holder.number
    ).toBe("12ABC34501DE35");
  });
  it.each([
    [{ expired: true }, "CERTIFICATE_EXPIRED"],
    [{ notYetValid: true }, "CERTIFICATE_EXPIRED"],
    [{ digitalSignature: false }, "CERTIFICATE_KEY_USAGE"],
    [{ ca: true }, "CERTIFICATE_IS_CA"],
    [{ policy: "2.16.76.1.2.3.999" }, "CERTIFICATE_NOT_A1"],
    [{ clientAuth: false }, "CERTIFICATE_TLS_USAGE"],
    [{ holder: "11222333000182" }, "INVALID_CERTIFICATE_HOLDER"],
    [{ noMac: true }, "PKCS12_MAC_REQUIRED"],
    [{ mismatchKey: true }, "CERTIFICATE_KEY_MISMATCH"],
  ] as const)("rejects an invalid certificate profile %j", async (options, code) => {
    await expect(
      inspectPkcs12(makeSyntheticA1(options).pfx, SYNTHETIC_PASSWORD)
    ).rejects.toMatchObject({ code });
  });
  it("rejects wrong password and malformed PKCS12 with a sanitized error", async () => {
    await expect(
      inspectPkcs12(makeSyntheticA1().pfx, "secret-that-must-not-be-echoed")
    ).rejects.toMatchObject({ code: "PKCS12_OPEN_FAILED" });
    await expect(inspectPkcs12(Buffer.from("not a PKCS12"), "secret")).rejects.toThrow(
      "Confira o arquivo e a senha"
    );
  });
  it("bounds file size and attacker-controlled MAC cost before key derivation", async () => {
    await expect(inspectPkcs12(Buffer.alloc(256 * 1024 + 1), "")).rejects.toMatchObject({
      code: "INVALID_PKCS12",
    });
    const fixture = makeSyntheticA1();
    const root = fixture.pfxAsn.value as forge.asn1.Asn1[];
    const mac = root[2].value as forge.asn1.Asn1[];
    mac[2] = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      "\x7f\xff\xff\xff"
    );
    await expect(
      inspectPkcs12(
        Buffer.from(forge.asn1.toDer(fixture.pfxAsn).getBytes(), "binary"),
        SYNTHETIC_PASSWORD
      )
    ).rejects.toMatchObject({ code: "PKCS12_COST_LIMIT" });
  });
});

describe("eSocial document XMLDSig", () => {
  it("signs and verifies the whole document with one empty URI and one end-user certificate", () => {
    const signed = signEsocialXml(syntheticUnsignedXml(), material);
    expect(signed).toContain('<Reference URI="">');
    expect(signed).toContain(ESOCIAL_XMLDSIG.signature);
    expect(signed).toContain(ESOCIAL_XMLDSIG.digest);
    expect(signed.match(/<X509Certificate>/g)).toHaveLength(1);
    const verified = verifyEsocialXmlSignature(signed, material.certificatePem);
    expect(verified).toMatchObject({
      eventId: SYNTHETIC_EVENT_ID,
      environment: "restricted",
      employer: { type: "1", number: SYNTHETIC_CNPJ },
    });
    expect(verified.authenticatedXml).toContain("<evtMonit");
    expect(verified.authenticatedXml).not.toContain("<Signature");
  });
  it("independently verifies C14N and the RSA signature using libxml2 and Node OpenSSL", () => {
    const document = XmlDocument.fromString(signEsocialXml(syntheticUnsignedXml(), material));
    try {
      const namespaces = { ds: ESOCIAL_XMLDSIG.namespace };
      const signedInfo = document.get("//ds:SignedInfo", namespaces)!;
      const signature = document.get("//ds:SignatureValue", namespaces)!.content;
      expect(
        verify(
          "RSA-SHA256",
          Buffer.from(signedInfo.canonicalizeToString()),
          material.certificatePem,
          Buffer.from(signature, "base64")
        )
      ).toBe(true);
      const digest = document.get("//ds:DigestValue", namespaces)!.content;
      document.get("//ds:Signature", namespaces)!.remove();
      expect(createHash("sha256").update(document.canonicalizeToString()).digest("base64")).toBe(
        digest
      );
    } finally {
      document.dispose();
    }
  });
  it("rejects content tampering and a different expected signer", () => {
    const signed = signEsocialXml(syntheticUnsignedXml(), material);
    expect(() =>
      verifyEsocialXmlSignature(
        signed.replace("<resAso>1</resAso>", "<resAso>2</resAso>"),
        material.certificatePem
      )
    ).toThrow("criptográfica");
    expect(() =>
      verifyEsocialXmlSignature(signed, makeSyntheticA1({ cpf: true }).certificatePem)
    ).toThrow("signatário esperado");
  });
  it("rejects partial references, signature algorithm substitution and duplicate signatures", () => {
    const signed = signEsocialXml(syntheticUnsignedXml(), material);
    expect(() =>
      verifyEsocialXmlSignature(
        signed.replace('URI=""', `URI="#${SYNTHETIC_EVENT_ID}"`),
        material.certificatePem
      )
    ).toThrow("perfil eSocial");
    expect(() =>
      verifyEsocialXmlSignature(
        signed.replace(ESOCIAL_XMLDSIG.signature, "http://www.w3.org/2000/09/xmldsig#rsa-sha1"),
        material.certificatePem
      )
    ).toThrow("perfil eSocial");
    const signature = signed.slice(
      signed.indexOf("<Signature"),
      signed.indexOf("</Signature>") + "</Signature>".length
    );
    expect(() =>
      verifyEsocialXmlSignature(
        signed.replace("</eSocial>", `${signature}</eSocial>`),
        material.certificatePem
      )
    ).toThrow();
  });
  it("rejects wrapping, extra IDs and already-signed input", () => {
    const xml = syntheticUnsignedXml();
    expect(() =>
      signEsocialXml(xml.replace("<ideEvento>", `<ideEvento Id="${SYNTHETIC_EVENT_ID}">`), material)
    ).toThrow("identificadores");
    expect(() =>
      signEsocialXml(
        xml
          .replace("<ideEvento>", '<wrapper xmlns="urn:evil"><ideEvento>')
          .replace("</ideEvento>", "</ideEvento></wrapper>"),
        material
      )
    ).toThrow();
    expect(() => signEsocialXml(signEsocialXml(xml, material), material)).toThrow();
  });
  it.each([
    '<!DOCTYPE eSocial [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><eSocial>&xxe;</eSocial>',
    '<!DOCTYPE eSocial [<!ENTITY x "xx">]><eSocial>&x;</eSocial>',
    '<?xml-stylesheet href="https://example.invalid/xsl"?><eSocial/>',
    "<eSocial><unclosed></eSocial>",
    "<eSocial/><eSocial/>",
    "<eSocial>&undeclared;</eSocial>",
  ])("rejects unsafe or malformed XML without resolving resources", (xml) => {
    expect(() => parseEsocialXmlSafely(xml)).toThrow();
  });
});
