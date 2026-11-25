// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { makeAsoScan } from "../../tests/fixtures/nai-scan.mjs";
import { analyzePgrDocument } from "./pgr-document-analysis";
import { canAccessClinicalImport } from "@/lib/auth/require-pgr-access";
import { assertPgrAnalysisReady } from "@/lib/pgr-save-plan";
import { NaiImportAnalysisSchema } from "@/lib/pgr-schema";
import type { AuthContext } from "@/lib/auth/auth-context";
import { readNaiScan } from "./nai-document-ocr";

const generate = vi.hoisted(() => vi.fn());
vi.mock("./pgr-ai-provider", () => ({ getPgrAi: () => ({ generate }) }));
const denied = Object.assign(new Error("Fictional provider refusal"), { status: 403 });
describe("OCR local do NAI importa", () => {
  it("recupera os campos depois de 403 na triagem ou no especialista com o leitor real", async () => {
    const { png, pdf, scan } = await makeAsoScan();
    for (const [mime, bytes, specialist] of [
      ["image/png", png, false],
      ["application/pdf", pdf, false],
      ["application/pdf", scan, false],
      ["image/png", png, true],
    ] as const) {
      generate.mockReset().mockRejectedValue(denied);
      if (specialist)
        generate.mockResolvedValueOnce({
          output: {
            tipo: "ASO",
            statusClassificacao: "identificado",
            contemDadosClinicosIndividuais: true,
            evidencias: [{ pagina: 1, trecho: "ASO" }],
          },
        });
      const result = NaiImportAnalysisSchema.parse(
        await analyzePgrDocument({
          pdfDataUri: `data:${mime};base64,${bytes.toString("base64")}`,
          allowClinical: canAccessClinicalImport({ role: "DOCTOR" } as AuthContext),
        })
      );
      expect(result.documento).toMatchObject({ tipo: "ASO", acesso: "clinico_restrito" });
      expect(result.analiseAgente).toMatchObject({ status: "indisponivel" });
      expect(result.pgrCardDetalhado.razaoSocial).toBe("Empresa de Ensaio");
      // Some fonts render the J as a parenthesis in OCR. Never infer a fiscal identity.
      expect(["", "98.765.432/0000-07"]).toContain(result.pgrCardDetalhado.cnpj);
      expect(result.leitura).toMatchObject({ ocrLocal: true, tipoExamePendente: true });
      expect(result.leitura.camposAso).toEqual([
        { pagina: 1, trecho: "Nome: Pessoa Ficticia Alfa" },
        { pagina: 1, trecho: "Cargo: Analista" },
        { pagina: 1, trecho: "Setor: Arquivo" },
      ]);
      expect(generate).toHaveBeenCalledTimes(specialist ? 2 : 1);
      expect(() => assertPgrAnalysisReady(result)).toThrow("análise do agente");
    }
    generate.mockReset().mockRejectedValue(denied);
    await expect(
      analyzePgrDocument({
        pdfDataUri: "data:application/pdf;base64," + pdf.toString("base64"),
        allowClinical: canAccessClinicalImport({ role: "OPERATIONS" } as AuthContext),
      })
    ).rejects.toMatchObject({ status: 403 });
  }, 100000);
  it("distingue limite de páginas e leitor ocupado", async () => {
    const { png } = await makeAsoScan();
    const uri = "data:image/png;base64," + png.toString("base64");
    expect(await readNaiScan(uri, 4)).toEqual({ status: "page_limit" });
    const reading = readNaiScan(uri, 1);
    expect(await readNaiScan(uri, 1)).toEqual({ status: "busy" });
    expect((await reading).status).toBe("ok");
  }, 45000);
});
