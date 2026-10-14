import {
  createDecipheriv,
  createHmac,
  createPrivateKey,
  privateDecrypt,
  constants,
  timingSafeEqual,
} from "node:crypto";
import type { AuthContext } from "@/lib/auth/auth-context";
import { forbidden } from "@/lib/auth/errors";

export class TallosError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function requireTallosAccess(user: AuthContext) {
  if (!(
    user.role === "SUPER_ADMIN" ||
    (!user.tenantId && ["ADMIN", "OPERATIONS"].includes(user.role))
  ))
    throw forbidden("A central Tallos é restrita à equipe interna autorizada.");
}
export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
export const string = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
export function items(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.map(object);
  const r = object(v);
  for (const key of ["data", "items", "results", "reports", "customers", "employees", "messages"]) {
    if (Array.isArray(r[key])) return (r[key] as unknown[]).map(object);
  }
  if (r.data && typeof r.data === "object") return items(r.data);
  throw new TallosError(502, "O Tallos retornou um formato de dados não reconhecido.");
}
export function pageNumber(v: string | null) {
  if (!v) return 1;
  if (!/^[1-9]\d{0,5}$/.test(v)) throw new TallosError(400, "Página inválida.");
  return Number(v);
}
export function dateRange(start: string | null, end: string | null) {
  const valid = (s: string | null): s is string =>
    !!s &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(start) || !valid(end)) throw new TallosError(400, "Informe datas válidas.");
  if (end < start || Date.parse(end) - Date.parse(start) > 90 * 86400000)
    throw new TallosError(400, "Selecione um período de até 90 dias.");
  return { start_date: start, end_date: end };
}
export function providerId(v: unknown) {
  const id = string(v, 129);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new TallosError(400, "Identificador inválido.");
  return id;
}
export type TallosResult = { data: unknown; total: number | null; pages: number | null };
export async function tallosRequest(
  path: string,
  query: Record<string, string> = {},
  body?: URLSearchParams
): Promise<TallosResult> {
  const token = process.env.TALLOS_API_TOKEN;
  if (!token)
    throw new TallosError(
      503,
      "Credencial Tallos não disponível no aplicativo. Confira o lançamento e o segredo."
    );
  if (
    !/^\/(?:v2\/(?:customers|employees|messages\/history|messages\/[a-zA-Z0-9_-]+\/send)|v4\/reports)$/.test(
      path
    )
  )
    throw new TallosError(400, "Recurso inválido.");
  let response: Response;
  try {
    response = await fetch(
      "https://api.tallos.com.br" +
        path +
        (Object.keys(query).length ? "?" + new URLSearchParams(query) : ""),
      {
        method: body ? "POST" : "GET",
        body,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
        redirect: "error",
      }
    );
  } catch {
    throw new TallosError(
      504,
      "O Tallos não confirmou a resposta. Atualize a consulta; para envios, confira o histórico antes de tentar novamente."
    );
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "Token Tallos inválido ou expirado.",
      403: "Seu plano ou credencial Tallos não permite este recurso.",
      429: "Limite de consultas Tallos atingido. Aguarde e tente novamente.",
    };
    throw new TallosError(
      response.status === 401 || response.status === 403
        ? 424
        : response.status === 429
          ? 429
          : 502,
      messages[response.status] || "O Tallos não concluiu a operação."
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new TallosError(502, "Resposta Tallos vazia.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new TallosError(502, "Resposta Tallos excedeu o limite. Reduza o período.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TallosError(502, "Resposta Tallos inválida.");
  }
  const count = (key: string) => {
    const v = response.headers.get(key);
    return v && /^\d+$/.test(v) ? Number(v) : null;
  };
  return { data, total: count("X-Total"), pages: count("X-Pages") };
}

/** JWE compact/flattened JSON; never return or log private keys or ciphertext. */
export function decryptHistory(value: unknown, keyText: string): unknown {
  try {
    const envelope = object(value);
    const compact =
      typeof value === "string" ? value : typeof envelope.data === "string" ? envelope.data : null;
    const parts = compact
      ? compact.split(".")
      : [
          envelope.protected,
          envelope.encrypted_key,
          envelope.iv,
          envelope.ciphertext,
          envelope.tag,
        ];
    if (parts.length !== 5 || parts.some((p) => typeof p !== "string")) throw Error();
    const [protectedPart, encryptedKey, iv, ciphertext, tag] = parts as string[];
    const header = JSON.parse(Buffer.from(protectedPart, "base64url").toString("utf8"));
    if (!["RSA-OAEP-256", "RSA-OAEP"].includes(header.alg) || header.zip || header.crit)
      throw Error();
    const key = keyText.trim().startsWith("{")
      ? createPrivateKey({ key: JSON.parse(keyText), format: "jwk" })
      : createPrivateKey(keyText);
    const cek = privateDecrypt(
      {
        key,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: header.alg === "RSA-OAEP-256" ? "sha256" : "sha1",
      },
      Buffer.from(encryptedKey, "base64url")
    );
    const aad = Buffer.from(protectedPart);
    const ivBytes = Buffer.from(iv, "base64url");
    const encrypted = Buffer.from(ciphertext, "base64url");
    const tagBytes = Buffer.from(tag, "base64url");
    let plaintext: Buffer;
    if (/^A(128|192|256)GCM$/.test(header.enc)) {
      const bits = Number(header.enc.slice(1, 4));
      if (cek.length !== bits / 8 || ivBytes.length !== 12 || tagBytes.length !== 16) throw Error();
      const decipher = createDecipheriv(`aes-${bits}-gcm` as "aes-256-gcm", cek, ivBytes);
      decipher.setAAD(aad);
      decipher.setAuthTag(tagBytes);
      plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } else {
      const variants: Record<string, [number, string]> = {
        "A128CBC-HS256": [32, "sha256"],
        "A192CBC-HS384": [48, "sha384"],
        "A256CBC-HS512": [64, "sha512"],
      };
      const variant = variants[header.enc];
      if (!variant || cek.length !== variant[0] || ivBytes.length !== 16) throw Error();
      const half = cek.length / 2;
      const length = Buffer.alloc(8);
      length.writeBigUInt64BE(BigInt(aad.length * 8));
      const expected = createHmac(variant[1], cek.subarray(0, half))
        .update(Buffer.concat([aad, ivBytes, encrypted, length]))
        .digest()
        .subarray(0, half);
      if (tagBytes.length !== expected.length || !timingSafeEqual(tagBytes, expected))
        throw Error();
      const decipher = createDecipheriv(`aes-${half * 8}-cbc`, cek.subarray(half), ivBytes);
      plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new TallosError(
      424,
      "Histórico criptografado indisponível. Confira a chave privada Tallos e o plano Advanced."
    );
  }
}

export function normalizeContact(row: Record<string, unknown>) {
  const job = object(row.job);
  return {
    id: providerId(row._id ?? row.id),
    name: string(row.full_name ?? row.name),
    phone: string(row.cel_phone, 40),
    email: string(row.email),
    company: string(job.company),
    cnpj: string(job.cnpj, 30),
  };
}
export function normalizeReport(row: Record<string, unknown>) {
  const customer = object(row.customer);
  const employee = object(row.employee);
  return {
    id: string(row._id ?? row.id),
    contact: string(customer.full_name ?? row.customer_name),
    operator: string(employee.full_name ?? employee.name ?? row.employee_name),
    status: string(row.status),
    channel: string(row.channel),
    openedAt: string(row.created_at ?? row.started_at),
    closedAt: string(row.closed_at ?? row.finished_at),
    department: string(object(row.department).name ?? row.department),
  };
}
