import { expect, it } from "vitest";
import { ExtractionSchema } from "./analysis";
import { TermsSchema } from "./model";

const obligation = {
  id: "pgr",
  title: "Elaborar PGR",
  serviceType: "PGR",
  owner: "",
  due: "",
  deadlineRule: "Após ordem de serviço",
  sourceReference: "Cláusula 4",
  sourceExcerpt: "Elaborar o PGR da unidade.",
};
const extraction = {
  clientName: null,
  cnpj: null,
  scope: "Serviços SST",
  units: null,
  deliverables: null,
  valueCents: null,
  startsOn: null,
  endsOn: null,
  paymentTerms: null,
  recurring: null,
  references: [],
  pending: [],
};
it("rejects duplicate model IDs before the editable preview, as persistence does", () => {
  const obligations = [obligation, { ...obligation, title: "Revisar PGR" }];
  const parsed = ExtractionSchema.safeParse({ ...extraction, obligations });
  expect(parsed.success).toBe(false);
  if (!parsed.success) expect(parsed.error.issues[0].message).toContain("identificador único");
  expect(
    TermsSchema.safeParse({
      scope: "Serviços SST",
      units: "",
      deliverables: "",
      valueCents: null,
      startsOn: "",
      endsOn: "",
      paymentTerms: "",
      recurring: false,
      obligations,
    }).success
  ).toBe(false);
  expect(
    ExtractionSchema.parse({ ...extraction, obligations: [obligation] }).obligations
  ).toHaveLength(1);
  expect(ExtractionSchema.parse(extraction).obligations).toEqual([]);
});
