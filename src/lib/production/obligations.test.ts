import { expect, it } from "vitest";
import { BookSchema, CommandSchema, applyCommand, emptyBook } from "./model";
import { ObligationSchema } from "./obligations";
const legacyTerms = {
  scope: "Serviços SST",
  units: "Matriz",
  deliverables: "PGR",
  valueCents: 10000,
  startsOn: "2026-10-01",
  endsOn: "",
  paymentTerms: "Mensal",
  recurring: true,
};
it("loads legacy persisted books without inventing contractual obligations", () => {
  const command = CommandSchema.parse({
    action: "create",
    requestId: "fa57b815-55d0-42bc-b01c-de52cbdb320a",
    expectedVersion: 0,
    recordId: "r",
    companyId: "c",
    cnpj: "11222333000181",
    name: "Contrato",
    owner: "Gestor",
    terms: legacyTerms,
    document: null,
    effectiveOn: "2026-10-01",
    evidence: "Revisado",
    reviewed: true,
  });
  const raw = JSON.parse(
    JSON.stringify(applyCommand(emptyBook(), command, "admin", "now", "hash", "Cliente"))
  );
  delete raw.records[0].cycles[0].tasks;
  delete raw.records[0].revisions[0].terms.obligations;
  const loaded = BookSchema.parse(raw);
  expect(loaded.records[0].cycles[0].tasks).toEqual([]);
  expect(loaded.records[0].revisions[0].terms.obligations).toEqual([]);
  expect(loaded.records[0].cycles[0].contractedCents).toBe(10000);
});
it("rejects invented dates and obligations lacking a source reference", () => {
  const data = {
    id: "pgr",
    title: "Elaborar PGR",
    serviceType: "PGR",
    owner: "",
    due: "",
    deadlineRule: "30 dias após ordem",
    sourceReference: "Cláusula 4",
    sourceExcerpt: "Elaborar PGR",
  };
  expect(ObligationSchema.safeParse(data).success).toBe(true);
  expect(ObligationSchema.safeParse({ ...data, due: "2026-02-30" }).success).toBe(false);
  expect(ObligationSchema.safeParse({ ...data, sourceReference: "" }).success).toBe(false);
});
it("accepts a 50-service contract and rejects plans beyond the explicit limit", () => {
  const obligations = Array.from({ length: 50 }, (_, n) => ({
    id: `item_${n}`,
    title: `Executar obrigação ${n + 1}`,
    serviceType: "OUTRO",
    owner: "",
    due: "",
    deadlineRule: "Conforme demanda",
    sourceReference: `Cláusula 1.${n + 1}`,
    sourceExcerpt: `Serviço contratual de teste ${n + 1}.`,
  }));
  const payload = {
    action: "create",
    requestId: "fa57b815-55d0-42bc-b01c-de52cbdb320a",
    expectedVersion: 0,
    recordId: "r",
    companyId: "c",
    cnpj: "11222333000181",
    name: "Contrato extenso",
    owner: "Gestor",
    terms: { ...legacyTerms, obligations },
    document: null,
    effectiveOn: "2026-10-01",
    evidence: "Revisado",
    reviewed: true,
  };
  const command = CommandSchema.parse(payload);
  const result = applyCommand(emptyBook(), command, "admin", "now", "hash", "Cliente");
  expect(result.records[0].cycles[0].tasks).toHaveLength(50);
  expect(result.records[0].cycles[0].contractedCents).toBe(10000);
  expect(
    CommandSchema.safeParse({
      ...payload,
      terms: {
        ...payload.terms,
        obligations: Array.from({ length: 101 }, (_, n) => ({
          ...obligations[0],
          id: `item_${n}`,
        })),
      },
    }).success
  ).toBe(false);
});
