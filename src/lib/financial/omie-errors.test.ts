import { describe, expect, it } from "vitest";
import { AuthError } from "@/lib/auth/errors";
import { omieResponseError, omieTransportError } from "./omie-errors";

describe("Omie failures preserve the cause without exposing provider content", () => {
  it.each([429, 425])("handles HTTP %i even without a JSON body", (status) => {
    const error = omieResponseError(status);
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(status === 425 ? 1800 : 60);
    expect(error.message).not.toContain("chave");
  });
  it("recognizes a duplicate request reported as a SOAP fault", () => {
    const error = omieResponseError(500, {
      faultstring: "Solicitação já foi realizada. Aguarde 60 segundos.",
      faultcode: "SOAP-ENV:Client-9999",
    });
    expect(error.code).toBe("OMIE_RATE_LIMIT");
    expect(error.message).toContain("SOAP-ENV:Client-9999");
  });
  it("only attributes failure to access with explicit evidence", () => {
    expect(omieResponseError(403).code).toBe("OMIE_ACCESS");
    expect(omieResponseError(500, { faultstring: "App Key inválida" }).code).toBe("OMIE_ACCESS");
    expect(omieResponseError(500, { faultstring: "Parâmetro de período inválido" }).code).toBe(
      "OMIE_REQUEST"
    );
    expect(omieResponseError(503).code).toBe("OMIE_UNAVAILABLE");
  });
  it("never includes raw error text, credentials or arbitrary fault codes", () => {
    const error = omieResponseError(500, {
      faultstring: "App key inválida: PRIVATE_KEY; app_secret: PRIVATE_SECRET",
      faultcode: "PRIVATE_CODE",
    });
    expect(error.code).toBe("OMIE_ACCESS");
    expect(error.message).not.toMatch(/PRIVATE/);
    expect(omieTransportError(new Error("PRIVATE_KEY PRIVATE_SECRET")).message).not.toMatch(
      /PRIVATE/
    );
  });
  it("separates timeout, malformed response and network errors, preserving size limits", () => {
    expect(omieTransportError(new DOMException("private", "TimeoutError"))).toMatchObject({
      code: "OMIE_TIMEOUT",
      status: 504,
    });
    expect(omieTransportError(new SyntaxError("private"))).toMatchObject({
      code: "OMIE_RESPONSE",
      status: 502,
    });
    expect(omieTransportError(new TypeError("private"))).toMatchObject({
      code: "OMIE_NETWORK",
      status: 503,
    });
    const limit = new AuthError("Período muito grande", 413);
    expect(omieTransportError(limit)).toBe(limit);
  });
});
