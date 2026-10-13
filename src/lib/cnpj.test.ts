import { describe, expect, it } from "vitest";
import { isValidCnpj, normalizeCnpj } from "./cnpj";

describe("CNPJ identity validation", () => {
  it("validates numeric and alphanumeric check digits", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(normalizeCnpj("12.ABC.345/01DE-35")).toBe("12ABC34501DE35");
  });

  it.each(["00000000000000", "11222333000182", "12ABC34501DE36", "1234567890123"])(
    "rejects invalid CNPJ %s",
    (value) => {
      expect(isValidCnpj(value)).toBe(false);
    }
  );
});
