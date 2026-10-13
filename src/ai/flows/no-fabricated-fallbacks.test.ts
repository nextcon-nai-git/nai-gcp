import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/ai-action", () => ({
  requireAiAction: mock.auth,
  CLINICAL_AI_ROLES: ["DOCTOR"],
  DOCUMENT_AI_ROLES: ["ENGINEER"],
}));
vi.mock("@/ai/genkit", () => ({
  ai: {
    generate: mock.generate,
    definePrompt: () => mock.generate,
    defineFlow: (_config: unknown, handler: unknown) => handler,
  },
}));
import { analyzeFieldInspectionPhoto } from "./field-inspection-flow";
import { runEsocialCrossAudit } from "./esocial-cross-audit-flow";
import { analyzePcmsoPdf } from "./pcmso-analysis-flow";
import { analyzeLtcatPdf } from "./ltcat-analysis-flow";
import { classifyDocument } from "./document-classifier-flow";
import { extractMedicalCertificate } from "./extract-medical-certificate-flow";
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({});
  mock.generate.mockRejectedValue(new Error("private provider details"));
});
it("does not fabricate inspection findings when generation fails", async () => {
  await expect(analyzeFieldInspectionPhoto({ notes: "Synthetic inspection" })).rejects.toThrow(
    "Nenhum achado"
  );
});
it("does not manufacture representative employees without source data", async () => {
  await expect(runEsocialCrossAudit({ companyName: "Synthetic company" })).rejects.toThrow(
    "Forneça dados"
  );
  expect(mock.generate).not.toHaveBeenCalled();
});
it("does not fabricate fines when the provider fails", async () => {
  await expect(
    runEsocialCrossAudit({
      companyName: "Synthetic company",
      employeesData: [
        { name: "Synthetic", cpf: "", role: "Test", sector: "Test", hazards: [], examsDone: [] },
      ],
    })
  ).rejects.toThrow("Nenhum resultado");
});

it.each([
  ["PCMSO", analyzePcmsoPdf, "nenhum protocolo médico"],
  ["LTCAT", analyzeLtcatPdf, "nenhuma medição"],
  ["classificador", classifyDocument, "não foram presumidos"],
] as const)(
  "%s informa falha sem fabricar resultado ou vazar erro do provedor",
  async (_name, analyze, message) => {
    const input = {
      pdfDataUri: "data:application/pdf;base64,aGVsbG8=",
      fileName: "PGR_CLIENTE_2026.pdf",
    };
    await expect(analyze(input)).rejects.toThrow(message);
    mock.generate.mockResolvedValueOnce({ output: {} });
    await expect(analyze(input)).rejects.toThrow(message);
  }
);

it("classificação ambígua não pode ser protocolada como documento técnico", async () => {
  mock.generate.mockResolvedValueOnce({
    output: {
      docType: "nao_identificado",
      companyName: "",
      docDate: "",
      confidence: 0,
      reasoning: "Documento ilegível ou fora das categorias técnicas.",
    },
  });
  await expect(
    classifyDocument({ pdfDataUri: "data:application/pdf;base64,aGVsbG8=" })
  ).rejects.toThrow("não foi concluída");
});

const certificateText = `ATESTADO MÉDICO
Paciente: PESSOA SINTÉTICA
Necessita de 5 dias de repouso.
CID: M54.5
Data de emissão: 10/05/2025`;
const certificateOutput = {
  nomePaciente: "PESSOA SINTÉTICA",
  diasAfastamento: 5,
  cid: "M54.5",
  dataAtestado: "2025-05-10",
};

it("atestado indisponível não fabrica nome, CID, data ou dias de afastamento", async () => {
  await expect(extractMedicalCertificate(certificateText)).rejects.toThrow("não foram presumidos");
});

it("preserva os campos de atestado sustentados pelo texto e validados", async () => {
  mock.generate.mockResolvedValueOnce({ output: certificateOutput });
  await expect(extractMedicalCertificate(certificateText)).resolves.toEqual(certificateOutput);
});

it.each([
  null,
  {},
  { ...certificateOutput, diasAfastamento: -1 },
  { ...certificateOutput, diasAfastamento: 1.5 },
  { ...certificateOutput, dataAtestado: "2025-02-30" },
])("atestado com resposta inválida não vira registro: %j", async (output) => {
  mock.generate.mockResolvedValueOnce({ output });
  await expect(extractMedicalCertificate(certificateText)).rejects.toThrow("não foram presumidos");
});

it.each([
  ["sem nome", certificateText.replace("Paciente: PESSOA SINTÉTICA\n", "")],
  ["sem dias", certificateText.replace("Necessita de 5 dias de repouso.\n", "")],
  ["prazo diferente", certificateText.replace("5 dias de repouso", "3 dias de repouso")],
  ["prazo ambíguo", certificateText + "\nAfastamento de 3 dias."],
  ["sem emissão", certificateText.replace("Data de emissão: 10/05/2025", "")],
  ["somente nascimento", certificateText.replace("Data de emissão", "Data de nascimento")],
  ["somente consulta", certificateText.replace("Data de emissão", "Data da consulta")],
  ["data diferente", certificateText.replace("10/05/2025", "11/05/2025")],
  ["CID não documentado", certificateText.replace("CID: M54.5\n", "")],
])("recusa campos propostos sem evidência: %s", async (_case, text) => {
  mock.generate.mockResolvedValueOnce({ output: certificateOutput });
  await expect(extractMedicalCertificate(text)).rejects.toThrow("sem evidência suficiente");
});
