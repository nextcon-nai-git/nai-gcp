import { describe, expect, it } from "vitest";
import {
  avpCostBand,
  AvpPaymentSchema,
  avpEvidenceCsv,
  AvpAsoEvidenceSchema,
} from "./avp-evidence";
export const paymentFixture = {
  kind: "payment" as const,
  id: "a".repeat(64),
  source: "Synthetic receipt",
  sourceHash: "b".repeat(64),
  notes: "",
  clinic: "Clínica fictícia",
  date: "2026-10-16",
  amountCents: 12000,
  unitCents: 6000,
  quantity: 2,
  city: "",
  uf: "",
  employees: "",
  transactionId: "",
  confirmation: "Comprovante" as const,
  scope: "AVP" as const,
};
describe("AVP evidence integrity", () => {
  it.each([
    [3999, "green"],
    [4000, "yellow"],
    [4999, "yellow"],
    [5000, "red"],
    [6000, "red"],
    [6001, "purple"],
    [null, "unknown"],
    [-1, "unknown"],
  ] as const)("classifies %s as %s", (value, band) => expect(avpCostBand(value)).toBe(band));
  it("does not substitute batch total for unit price", () => {
    expect(
      AvpPaymentSchema.parse({ ...paymentFixture, unitCents: null, quantity: null }).unitCents
    ).toBeNull();
    expect(AvpPaymentSchema.safeParse({ ...paymentFixture, quantity: 3 }).success).toBe(false);
  });
  it("rejects invalid calendar dates and unexpected fields", () => {
    expect(AvpPaymentSchema.safeParse({ ...paymentFixture, date: "2026-02-30" }).success).toBe(
      false
    );
    expect(AvpPaymentSchema.safeParse({ ...paymentFixture, cpf: "sensitive" }).success).toBe(false);
  });
  it("exports text without spreadsheet formula execution", () =>
    expect(avpEvidenceCsv([{ ...paymentFixture, clinic: "  =1+1" }])).toContain('"\'  =1+1"'));
});

it("exports cents as pt-BR numeric text without rounding away centavos", () => {
  const csv = avpEvidenceCsv([
    { ...paymentFixture, amountCents: 12345, quantity: null, unitCents: 4115 },
  ]);
  expect(csv).toContain('"123,45";"";"41,15"');
});
it.each(["ASO João Silva.pdf", "Exame final.PDF", "ASO - João - 16.10.2026.pdf"])(
  "accepts human-readable PDF basenames: %s",
  (fileName) => {
    expect(AvpAsoEvidenceSchema.shape.fileName.safeParse(fileName).success).toBe(true);
  }
);
it.each(["../ASO.pdf", "pasta/ASO.pdf", "pasta\\ASO.pdf", "ASO\n.pdf", "ASO.exe"])(
  "rejects unsafe basenames: %s",
  (fileName) => {
    expect(AvpAsoEvidenceSchema.shape.fileName.safeParse(fileName).success).toBe(false);
  }
);
