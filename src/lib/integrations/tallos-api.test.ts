// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
  createHmac,
} from "node:crypto";
import {
  dateRange,
  pageNumber,
  providerId,
  requireTallosAccess,
  tallosRequest,
  items,
  decryptHistory,
  normalizeContact,
} from "./tallos-api";
import type { AuthContext } from "@/lib/auth/auth-context";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Tallos access and boundaries", () => {
  const user: AuthContext = {
    uid: "staff",
    email: "",
    role: "OPERATIONS",
    tenantId: null,
    permissions: [],
    servedCompanies: [],
  };
  it("rejects client-scoped staff and guest access to the global provider account", () => {
    expect(() => requireTallosAccess(user)).not.toThrow();
    expect(() => requireTallosAccess({ ...user, tenantId: "client" })).toThrow();
    expect(() => requireTallosAccess({ ...user, role: "GUEST" })).toThrow();
  });
  it("validates real calendar dates, bounded ranges and pages", () => {
    expect(dateRange("2026-10-01", "2026-10-14")).toEqual({
      start_date: "2026-10-01",
      end_date: "2026-10-14",
    });
    for (const dates of [
      ["2026-02-30", "2026-03-01"],
      ["2026-01-01", "2026-10-01"],
      ["2026-10-02", "2026-10-01"],
    ])
      expect(() => dateRange(...(dates as [string, string]))).toThrow();
    expect(pageNumber(null)).toBe(1);
    expect(() => pageNumber("0")).toThrow();
    expect(() => providerId("../employees")).toThrow();
  });
  it("normalizes documented contacts without leaking arbitrary fields", () => {
    expect(
      normalizeContact({
        _id: "abc",
        full_name: "Contato",
        cel_phone: "5511999999999",
        token: "secret",
        job: { company: "Cliente", cnpj: "123" },
      })
    ).toEqual({
      id: "abc",
      name: "Contato",
      phone: "5511999999999",
      company: "Cliente",
      cnpj: "123",
      email: "",
    });
    expect(() => items({ unexpected: true })).toThrow();
  });
  it("uses server credentials, disallows redirects and does not leak provider error bodies", async () => {
    vi.stubEnv("TALLOS_API_TOKEN", "synthetic-test-token");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ _id: "abc" }]), {
        headers: { "X-Total": "101", "X-Pages": "3" },
      })
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await tallosRequest("/v2/customers", { page: "2" });
    expect(result.total).toBe(101);
    expect(result.pages).toBe(3);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.tallos.com.br/v2/customers?page=2",
      expect.objectContaining({ redirect: "error", cache: "no-store", method: "GET" })
    );
    fetcher.mockResolvedValue(new Response("secret provider error", { status: 403 }));
    await expect(tallosRequest("/v2/customers")).rejects.toThrow("Seu plano ou credencial");
    await expect(tallosRequest("/v2/customers/../../other")).rejects.toThrow("Recurso inválido");
  });
});

describe("Encrypted history", () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKey = JSON.stringify(keys.privateKey.export({ format: "jwk" }));
  it.each(["A256GCM", "A128CBC-HS256"])(
    "decrypts authenticated %s JWE and rejects tampering",
    (enc) => {
      const header = Buffer.from(JSON.stringify({ alg: "RSA-OAEP-256", enc })).toString(
        "base64url"
      );
      const cek = randomBytes(32);
      const iv = randomBytes(enc === "A256GCM" ? 12 : 16);
      const encryptedKey = publicEncrypt(
        { key: keys.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        cek
      );
      const plaintext = Buffer.from(JSON.stringify([{ id: "msg", text: "Mensagem sintética" }]));
      let encrypted: Buffer;
      let tag: Buffer;
      if (enc === "A256GCM") {
        const cipher = createCipheriv("aes-256-gcm", cek, iv);
        cipher.setAAD(Buffer.from(header));
        encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        tag = cipher.getAuthTag();
      } else {
        const cipher = createCipheriv("aes-128-cbc", cek.subarray(16), iv);
        encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const length = Buffer.alloc(8);
        length.writeBigUInt64BE(BigInt(header.length * 8));
        tag = createHmac("sha256", cek.subarray(0, 16))
          .update(Buffer.concat([Buffer.from(header), iv, encrypted, length]))
          .digest()
          .subarray(0, 16);
      }
      const parts = [
        header,
        encryptedKey.toString("base64url"),
        iv.toString("base64url"),
        encrypted.toString("base64url"),
        tag.toString("base64url"),
      ];
      expect(decryptHistory(parts.join("."), privateKey)).toEqual(JSON.parse(plaintext.toString()));
      parts[4] = Buffer.alloc(tag.length).toString("base64url");
      expect(() => decryptHistory(parts.join("."), privateKey)).toThrow(
        "Histórico criptografado indisponível"
      );
    }
  );
});
