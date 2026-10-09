import { promises as dns } from "dns";
import net from "net";

/**
 * NAI ENTERPRISE EGRESS & SSRF PROTECTION GUARD
 *
 * Previne ataques de Server-Side Request Forgery (SSRF), DNS Rebinding,
 * acesso a metadados de nuvem (AWS/GCP/Azure) e varredura de rede interna.
 */

// Hostnames proibidos explicitamente (Cloud Metadata & Localhost)
const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.internal",
  "instance-data",
  "169.254.169.254",
]);

/**
 * Converte IP IPv4 string para inteiro de 32 bits
 */
function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Verifica se um endereço IPv4 está dentro de um bloco CIDR
 */
function isIpInCidr(ip: string, cidrNet: string, maskBits: number): boolean {
  const ipNum = ipToInt(ip);
  const netNum = ipToInt(cidrNet);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

/**
 * Verifica se um IP (v4 ou v6) é privado, loopback, link-local ou reservado
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const version = net.isIP(normalized);
  if (!version) return true;
  if (version === 6) {
    let text = normalized;
    if (text.includes(".")) {
      const index = text.lastIndexOf(":");
      const v4 = text
        .slice(index + 1)
        .split(".")
        .map(Number);
      text =
        text.slice(0, index + 1) +
        ((v4[0] << 8) + v4[1]).toString(16) +
        ":" +
        ((v4[2] << 8) + v4[3]).toString(16);
    }
    const [left, right] = text.split("::");
    const a = left ? left.split(":") : [];
    const b = right ? right.split(":") : [];
    const groups =
      right !== undefined ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
    const value = groups.reduce(
      (acc, part) => (acc << BigInt(16)) + BigInt(parseInt(part, 16)),
      BigInt(0)
    );
    if (value >> BigInt(32) === BigInt(0xffff)) {
      const v4 = Number(value & BigInt(0xffffffff));
      return isPrivateOrReservedIp(
        [v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join(".")
      );
    }
    // Apenas unicast global; também bloqueia documentação, Teredo e 6to4.
    return (
      value >> BigInt(125) !== BigInt(1) ||
      value >> BigInt(96) === BigInt(0x20010db8) ||
      value >> BigInt(96) === BigInt(0x20010000) ||
      value >> BigInt(112) === BigInt(0x2002)
    );
  }
  ip = normalized;

  // IPv4 checks
  // 1. Loopback (127.0.0.0/8)
  if (isIpInCidr(ip, "127.0.0.0", 8)) return true;

  // 2. RFC 1918 Private Ranges
  if (isIpInCidr(ip, "10.0.0.0", 8)) return true;
  if (isIpInCidr(ip, "172.16.0.0", 12)) return true;
  if (isIpInCidr(ip, "192.168.0.0", 16)) return true;

  // 3. Cloud Metadata & Link-Local (169.254.0.0/16 - RFC 3927)
  if (isIpInCidr(ip, "169.254.0.0", 16)) return true;

  // 4. Carrier-Grade NAT (100.64.0.0/10 - RFC 6598)
  if (isIpInCidr(ip, "100.64.0.0", 10)) return true;

  // 5. Current network / broadcast (0.0.0.0/8, 255.255.255.255/32)
  if (isIpInCidr(ip, "0.0.0.0", 8) || ip === "255.255.255.255") return true;

  // 6. Multicast (224.0.0.0/4)
  if (isIpInCidr(ip, "224.0.0.0", 4)) return true;

  for (const [network, bits] of [
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["240.0.0.0", 4],
  ] as const)
    if (isIpInCidr(ip, network, bits)) return true;
  return false;
}

export interface WebhookUrlValidationResult {
  valid: boolean;
  error?: string;
  resolvedIps?: string[];
  normalizedUrl?: string;
}

/**
 * Validação rigorosa de URL de Webhook:
 * 1. Protocolo HTTPS estrito
 * 2. Bloqueio de portas de alto risco (permite apenas 443 e 8443)
 * 3. Bloqueio de hostnames de localhost e metadados de nuvem
 * 4. Resolução DNS e verificação de todos os IPs retornados contra faixas privadas
 */
export async function validateWebhookTargetUrl(
  rawUrl: string,
  domainAllowlist?: string[]
): Promise<WebhookUrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "URL inválida ou vazia." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Formato de URL inválido." };
  }

  if (parsed.username || parsed.password || parsed.hash) {
    return { valid: false, error: "URLs de webhook não podem conter credenciais ou fragmentos." };
  }

  // 1. Validação HTTPS Obrigatória
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Apenas endpoints com protocolo seguro HTTPS são permitidos." };
  }

  // 2. Controle de Portas (Egress Control)
  const port = parsed.port ? parseInt(parsed.port, 10) : 443;
  const ALLOWED_PORTS = [443, 8443];
  if (!ALLOWED_PORTS.includes(port)) {
    return {
      valid: false,
      error: `Porta ${port} não autorizada. Apenas portas HTTPS padrão (443, 8443) são permitidas.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // 3. Bloqueio de Hostnames Proibidos
  if (
    FORBIDDEN_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return {
      valid: false,
      error: "Destino não autorizado: hostnames locais ou de metadados são bloqueados.",
    };
  }

  // 4. Verificação de Domínio na Allowlist (se configurada)
  if (domainAllowlist && domainAllowlist.length > 0) {
    const isAllowed = domainAllowlist.some(
      (allowed) =>
        hostname === allowed.toLowerCase() || hostname.endsWith(`.${allowed.toLowerCase()}`)
    );
    if (!isAllowed) {
      return {
        valid: false,
        error: `Domínio '${hostname}' não consta na lista de domínios autorizados da organização.`,
      };
    }
  }

  // 5. Se o hostname for um IP direto, valida imediatamente
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return {
        valid: false,
        error: "Endereços IP privados, de loopback ou de metadados não são permitidos.",
      };
    }
    return { valid: true, resolvedIps: [hostname], normalizedUrl: parsed.toString() };
  }

  // 6. Resolução DNS e Inspeção contra DNS Rebinding e IPs Privados
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return { valid: false, error: `Não foi possível resolver o hostname '${hostname}' via DNS.` };
    }

    const resolvedIps = addresses.map((a) => a.address);

    for (const ip of resolvedIps) {
      if (isPrivateOrReservedIp(ip)) {
        return {
          valid: false,
          error: `O domínio '${hostname}' resolve para um IP privado ou restrito (${ip}). Requisição bloqueada por segurança (SSRF Guard).`,
        };
      }
    }

    return { valid: true, resolvedIps, normalizedUrl: parsed.toString() };
  } catch (err: any) {
    return {
      valid: false,
      error: `Falha na verificação de DNS para o domínio '${hostname}': ${err.message}`,
    };
  }
}
