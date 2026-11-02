// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initNodeFeatures } from "@genkit-ai/core/node";
import { action, toJsonSchema as toGenkitJsonSchema } from "@genkit-ai/core";
import { NextRequest } from "next/server";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod/v3";
import baseline from "../../tests/fixtures/zod3-shared-contracts.json";
import { PgrAnalysisOutputSchema, PgrEvidenceSchema } from "./pgr-schema";
import { parsePgrDocumentPages } from "./pgr-document-parser";
import { ExtractionSchema } from "./production/analysis";
import { SourceSchema } from "./production/model";
import { analyzePgrDocument } from "@/services/pgr-document-analysis";
import { POST as productionAssistant } from "@/app/api/production/assistant/route";

initNodeFeatures();

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  readPages: vi.fn(),
  readSource: vi.fn(),
}));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mocks.generate } }));
vi.mock("@/services/pgr-ai-provider", () => ({
  getPgrAi: () => ({ generate: mocks.generate }),
}));
vi.mock("@/services/pgr-pdf-text", () => ({ readPgrPdfPages: mocks.readPages }));
vi.mock("@/services/production-central", () => ({
  readProductionSource: mocks.readSource,
  getProductionBook: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async () => ({ uid: "synthetic-reviewer", role: "SUPER_ADMIN" }),
}));

const sourceText =
  "PROGRAMA DE GERENCIAMENTO DE RISCOS\nCLIENTE: Empresa Sintética\n" +
  "RECONHECIMENTO DE RISCOS AMBIENTAIS\nMANUTENÇÃO\n" +
  "Trabalhador exposto a ruído contínuo de motores.";
const pages = [{ numero: 1, texto: sourceText }];
const source = {
  sha256: "a".repeat(64),
  storagePath: `internos_nextcon/contract-sources/${"a".repeat(64)}`,
  generation: "1",
  sizeBytes: 100,
};
const emptyExtraction = {
  clientName: null,
  cnpj: null,
  scope: null,
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
const obligation = {
  id: "synthetic-obligation",
  title: "Revisar PGR",
  serviceType: "PGR",
  owner: "",
  due: "",
  deadlineRule: "",
  sourceReference: "Cláusula 1",
  sourceExcerpt: "Revisar o PGR contratado.",
};
const jsonSchema = (schema: z.ZodTypeAny) =>
  zodToJsonSchema(schema, { removeAdditionalStrategy: "strict" });
const request = (documentSource = source) =>
  new NextRequest("http://localhost/api/production/assistant", {
    method: "POST",
    body: JSON.stringify({ action: "extract", source: documentSource }),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generate.mockReset();
  mocks.readPages.mockResolvedValue(pages);
  mocks.readSource.mockResolvedValue(Buffer.from("%PDF-synthetic"));
});

describe("shared application contracts at the Genkit boundary", () => {
  // These complete fixtures were captured with the original Zod 3 dependency.
  // Keep shared browser schemas on zod/v3. Genkit-specific annotations belong
  // to schemas built with Genkit's z; instanceof-based annotation traversal
  // cannot traverse a separate application's Zod instance.
  it.each([
    ["PgrEvidenceSchema", PgrEvidenceSchema],
    ["PgrAnalysisOutputSchema", PgrAnalysisOutputSchema],
    ["ExtractionSchema", ExtractionSchema],
    ["SourceSchema", SourceSchema],
  ] as const)("preserves the complete legacy JSON contract for %s", (name, schema) => {
    expect(jsonSchema(schema)).toEqual(baseline.schemas[name]);
  });

  it("passes the unchanged triage and specialist contracts through the real PGR service", async () => {
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          tipo: "PGR",
          statusClassificacao: "identificado",
          contemDadosClinicosIndividuais: false,
          evidencias: [{ pagina: 1, trecho: "PROGRAMA DE GERENCIAMENTO DE RISCOS" }],
        },
      })
      .mockResolvedValueOnce({
        output: {
          ...parsePgrDocumentPages(pages),
          parecerTecnicoIA:
            "Análise sintética baseada no texto informado, com evidências documentais e revisão humana obrigatória.",
        },
      });

    const result = await analyzePgrDocument({
      pdfDataUri: "data:application/pdf;base64,c3ludGhldGlj",
    });

    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[0][0].output).toEqual({
      jsonSchema: baseline.schemas.VisualClassificationSchema,
    });
    expect(mocks.generate.mock.calls[1][0].output).toEqual({
      jsonSchema: baseline.schemas.PgrModelOutputSchema,
      constrained: false,
      instructions: true,
    });
    expect(result.analiseAgente?.status).toBe("concluida");
    expect(PgrAnalysisOutputSchema.safeParse(result).success).toBe(true);
  });

  it("passes the unchanged extraction contract and retains nulls and defaults in the real route", async () => {
    mocks.generate.mockResolvedValue({ output: emptyExtraction });
    const response = await productionAssistant(request());

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0][0].output).toEqual({
      jsonSchema: baseline.schemas.ExtractionSchema,
    });
    expect(await response.json()).toEqual({
      extraction: { ...emptyExtraction, obligations: [] },
    });
  });

  it("keeps the private source refinement before reads or generation", async () => {
    const response = await productionAssistant(
      request({ ...source, storagePath: "internos_nextcon/contract-sources/another-document" })
    );
    expect(response.status).toBe(400);
    expect(mocks.readSource).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("retains local uniqueness validation that JSON Schema cannot express", async () => {
    const output = { ...emptyExtraction, obligations: [obligation, obligation] };
    const parsed = ExtractionSchema.safeParse(output);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error).toBeInstanceOf(z.ZodError);

    mocks.generate.mockResolvedValue({ output });
    const response = await productionAssistant(request());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("extraction");
  });

  it("validates the production JSON contract in a model-free Genkit flow action", async () => {
    const contract = toGenkitJsonSchema({ jsonSchema: jsonSchema(ExtractionSchema) });
    expect(contract).toEqual(baseline.schemas.ExtractionSchema);
    const handler = vi.fn(async (value: unknown) => ExtractionSchema.parse(value));
    // defineFlow delegates to this action runtime, whose JSON Schema interface
    // validates without comparing separate packages' Zod TypeScript classes.
    const flow = action(
      {
        actionType: "flow",
        name: "shared-production-contract-compatibility",
        inputJsonSchema: contract,
        outputJsonSchema: contract,
      },
      handler
    );

    expect(await flow(emptyExtraction)).toEqual({ ...emptyExtraction, obligations: [] });
    await expect(flow({ ...emptyExtraction, valueCents: -1 })).rejects.toMatchObject({
      status: "INVALID_ARGUMENT",
    });
    const missingRequired: Partial<typeof emptyExtraction> = { ...emptyExtraction };
    delete missingRequired.clientName;
    await expect(flow(missingRequired)).rejects.toMatchObject({ status: "INVALID_ARGUMENT" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("validates PGR evidence and defaults in a model-free Genkit flow action", async () => {
    const contract = toGenkitJsonSchema({ jsonSchema: jsonSchema(PgrAnalysisOutputSchema) });
    expect(contract).toEqual(baseline.schemas.PgrAnalysisOutputSchema);
    const handler = vi.fn(async (value: unknown) => PgrAnalysisOutputSchema.parse(value));
    const flow = action(
      {
        actionType: "flow",
        name: "shared-pgr-contract-compatibility",
        inputJsonSchema: contract,
        outputJsonSchema: contract,
      },
      handler
    );
    const risk = {
      id: "synthetic-risk",
      agente: "Ruído",
      categoria: "fisico",
      setorGhe: "Manutenção",
      evidencia: { pagina: 1, trecho: "Trabalhador exposto a ruído contínuo de motores." },
    };
    const input = { ...parsePgrDocumentPages(pages), riscosIdentificados: [risk] };
    expect((await flow(input)).riscosIdentificados[0]).toEqual({
      ...risk,
      controlesDocumentados: [],
      classificacaoOriginal: "",
    });
    await expect(
      flow({
        ...input,
        riscosIdentificados: [{ ...risk, evidencia: { ...risk.evidencia, pagina: 301 } }],
      })
    ).rejects.toMatchObject({ status: "INVALID_ARGUMENT" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
