// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import forge from "node-forge";
import { inspectPkcs12 } from "./certificate";
import { makeSyntheticA1, SYNTHETIC_CNPJ, SYNTHETIC_PASSWORD } from "./certificate.test-fixtures";

const a = forge.asn1;
const seq = (children: forge.asn1.Asn1[]) =>
  a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, children);
const oid = (value: string) =>
  a.create(a.Class.UNIVERSAL, a.Type.OID, false, a.oidToDer(value).getBytes());
const integer = (value: number) =>
  a.create(a.Class.UNIVERSAL, a.Type.INTEGER, false, a.integerToDer(value).getBytes());
const octets = (value: string) => a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, value);
const context = (children: forge.asn1.Asn1[]) =>
  a.create(a.Class.CONTEXT_SPECIFIC, 0, true, children);
const children = (node: forge.asn1.Asn1) => node.value as forge.asn1.Asn1[];
const der = (node: forge.asn1.Asn1) => a.toDer(node).getBytes();
const bytes = (node: forge.asn1.Asn1) => Buffer.from(der(node), "binary");
const data = (node: forge.asn1.Asn1) =>
  seq([oid(forge.pki.oids.data), context([octets(der(node))])]);

function splitOctets(value: string) {
  const split = Math.max(1, Math.floor(value.length / 2));
  return a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, true, [
    octets(value.slice(0, split)),
    octets(value.slice(split)),
  ]);
}

/** Metadata-only guards below use mocked ciphers/parsers: no high-cost KDF is executed. */
function kdfParameters(count: number) {
  return seq([oid("1.2.840.113549.1.5.12"), seq([octets("synthetic-salt"), integer(count)])]);
}
function encryptedInfo(count: number) {
  const algorithm = seq([
    oid("1.2.840.113549.1.5.13"),
    seq([kdfParameters(count), seq([oid("2.16.840.1.101.3.4.1.42"), octets("0".repeat(16))])]),
  ]);
  return seq([
    oid(forge.pki.oids.encryptedData),
    context([
      seq([
        integer(0),
        seq([
          oid(forge.pki.oids.data),
          algorithm,
          a.create(a.Class.CONTEXT_SPECIFIC, 0, false, "synthetic-ciphertext"),
        ]),
      ]),
    ]),
  ]);
}
function metadataPfx(safe: forge.asn1.Asn1, macCount = 64) {
  return seq([
    integer(3),
    data(safe),
    seq([
      seq([seq([oid(forge.pki.oids.sha1)]), octets("synthetic-mac")]),
      octets("salt"),
      integer(macCount),
    ]),
  ]);
}
const pbe = (
  forge.pki as unknown as {
    pbe: {
      getCipher(oid: string, params: forge.asn1.Asn1, secret: string): forge.cipher.BlockCipher;
    };
  }
).pbe;
function mockDecryption(safeContents: forge.asn1.Asn1) {
  const cipher = {
    update: vi.fn(),
    finish: vi.fn(() => true),
    output: forge.util.createBuffer(der(safeContents)),
  } as unknown as forge.cipher.BlockCipher;
  const decrypt = vi.spyOn(pbe, "getCipher").mockReturnValue(cipher);
  const parser = vi.spyOn(forge.pkcs12, "pkcs12FromAsn1").mockImplementation(() => {
    throw new Error("SYNTHETIC_PARSER_BOUNDARY");
  });
  return { decrypt, parser };
}

/** Fully valid fixtures use only 64 iterations and ephemeral, self-signed test keys. */
function encryptedSyntheticPfx(chunked: boolean) {
  const root = makeSyntheticA1().pfxAsn;
  const entries = children(root);
  const wrapper = children(children(entries[1])[1]);
  const safe = a.fromDer(wrapper[0].value as string, true);
  const contents = children(safe);
  const keySafe = a.fromDer(children(children(contents[1])[1])[0].value as string, true);
  const encrypted = forge.pki.encryptPrivateKeyInfo(keySafe, SYNTHETIC_PASSWORD, {
    algorithm: "aes256",
    count: 64,
  });
  const [algorithm, payload] = children(encrypted);
  const cipherBytes = payload.value as string;
  const cipherNode = chunked
    ? context(children(splitOctets(cipherBytes)))
    : a.create(a.Class.CONTEXT_SPECIFIC, 0, false, cipherBytes);
  contents[1] = seq([
    oid(forge.pki.oids.encryptedData),
    context([seq([integer(0), seq([oid(forge.pki.oids.data), algorithm, cipherNode])])]),
  ]);
  const encodedSafe = der(safe);
  const mac = children(entries[2]);
  // toPkcs12Asn1's synthetic fixture uses SHA-1, count 64 and a 20-byte MAC key.
  const key = forge.pkcs12.generateKey(
    SYNTHETIC_PASSWORD,
    forge.util.createBuffer(mac[1].value as string),
    3,
    64,
    20
  );
  const hmac = forge.hmac.create();
  hmac.start(forge.md.sha1.create(), key);
  hmac.update(encodedSafe);
  children(mac[0])[1].value = hmac.getMac().getBytes();
  wrapper[0] = chunked ? splitOctets(encodedSafe) : octets(encodedSafe);
  return bytes(root);
}

afterEach(() => vi.restoreAllMocks());

describe("PKCS12 bounded resource preflight", () => {
  it("rejects an oversized visible KDF before invoking any cipher or parser", async () => {
    const { decrypt, parser } = mockDecryption(seq([]));
    await expect(
      inspectPkcs12(bytes(metadataPfx(seq([encryptedInfo(1_000_001)]))), "synthetic")
    ).rejects.toMatchObject({ code: "PKCS12_COST_LIMIT" });
    expect(decrypt).not.toHaveBeenCalled();
    expect(parser).not.toHaveBeenCalled();
  });
  it("checks decrypted SafeContents metadata before the private-key parser", async () => {
    const { decrypt, parser } = mockDecryption(seq([kdfParameters(1_000_001)]));
    await expect(
      inspectPkcs12(bytes(metadataPfx(seq([encryptedInfo(64)]))), "synthetic")
    ).rejects.toMatchObject({ code: "PKCS12_COST_LIMIT" });
    expect(decrypt).toHaveBeenCalledOnce();
    expect(parser).not.toHaveBeenCalled();
  });
  it.each([
    [500_000, "PKCS12_OPEN_FAILED", 1],
    [500_001, "PKCS12_COST_LIMIT", 0],
  ] as const)(
    "counts MAC and both container derivations in the aggregate budget (%s)",
    async (lastCount, code, parserCalls) => {
      const { decrypt, parser } = mockDecryption(
        seq([kdfParameters(500_000), kdfParameters(lastCount)])
      );
      await expect(
        inspectPkcs12(bytes(metadataPfx(seq([encryptedInfo(1_000_000)]), 1_000_000)), "synthetic")
      ).rejects.toMatchObject({ code });
      expect(decrypt).toHaveBeenCalledOnce();
      expect(parser).toHaveBeenCalledTimes(parserCalls);
    }
  );
  it("inspects the combined metadata of a constructed OCTET STRING before derivation", async () => {
    const root = metadataPfx(seq([data(seq([kdfParameters(1_000_001)]))]));
    const safeWrapper = children(children(children(root)[1])[1]);
    safeWrapper[0] = splitOctets(safeWrapper[0].value as string);
    const { decrypt, parser } = mockDecryption(seq([]));
    await expect(inspectPkcs12(bytes(root), "synthetic")).rejects.toMatchObject({
      code: "PKCS12_COST_LIMIT",
    });
    expect(decrypt).not.toHaveBeenCalled();
    expect(parser).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "accepts a valid low-cost encrypted SafeContents fixture (chunked=%s)",
    async (chunked) => {
      const material = await inspectPkcs12(encryptedSyntheticPfx(chunked), SYNTHETIC_PASSWORD);
      expect(material.metadata.holder).toEqual({ type: "1", number: SYNTHETIC_CNPJ });
      expect(material.metadata.keyPairMatches).toBe(true);
      expect(JSON.stringify(material)).not.toContain("PRIVATE KEY");
    }
  );
});
