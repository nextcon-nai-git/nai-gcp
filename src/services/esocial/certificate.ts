import "server-only";

import { createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import forge from "node-forge";
import {
  DOMParser,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
} from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { isValidCnpj } from "@/lib/cnpj";
import { isValidCpf } from "@/lib/cpf";

export type EsocialEnvironment = "restricted" | "production";
export interface EsocialRegistration {
  type: "1" | "2";
  number: string;
}

export interface A1CertificateMetadata {
  type: "A1";
  subject: string;
  issuer: string;
  serialNumber: string;
  fingerprint256: string;
  validFrom: string;
  validUntil: string;
  holder: EsocialRegistration;
  policyOids: string[];
  keyBits: number;
  keyPairMatches: true;
  /** A declared policy is not proof of an ICP-Brasil trust chain. */
  a1PolicyPresent: true;
  trustChain: "NOT_VALIDATED";
  revocation: "NOT_CHECKED";
  authorization: "NOT_CHECKED";
}

/** Server memory only. Never return this object from an API or write it to logs. */
export interface CertificateMaterial {
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  /** Intermediates in issuer order; no untrusted certificate is installed as a TLS root. */
  readonly chainPem: readonly string[];
  readonly metadata: A1CertificateMetadata;
}

export class EsocialCertificateError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "EsocialCertificateError";
  }
}

export const ESOCIAL_XMLDSIG = {
  namespace: "http://www.w3.org/2000/09/xmldsig#",
  canonicalization: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  signature: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  digest: "http://www.w3.org/2001/04/xmlenc#sha256",
  enveloped: "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
} as const;

const MAX_PFX_BYTES = 256 * 1024;
const MAX_KDF_ITERATIONS = 1_000_000;
const MAX_TOTAL_KDF_ITERATIONS = 4_000_000;
const MAX_EVENT_BYTES = 1024 * 1024;
const EVENT_NAMES = new Set([
  "evtMonit",
  "evtCAT",
  "evtExpRisco",
  "evtToxic",
  "evtAfastTemp",
  "evtExclusao",
]);
const EVENT_ID = /^ID[12][A-Z0-9]{12}\d{21}$/;

function fail(code: string, message: string): never {
  throw new EsocialCertificateError(code, message);
}

function asnChildren(node: forge.asn1.Asn1): forge.asn1.Asn1[] {
  return Array.isArray(node.value) ? (node.value as forge.asn1.Asn1[]) : [];
}

function strictDer(bytes: string): forge.asn1.Asn1 {
  // @types/node-forge predates the documented options overload in node-forge 1.4.2.
  const parse = forge.asn1.fromDer as unknown as (
    input: string,
    options: {
      strict: boolean;
      parseAllBytes: boolean;
      maxDepth: number;
    }
  ) => forge.asn1.Asn1;
  return parse(bytes, { strict: true, parseAllBytes: true, maxDepth: 64 });
}

function asnBytes(node: forge.asn1.Asn1 | undefined): string {
  if (!node || typeof node.value !== "string") {
    return fail("INVALID_PKCS12", "Estrutura ASN.1 do certificado inválida.");
  }
  return node.value;
}

function boundedIteration(node: forge.asn1.Asn1 | undefined): number {
  if (!node) return 1;
  const bytes = asnBytes(node);
  if (node.type !== forge.asn1.Type.INTEGER || bytes.length > 4) {
    fail("PKCS12_COST_LIMIT", "Parâmetros de proteção do A1 excedem o limite aceito.");
  }
  const value = Number.parseInt(Buffer.from(bytes, "binary").toString("hex"), 16);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_KDF_ITERATIONS) {
    fail("PKCS12_COST_LIMIT", "Parâmetros de proteção do A1 excedem o limite aceito.");
  }
  return value;
}

/** Flatten the PKCS#7 OCTET STRING form accepted by node-forge without mutating MAC input. */
function pkcs7Octets(node: forge.asn1.Asn1): string {
  const chunks =
    typeof node.value === "string"
      ? [node.value]
      : asnChildren(node).map((part) => {
          if (part.type !== forge.asn1.Type.OCTETSTRING || typeof part.value !== "string")
            return fail("INVALID_PKCS12", "Fragmentos do conteúdo protegido do A1 inválidos.");
          return part.value;
        });
  const size = chunks.reduce((total, part) => total + part.length, 0);
  if (size > MAX_PFX_BYTES || chunks.length > 10_000)
    return fail("PKCS12_COST_LIMIT", "Estrutura do arquivo A1 excede o limite aceito.");
  return chunks.join("");
}

/** Inspect visible and encrypted SafeContents before decoding their private-key bags. */
function preflightPkcs12(root: forge.asn1.Asn1, password: string): void {
  const entries = asnChildren(root);
  if (entries.length !== 3)
    fail("PKCS12_MAC_REQUIRED", "O arquivo A1 deve possuir proteção de integridade (MAC).");
  // This is a sum of iteration counts, not an elapsed-time guarantee. Derivation
  // algorithms perform a bounded number of blocks per iteration.
  let totalIterations = boundedIteration(asnChildren(entries[2])[2]);
  const charge = (iterations: number) => {
    totalIterations += iterations;
    if (totalIterations > MAX_TOTAL_KDF_ITERATIONS)
      fail("PKCS12_COST_LIMIT", "O custo total de proteção do A1 excede o limite aceito.");
  };
  let visited = 0;
  const visit = (node: forge.asn1.Asn1, depth: number): void => {
    if (++visited > 10_000 || depth > 48)
      fail("PKCS12_COST_LIMIT", "Estrutura do arquivo A1 excede o limite aceito.");
    const children = asnChildren(node);
    if (children[0]?.type === forge.asn1.Type.OID) {
      const oid = forge.asn1.derToOid(asnBytes(children[0]));
      if (oid === "1.2.840.113549.1.5.12" || oid.startsWith("1.2.840.113549.1.12.1."))
        charge(boundedIteration(children[1] && asnChildren(children[1])[1]));
    }
    // Scan the reconstructed DER once. Scanning fragments separately can both
    // miss a split KDF and count a coincidental complete DER fragment twice.
    if (node.type === forge.asn1.Type.OCTETSTRING) {
      visited += children.length;
      if (visited > 10_000)
        fail("PKCS12_COST_LIMIT", "Estrutura do arquivo A1 excede o limite aceito.");
      const bytes = pkcs7Octets(node);
      if (bytes.charCodeAt(0) === 0x30) {
        let inner: forge.asn1.Asn1 | undefined;
        try {
          inner = strictDer(bytes);
        } catch {
          // Ciphertext and binary certificate extension values need not themselves be DER.
        }
        if (inner) visit(inner, depth + 1);
      }
      return;
    }
    children.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);

  // RFC7292 4.1: only real ContentInfo entries in AuthenticatedSafe may trigger
  // this decryption, never a coincidental OID in a certificate extension.
  const [safeType, safeWrapper] = asnChildren(entries[1]);
  const safeData = safeWrapper && asnChildren(safeWrapper)[0];
  if (
    !safeType ||
    safeType.type !== forge.asn1.Type.OID ||
    forge.asn1.derToOid(asnBytes(safeType)) !== "1.2.840.113549.1.7.1" ||
    !safeData ||
    safeData.type !== forge.asn1.Type.OCTETSTRING
  )
    fail("INVALID_PKCS12", "Estrutura do conteúdo protegido do A1 inválida.");
  const safe = strictDer(pkcs7Octets(safeData));
  for (const info of asnChildren(safe)) {
    const [infoType, wrapper] = asnChildren(info);
    if (!infoType || infoType.type !== forge.asn1.Type.OID)
      fail("INVALID_PKCS12", "Estrutura do conteúdo protegido do A1 inválida.");
    if (forge.asn1.derToOid(asnBytes(infoType)) !== "1.2.840.113549.1.7.6") continue;
    const data = wrapper && asnChildren(wrapper)[0];
    const encryptedInfo = data && asnChildren(data)[1];
    const [contentType, algorithm, encrypted] = encryptedInfo ? asnChildren(encryptedInfo) : [];
    const [algorithmOid, parameters] = algorithm ? asnChildren(algorithm) : [];
    if (
      !contentType ||
      contentType.type !== forge.asn1.Type.OID ||
      forge.asn1.derToOid(asnBytes(contentType)) !== "1.2.840.113549.1.7.1" ||
      !algorithmOid ||
      algorithmOid.type !== forge.asn1.Type.OID ||
      !parameters ||
      !encrypted ||
      encrypted.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC ||
      encrypted.type !== 0
    )
      fail("INVALID_PKCS12", "Conteúdo protegido do A1 inválido.");
    const cipherOid = forge.asn1.derToOid(asnBytes(algorithmOid));
    if (
      !["1.2.840.113549.1.5.13", "1.2.840.113549.1.12.1.3", "1.2.840.113549.1.12.1.6"].includes(
        cipherOid
      )
    )
      fail("INVALID_PKCS12", "Proteção do A1 não suportada.");
    // Charge the extra bounded decryption used for preflight as well as the
    // parser's original derivation. Cipher parameters were already visited above.
    visit(algorithm, 1);
    const pbe = (
      forge.pki as unknown as {
        pbe: {
          getCipher(oid: string, params: forge.asn1.Asn1, secret: string): forge.cipher.BlockCipher;
        };
      }
    ).pbe;
    const cipher = pbe.getCipher(cipherOid, parameters, password);
    cipher.update(forge.util.createBuffer(pkcs7Octets(encrypted)));
    if (!cipher.finish())
      fail("PKCS12_OPEN_FAILED", "Confira o arquivo e a senha do certificado A1.");
    visit(strictDer(cipher.output.getBytes()), 1);
  }
}

function extensionValue(cert: forge.pki.Certificate, id: string): string | undefined {
  const ext = cert.extensions.find((candidate: { id?: string }) => candidate.id === id) as
    { value?: unknown } | undefined;
  return typeof ext?.value === "string" ? ext.value : undefined;
}

function policyOids(cert: forge.pki.Certificate): string[] {
  const value = extensionValue(cert, "2.5.29.32");
  if (!value) return [];
  return asnChildren(strictDer(value)).map((policy) => {
    const oid = asnChildren(policy)[0];
    if (oid?.type !== forge.asn1.Type.OID) {
      return fail("INVALID_CERTIFICATE_POLICY", "Política do certificado inválida.");
    }
    return forge.asn1.derToOid(asnBytes(oid));
  });
}

function otherNameText(node: forge.asn1.Asn1, depth = 0): string {
  if (depth > 5) return fail("INVALID_CERTIFICATE_HOLDER", "Identificação do titular inválida.");
  const children = asnChildren(node);
  if (children.length === 1) return otherNameText(children[0], depth + 1);
  if (children.length)
    return fail("INVALID_CERTIFICATE_HOLDER", "Identificação do titular ambígua.");
  const value = asnBytes(node);
  if (
    node.type !== forge.asn1.Type.UTF8 &&
    node.type !== forge.asn1.Type.PRINTABLESTRING &&
    node.type !== forge.asn1.Type.IA5STRING &&
    node.type !== forge.asn1.Type.OCTETSTRING
  ) {
    return fail("INVALID_CERTIFICATE_HOLDER", "Formato de identificação do titular não suportado.");
  }
  if (node.type === forge.asn1.Type.OCTETSTRING && value.charCodeAt(0) < 0x20) {
    return otherNameText(strictDer(value), depth + 1);
  }
  return value;
}

function certificateHolder(cert: forge.pki.Certificate): EsocialRegistration {
  const raw = extensionValue(cert, "2.5.29.17");
  if (!raw) return fail("CERTIFICATE_HOLDER_MISSING", "A1 sem CPF/CNPJ no otherName ICP-Brasil.");
  const holders: EsocialRegistration[] = [];
  for (const name of asnChildren(strictDer(raw))) {
    if (name.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC || name.type !== 0) continue;
    const [oidNode, valueNode] = asnChildren(name);
    if (oidNode?.type !== forge.asn1.Type.OID || !valueNode) continue;
    const oid = forge.asn1.derToOid(asnBytes(oidNode));
    if (oid === "2.16.76.1.3.3") {
      const number = otherNameText(valueNode);
      if (!/^[A-Z0-9]{12}\d{2}$/.test(number) || !isValidCnpj(number)) {
        fail("INVALID_CERTIFICATE_HOLDER", "CNPJ do titular do A1 inválido.");
      }
      holders.push({ type: "1", number });
    } else if (oid === "2.16.76.1.3.1") {
      const data = otherNameText(valueNode);
      const number = data.slice(8, 19);
      if (!/^\d{8}/.test(data) || !/^\d{11}$/.test(number) || !isValidCpf(number)) {
        fail("INVALID_CERTIFICATE_HOLDER", "CPF do titular do A1 inválido.");
      }
      holders.push({ type: "2", number });
    }
    // 2.16.76.1.3.4 identifies the e-CNPJ representative, not the certificate holder.
  }
  if (holders.length !== 1) {
    return fail(
      "CERTIFICATE_HOLDER_MISSING",
      "O A1 deve identificar um único titular CPF ou CNPJ."
    );
  }
  return holders[0];
}

function assertCurrentKeyPair(certificatePem: string, privateKeyPem: string): X509Certificate {
  const cert = new X509Certificate(certificatePem);
  const now = Date.now();
  if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) {
    fail("CERTIFICATE_EXPIRED", "Certificado A1 vencido ou ainda fora do período de validade.");
  }
  if (cert.ca)
    fail(
      "CERTIFICATE_IS_CA",
      "Use o certificado do titular, não o de uma autoridade certificadora."
    );
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "rsa" || cert.publicKey.asymmetricKeyType !== "rsa") {
    fail("CERTIFICATE_KEY_TYPE", "A assinatura eSocial requer uma chave RSA.");
  }
  const bits = cert.publicKey.asymmetricKeyDetails?.modulusLength ?? 0;
  if (bits < 2048 || bits > 8192) {
    fail("CERTIFICATE_KEY_SIZE", "A chave RSA deve ter entre 2048 e 8192 bits.");
  }
  const actual = createPublicKey(key).export({ type: "spki", format: "der" });
  const expected = cert.publicKey.export({ type: "spki", format: "der" });
  if (!actual.equals(expected)) {
    fail("CERTIFICATE_KEY_MISMATCH", "A chave privada não corresponde ao certificado A1.");
  }
  return cert;
}

/**
 * Parse only in a Node server process. Local checks do not assert trust, non-revocation,
 * a valid procuração or acceptance by eSocial; those facts must be verified separately.
 */
export async function inspectPkcs12(
  bytes: Uint8Array,
  password: string
): Promise<CertificateMaterial> {
  if (
    !bytes.length ||
    bytes.length > MAX_PFX_BYTES ||
    typeof password !== "string" ||
    password.length > 1024
  ) {
    return fail("INVALID_PKCS12", "Arquivo A1 inválido ou maior que 256 KiB.");
  }
  try {
    const asn = strictDer(Buffer.from(bytes).toString("binary"));
    preflightPkcs12(asn, password);
    const pfx = forge.pkcs12.pkcs12FromAsn1(asn, true, password);
    const bags = pfx.safeContents.flatMap((content) => content.safeBags);
    const keys = bags.flatMap((bag) => (bag.key ? [bag.key] : []));
    const certs = bags.flatMap((bag) => (bag.cert ? [bag.cert] : []));
    if (keys.length !== 1 || !certs.length || certs.length > 12) {
      return fail(
        "INVALID_PKCS12_CONTENT",
        "O A1 deve conter uma chave privada e sua cadeia de certificados."
      );
    }
    const privateKeyPem = forge.pki.privateKeyToPem(keys[0]);
    const publicDer = createPublicKey(createPrivateKey(privateKeyPem)).export({
      type: "spki",
      format: "der",
    });
    const matches = certs.filter((candidate) => {
      const key = new X509Certificate(forge.pki.certificateToPem(candidate)).publicKey;
      return key.export({ type: "spki", format: "der" }).equals(publicDer);
    });
    if (matches.length !== 1)
      return fail(
        "CERTIFICATE_KEY_MISMATCH",
        "Não foi possível identificar um único certificado para a chave privada."
      );
    const leaf = matches[0];
    const certificatePem = forge.pki.certificateToPem(leaf);
    const cert = assertCurrentKeyPair(certificatePem, privateKeyPem);
    const keyUsage = leaf.getExtension("keyUsage") as
      { digitalSignature?: boolean; keyCertSign?: boolean } | undefined;
    if (!keyUsage?.digitalSignature || keyUsage.keyCertSign) {
      return fail(
        "CERTIFICATE_KEY_USAGE",
        "O A1 deve permitir assinatura digital e ser certificado de usuário final."
      );
    }
    const eku = leaf.getExtension("extKeyUsage") as
      { clientAuth?: boolean; anyExtendedKeyUsage?: boolean } | undefined;
    if (eku && !eku.clientAuth && !eku.anyExtendedKeyUsage) {
      return fail(
        "CERTIFICATE_TLS_USAGE",
        "O certificado não permite autenticação de cliente TLS."
      );
    }
    const policies = policyOids(leaf);
    if (!policies.some((oid) => /^2\.16\.76\.1\.2\.1(?:\.\d+)+$/.test(oid))) {
      return fail(
        "CERTIFICATE_NOT_A1",
        "Não foi encontrada uma política ICP-Brasil A1 no certificado."
      );
    }
    const holder = certificateHolder(leaf);
    const remaining = certs
      .filter((item) => item !== leaf)
      .map((item) => forge.pki.certificateToPem(item));
    const chainPem: string[] = [];
    let current = cert;
    while (remaining.length) {
      const index = remaining.findIndex((pem) => {
        const issuer = new X509Certificate(pem);
        return issuer.ca && current.checkIssued(issuer) && current.verify(issuer.publicKey);
      });
      if (index < 0) break;
      const [pem] = remaining.splice(index, 1);
      const issuer = new X509Certificate(pem);
      // The root is not necessary in the TLS certificate list and is never trusted here.
      if (issuer.checkIssued(issuer) && issuer.verify(issuer.publicKey)) break;
      chainPem.push(pem);
      current = issuer;
    }
    const material: CertificateMaterial = {
      certificatePem,
      privateKeyPem,
      chainPem,
      metadata: {
        type: "A1",
        subject: cert.subject,
        issuer: cert.issuer,
        serialNumber: cert.serialNumber,
        fingerprint256: cert.fingerprint256,
        validFrom: new Date(cert.validFrom).toISOString(),
        validUntil: new Date(cert.validTo).toISOString(),
        holder,
        policyOids: policies,
        keyBits: cert.publicKey.asymmetricKeyDetails!.modulusLength!,
        keyPairMatches: true,
        a1PolicyPresent: true,
        trustChain: "NOT_VALIDATED",
        revocation: "NOT_CHECKED",
        authorization: "NOT_CHECKED",
      },
    };
    // An accidental JSON serialization cannot export the unencrypted private key.
    Object.defineProperty(material, "privateKeyPem", { enumerable: false });
    Object.freeze(material.chainPem);
    Object.freeze(material.metadata.holder);
    Object.freeze(material.metadata.policyOids);
    Object.freeze(material.metadata);
    return Object.freeze(material);
  } catch (error) {
    if (error instanceof EsocialCertificateError) throw error;
    // PKCS#12 implementations may include key/container details in exception messages.
    return fail("PKCS12_OPEN_FAILED", "Não foi possível abrir o A1. Confira o arquivo e a senha.");
  }
}

export function assertCertificateMaterialCurrent(material: CertificateMaterial): void {
  try {
    assertCurrentKeyPair(material.certificatePem, material.privateKeyPem);
  } catch (error) {
    if (error instanceof EsocialCertificateError) throw error;
    fail("INVALID_CERTIFICATE", "Material do certificado A1 inválido.");
  }
}

/** No DTD, external entities, processing instructions or recovery from malformed XML. */
export function parseEsocialXmlSafely(
  xml: string,
  maxBytes = MAX_EVENT_BYTES + 64 * 1024
): XmlDocument {
  if (typeof xml !== "string" || !xml.length || Buffer.byteLength(xml, "utf8") > maxBytes) {
    return fail("XML_SIZE", "XML vazio ou maior que o limite permitido.");
  }
  const body = xml.replace(
    /^\uFEFF?<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?(?:\s+standalone=["'](?:yes|no)["'])?\s*\?>/i,
    ""
  );
  if (
    /<!\s*(?:DOCTYPE|ENTITY)\b|<\?/i.test(body) ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body)
  ) {
    return fail(
      "XML_UNSAFE",
      "XML com DTD, entidade externa ou instrução de processamento não é permitido."
    );
  }
  try {
    const doc = new DOMParser({
      onError: () => {
        throw new Error("Invalid XML");
      },
    }).parseFromString(xml, "application/xml");
    if (!doc.documentElement || doc.doctype) return fail("XML_INVALID", "Documento XML inválido.");
    let count = 0;
    const walk = (node: XmlNode, depth: number): void => {
      if (++count > 50_000 || depth > 64)
        return fail("XML_LIMIT", "XML excede os limites de estrutura.");
      for (let child = node.firstChild; child; child = child.nextSibling) walk(child, depth + 1);
    };
    walk(doc, 0);
    return doc;
  } catch (error) {
    if (error instanceof EsocialCertificateError) throw error;
    return fail("XML_INVALID", "Documento XML malformado.");
  }
}

export function xmlElementChildren(node: XmlNode): XmlElement[] {
  const result: XmlElement[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) result.push(child as XmlElement);
  }
  return result;
}

export function xmlSingleChild(
  node: XmlElement,
  name: string,
  namespace = node.namespaceURI,
  required = true
): XmlElement | undefined {
  const matches = xmlElementChildren(node).filter(
    (child) => child.localName === name && child.namespaceURI === namespace
  );
  if (matches.length > 1 || (required && matches.length !== 1)) {
    return fail("XML_STRUCTURE", `Estrutura XML inválida: ${name}.`);
  }
  return matches[0];
}

function eventStructure(xml: string, signed: boolean) {
  const doc = parseEsocialXmlSafely(xml);
  const root = doc.documentElement!;
  const ns = root.namespaceURI;
  if (
    root.localName !== "eSocial" ||
    !ns ||
    !/^http:\/\/www\.esocial\.gov\.br\/schema\/evt\/\w+\/v_S_\d{2}_\d{2}_\d{2}$/.test(ns)
  ) {
    return fail("XML_EVENT_ROOT", "Raiz ou namespace de evento eSocial inválido.");
  }
  const children = xmlElementChildren(root);
  const event = children[0];
  if (
    children.length !== (signed ? 2 : 1) ||
    !event ||
    !EVENT_NAMES.has(event.localName ?? "") ||
    event.namespaceURI !== ns
  ) {
    return fail("XML_EVENT_COUNT", "Informe exatamente um evento eSocial suportado.");
  }
  const eventId = event.getAttribute("Id") ?? "";
  if (!EVENT_ID.test(eventId))
    return fail("XML_EVENT_ID", "Identificador do evento eSocial inválido.");
  const all = Array.from(doc.getElementsByTagName("*"));
  for (const node of all) {
    for (let index = 0; index < node.attributes.length; index++) {
      const attribute = node.attributes.item(index)!;
      if (
        attribute.localName?.toLowerCase() === "id" &&
        (node !== event || attribute.name !== "Id")
      ) {
        return fail("XML_DUPLICATE_ID", "XML com identificadores adicionais ou ambíguos.");
      }
    }
  }
  const signatures = all.filter((node) => node.localName === "Signature");
  if (
    signatures.length !== (signed ? 1 : 0) ||
    (signed &&
      (children[1] !== signatures[0] || signatures[0].namespaceURI !== ESOCIAL_XMLDSIG.namespace))
  ) {
    return fail("XML_SIGNATURE_LOCATION", "A assinatura deve ser única e filha direta de eSocial.");
  }
  return { doc, root, event, eventId, signature: signatures[0] };
}

export interface VerifiedEsocialXml {
  eventId: string;
  eventName: string;
  environment: EsocialEnvironment;
  employer: EsocialRegistration;
  /** SHA-256 DigestValue signed in SignedInfo; compare with the official receipt.hash. */
  digestValue: string;
  /** Derived only from xml-crypto.getSignedReferences() after cryptographic verification. */
  authenticatedXml: string;
}

export function verifyEsocialXmlSignature(
  xml: string,
  expectedCertificatePem: string
): VerifiedEsocialXml {
  const { signature } = eventStructure(xml, true);
  const ds = ESOCIAL_XMLDSIG;
  const signedInfo = xmlSingleChild(signature, "SignedInfo", ds.namespace)!;
  const c14n = xmlSingleChild(signedInfo, "CanonicalizationMethod", ds.namespace)!;
  const method = xmlSingleChild(signedInfo, "SignatureMethod", ds.namespace)!;
  const reference = xmlSingleChild(signedInfo, "Reference", ds.namespace)!;
  const transforms = xmlSingleChild(reference, "Transforms", ds.namespace)!;
  const digest = xmlSingleChild(reference, "DigestMethod", ds.namespace)!;
  const transformNames = xmlElementChildren(transforms).map((node) =>
    node.namespaceURI === ds.namespace && node.localName === "Transform"
      ? node.getAttribute("Algorithm")
      : ""
  );
  if (
    xmlElementChildren(signature)
      .map((node) => node.localName)
      .join(",") !== "SignedInfo,SignatureValue,KeyInfo" ||
    xmlElementChildren(signedInfo)
      .map((node) => node.localName)
      .join(",") !== "CanonicalizationMethod,SignatureMethod,Reference" ||
    c14n.getAttribute("Algorithm") !== ds.canonicalization ||
    method.getAttribute("Algorithm") !== ds.signature ||
    !reference.hasAttribute("URI") ||
    reference.getAttribute("URI") !== "" ||
    digest.getAttribute("Algorithm") !== ds.digest ||
    transformNames.join(",") !== `${ds.enveloped},${ds.canonicalization}`
  ) {
    return fail(
      "XML_SIGNATURE_PROFILE",
      "Assinatura fora do perfil eSocial SHA-256/C14N de documento completo."
    );
  }
  const keyInfo = xmlSingleChild(signature, "KeyInfo", ds.namespace)!;
  const x509Data = xmlSingleChild(keyInfo, "X509Data", ds.namespace)!;
  const embedded = xmlSingleChild(x509Data, "X509Certificate", ds.namespace)!;
  const expected = new X509Certificate(expectedCertificatePem);
  if (
    xmlElementChildren(keyInfo).length !== 1 ||
    xmlElementChildren(x509Data).length !== 1 ||
    (embedded.textContent ?? "").replace(/\s/g, "") !== expected.raw.toString("base64")
  ) {
    return fail(
      "XML_SIGNER_MISMATCH",
      "O certificado da assinatura não corresponde ao signatário esperado."
    );
  }
  try {
    const verifier = new SignedXml({
      publicCert: expectedCertificatePem,
      getCertFromKeyInfo: () => null,
    });
    verifier.loadSignature(signature as unknown as Node);
    if (!verifier.checkSignature(xml))
      return fail("XML_SIGNATURE_INVALID", "Falha na verificação criptográfica da assinatura.");
    const references = verifier.getSignedReferences();
    if (references.length !== 1)
      return fail("XML_SIGNATURE_INVALID", "Referência de assinatura inválida.");
    const authenticatedXml = references[0];
    const digestValue = (
      xmlSingleChild(reference, "DigestValue", ds.namespace)!.textContent ?? ""
    ).replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]{43}=$/.test(digestValue))
      return fail("XML_SIGNATURE_INVALID", "DigestValue SHA-256 inválido.");
    const { event, eventId } = eventStructure(authenticatedXml, false);
    const ideEvento = xmlSingleChild(event, "ideEvento")!;
    const environmentCode = xmlSingleChild(ideEvento, "tpAmb")!.textContent;
    if (environmentCode !== "1" && environmentCode !== "2")
      return fail("XML_ENVIRONMENT", "Ambiente do evento inválido.");
    const employerNode = xmlSingleChild(event, "ideEmpregador")!;
    const type = xmlSingleChild(employerNode, "tpInsc")!.textContent;
    const number = xmlSingleChild(employerNode, "nrInsc")!.textContent ?? "";
    if (type !== "1" && type !== "2")
      return fail("XML_EMPLOYER", "Tipo de inscrição do empregador inválido.");
    return {
      eventId,
      eventName: event.localName!,
      environment: environmentCode === "1" ? "production" : "restricted",
      employer: { type, number },
      digestValue,
      authenticatedXml,
    };
  } catch (error) {
    if (error instanceof EsocialCertificateError) throw error;
    return fail("XML_SIGNATURE_INVALID", "Falha na verificação criptográfica da assinatura.");
  }
}

/** Manual do Desenvolvedor 1.16 §6.7 / §8.4: URI="", entire event document, EndCertOnly. */
export function signEsocialXml(xml: string, material: CertificateMaterial): string {
  assertCertificateMaterialCurrent(material);
  eventStructure(xml, false);
  const signature = new SignedXml({
    privateKey: material.privateKeyPem,
    publicCert: material.certificatePem,
    signatureAlgorithm: ESOCIAL_XMLDSIG.signature,
    canonicalizationAlgorithm: ESOCIAL_XMLDSIG.canonicalization,
  });
  signature.addReference({
    xpath: "/*",
    isEmptyUri: true,
    uri: "",
    transforms: [ESOCIAL_XMLDSIG.enveloped, ESOCIAL_XMLDSIG.canonicalization],
    digestAlgorithm: ESOCIAL_XMLDSIG.digest,
  });
  signature.computeSignature(xml, { location: { reference: "/*", action: "append" } });
  const signedXml = signature.getSignedXml();
  verifyEsocialXmlSignature(signedXml, material.certificatePem);
  return signedXml;
}
