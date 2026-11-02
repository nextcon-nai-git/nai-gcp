import { describe, expect, it, vi } from "vitest";
import { annotateSchema, z as genkitZ } from "genkit";
import { toJsonSchema } from "@genkit-ai/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { z as appZ } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  nursingAttendanceSchema,
  type NursingAttendanceValues,
} from "./medical/nursing-attendance";
import { PgrEvidenceSchema } from "./pgr-schema";
import { CompanySchema, EmailRoutineSchema } from "./schemas";

vi.mock("@/ai/genkit", () => ({
  ai: { defineTool: (_config: unknown, handler: unknown) => handler },
}));
import { PatientDataSchema, ClinicalSummaryOutputSchema } from "@/ai/tools/clinicalEngineTool";

describe("Zod compatibility boundaries", () => {
  it("keeps existing application defaults and absent optional fields", () => {
    const company = CompanySchema.parse({
      id: "synthetic-company",
      name: "Synthetic Company",
      cnpj: "00000000000000",
    });
    expect(CompanySchema).toBeInstanceOf(appZ.ZodObject);
    expect(company).not.toHaveProperty("address");
    expect(company).not.toHaveProperty("risk_degree");
    expect(
      EmailRoutineSchema.parse({ id: "routine", companyId: company.id, frequency: "weekly" })
    ).toMatchObject({ active: true });
  });

  it("uses the Genkit SDK's Zod instance for clinical tool contracts", () => {
    expect(PatientDataSchema).toBeInstanceOf(genkitZ.ZodObject);
    expect(PatientDataSchema.shape.phq9).toBeInstanceOf(genkitZ.ZodOptional);
    expect(ClinicalSummaryOutputSchema).toBeInstanceOf(genkitZ.ZodDiscriminatedUnion);
  });

  it("preserves Genkit annotations through nested optional schemas", () => {
    const value = annotateSchema(genkitZ.string(), { "x-nai-review": "required" });
    const schema = genkitZ.object({
      details: genkitZ.object({ value: value.optional() }).optional(),
    });
    expect(toJsonSchema({ schema })).toMatchObject({
      properties: {
        details: { properties: { value: { "x-nai-review": "required" } } },
      },
    });
  });

  it("preserves evidence bounds when shared application schemas reach Genkit", () => {
    expect(
      zodToJsonSchema(PgrEvidenceSchema, { removeAdditionalStrategy: "strict" })
    ).toMatchObject({
      properties: {
        pagina: { type: "integer", minimum: 1, maximum: 300 },
        trecho: { type: "string", minLength: 3, maxLength: 1200 },
      },
      required: ["pagina", "trecho"],
    });
  });

  const attendance: NursingAttendanceValues = {
    companyId: " synthetic-company ",
    employeeId: " synthetic-employee ",
    complaint: " Synthetic reported complaint ",
    conduct: "observation",
    care_lines: ["uso_epi"],
    coren: " SYNTHETIC-SP ",
  };
  const options = { fields: {}, shouldUseNativeValidation: false, criteriaMode: "all" as const };

  it("returns the existing trimmed nursing values through the updated form resolver", async () => {
    const result = await zodResolver(nursingAttendanceSchema)(attendance, undefined, options);
    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({
      companyId: "synthetic-company",
      employeeId: "synthetic-employee",
      complaint: "Synthetic reported complaint",
      coren: "SYNTHETIC-SP",
      care_lines: ["uso_epi"],
    });
  });

  it("retains field errors and blocks invalid nursing submissions", async () => {
    const result = await zodResolver(nursingAttendanceSchema)(
      { ...attendance, companyId: "all", complaint: " a ", coren: "" },
      undefined,
      options
    );
    expect(result.values).toEqual({});
    expect(result.errors).toHaveProperty("companyId");
    expect(result.errors.complaint?.message).toBe("Descreva a queixa");
    expect(result.errors.coren?.message).toBe("Informe seu COREN e UF");
  });
});
