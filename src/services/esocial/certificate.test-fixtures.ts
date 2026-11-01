import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import forge from "node-forge";

// Generated on demand; these certificates are synthetic, self-signed and NEVER trusted.
// No real A1, private key or credentials are stored in the repository.
export const SYNTHETIC_CNPJ = "11222333000181";
export const SYNTHETIC_CPF = "12345678909";
export const SYNTHETIC_PASSWORD = "synthetic-only-password";
export const SYNTHETIC_EVENT_ID = `ID1${SYNTHETIC_CNPJ}2026101212345600001`;
export const SYNTHETIC_PROTOCOL = "1.2.202610.0000000000000000001";
const generated = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keyPem = generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const key = forge.pki.privateKeyFromPem(keyPem);
const publicKey = forge.pki.publicKeyFromPem(
  generated.publicKey.export({ type: "spki", format: "pem" }).toString()
);

function sequence(children: forge.asn1.Asn1[]) {
  return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, children);
}
function oid(value: string) {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.OID,
    false,
    forge.asn1.oidToDer(value).getBytes()
  );
}

export function makeSyntheticA1(
  options: {
    holder?: string;
    cpf?: boolean;
    expired?: boolean;
    notYetValid?: boolean;
    digitalSignature?: boolean;
    ca?: boolean;
    policy?: string;
    clientAuth?: boolean;
    mismatchKey?: boolean;
    noMac?: boolean;
  } = {}
) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01020304";
  cert.validity.notBefore = new Date(
    options.notYetValid ? "2090-01-01T00:00:00Z" : "2020-01-01T00:00:00Z"
  );
  cert.validity.notAfter = new Date(
    options.expired ? "2021-01-01T00:00:00Z" : "2099-01-01T00:00:00Z"
  );
  const attributes = [
    { name: "commonName", value: "SYNTHETIC TEST CERTIFICATE - NOT ICP BRASIL" },
    { name: "countryName", value: "BR" },
  ];
  cert.setSubject(attributes);
  cert.setIssuer(attributes);
  const holder = options.holder ?? (options.cpf ? SYNTHETIC_CPF : SYNTHETIC_CNPJ);
  const holderValue = options.cpf ? `01011990${holder}${"0".repeat(36)}` : holder;
  const otherName = forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
    oid(options.cpf ? "2.16.76.1.3.1" : "2.16.76.1.3.3"),
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, holderValue),
    ]),
  ]);
  cert.setExtensions([
    { name: "basicConstraints", cA: options.ca ?? false },
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: options.digitalSignature ?? true,
      keyEncipherment: true,
      keyCertSign: options.ca ?? false,
    },
    { name: "extKeyUsage", clientAuth: options.clientAuth ?? true, serverAuth: true },
    { id: "2.5.29.17", value: forge.asn1.toDer(sequence([otherName])).getBytes() },
    {
      id: "2.5.29.32",
      value: forge.asn1
        .toDer(sequence([sequence([oid(options.policy ?? "2.16.76.1.2.1.999")])]))
        .getBytes(),
    },
  ]);
  cert.sign(key, forge.md.sha256.create());
  const privateKey = options.mismatchKey ? forge.pki.rsa.generateKeyPair(2048).privateKey : key;
  const pfxAsn = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], SYNTHETIC_PASSWORD, {
    algorithm: "aes256",
    count: 64,
    useMac: !options.noMac,
  });
  return {
    pfx: Buffer.from(forge.asn1.toDer(pfxAsn).getBytes(), "binary"),
    pfxAsn,
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

export function syntheticUnsignedXml() {
  return readFileSync("tests/fixtures/esocial/s2220-unsigned.xml", "utf8")
    .replace(/Id="ID[12][A-Z0-9]{12}\d{21}"/, `Id="${SYNTHETIC_EVENT_ID}"`)
    .replace(
      /(<ideEmpregador>\s*<tpInsc>1<\/tpInsc>\s*<nrInsc>)[A-Z0-9]+/,
      (_match, prefix: string) => `${prefix}${SYNTHETIC_CNPJ}`
    );
}
