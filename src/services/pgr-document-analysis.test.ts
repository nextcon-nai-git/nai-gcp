import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzePgrDocument } from "./pgr-document-analysis";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mocks.generate } }));
const text =
  "RAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70\nRECONHECIMENTO DE RISCOS AMBIENTAIS\nMANUTENÇÃO\nTrabalhador exposto a ruído contínuo de motores.";
beforeEach(() => {
  mocks.generate.mockReset();
  vi.stubEnv("GOOGLE_GENAI_API_KEY", "test-key");
});
afterEach(() => vi.unstubAllEnvs());
describe("IA PGR com limites", () => {
  it("não aceita AVP retornado pela IA contra a identificação do PDF", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.pgrCardDetalhado.razaoSocial = "AVP";
    output.pgrCardDetalhado.cnpj = "44.337.647/0001-89";
    mocks.generate.mockResolvedValue({ output });
    const a = await analyzePgrDocument({ pdfDataUri: text, fileName: "PGR_AVP.pdf" });
    expect(a.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(a.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
  });
  it("descarta risco sem trecho existente na página citada", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.riscosIdentificados = [
      {
        id: "fake",
        agente: "Benzeno",
        categoria: "quimico",
        setorGhe: "laboratório",
        evidencia: { pagina: 1, trecho: "Exposição a benzeno 90 ppm" },
        controlesDocumentados: [],
        classificacaoOriginal: "",
      },
    ];
    mocks.generate.mockResolvedValue({ output });
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.riscosIdentificados.some((r) => r.agente === "Benzeno")).toBe(false);
  });
  it("falha da IA preserva cliente e marca somente extração documental", async () => {
    mocks.generate.mockRejectedValue(new Error("Unavailable"));
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(a.leitura.modo).toBe("extracao_documental");
    expect(a.leitura.avisos.join(" ")).toContain("não concluiu");
    expect(a.pgrCardDetalhado.dataEmissao).toBe("");
  });
  it("resultado inválido não cria conclusão técnica fictícia", async () => {
    mocks.generate.mockResolvedValue({ output: {} });
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.leitura.modo).toBe("extracao_documental");
    expect(a.parecerTecnicoIA).not.toContain("auditado com sucesso");
  });
  it("não transforma conceitos ou ausência de exposição em risco documentado", async () => {
    const source =
      "RAZÃO SOCIAL: CETESB\nCNPJ: 43.776.491/0001-70\nCONCEITOS DE RISCOS AMBIENTAIS\nExposição a ruído é um exemplo de perigo físico.";
    const output = parsePgrDocumentPages([{ numero: 1, texto: source }]);
    output.riscosIdentificados = [
      {
        id: "glossary",
        agente: "Ruído",
        categoria: "fisico",
        setorGhe: "",
        evidencia: { pagina: 1, trecho: "Exposição a ruído é um exemplo de perigo físico." },
        controlesDocumentados: [],
        classificacaoOriginal: "",
      },
    ];
    mocks.generate.mockResolvedValue({ output });
    expect((await analyzePgrDocument({ pdfDataUri: source })).riscosIdentificados).toHaveLength(0);
  });
  it("preserva evidência documental quando a IA omite riscos e recusa controles inventados", async () => {
    const output = parsePgrDocumentPages([{ numero: 1, texto: text }]);
    output.riscosIdentificados[0].controlesDocumentados = ["EPC certificado instalado"];
    output.riscosIdentificados[0].classificacaoOriginal = "Risco crítico validado";
    mocks.generate.mockResolvedValue({ output });
    const a = await analyzePgrDocument({ pdfDataUri: text });
    expect(a.riscosIdentificados[0].controlesDocumentados).toEqual([]);
    expect(a.riscosIdentificados[0].classificacaoOriginal).toBe("");
    output.riscosIdentificados = [];
    mocks.generate.mockResolvedValue({ output });
    expect(
      (await analyzePgrDocument({ pdfDataUri: text })).riscosIdentificados.length
    ).toBeGreaterThan(0);
  });
});
