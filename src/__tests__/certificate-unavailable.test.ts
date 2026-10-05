import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), prompt: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/ai/genkit", () => ({
  ai: {
    definePrompt: () => mock.prompt,
    defineFlow: (_config: unknown, handler: unknown) => handler,
  },
}));
import { validateMedicalCertificate } from "@/ai/flows/medical-certificate-validator-flow";
const input = { fileDataUri: "data:application/pdf;base64,c3ludGhldGlj", idToken: "synthetic" };
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ role: "DOCTOR" });
});
afterEach(() => vi.useRealTimers());
describe("Atestado inconclusivo em falha de IA", () => {
  it("falha do provedor não cria médico, CID ou autenticidade", async () => {
    mock.prompt.mockRejectedValueOnce(new Error("Synthetic provider error"));
    const result = await validateMedicalCertificate(input);
    expect(result).toMatchObject({
      authenticity: "inconclusive",
      confidence: 0,
      extractedData: {},
      redFlags: [],
    });
    expect(result.reasoning).toContain("revisão humana");
  });
  it("tempo esgotado preserva o resultado inconclusivo", async () => {
    vi.useFakeTimers();
    mock.prompt.mockImplementationOnce(() => new Promise(() => {}));
    const result = validateMedicalCertificate(input);
    await vi.advanceTimersByTimeAsync(30001);
    expect((await result).authenticity).toBe("inconclusive");
  });
  it("recusa RH antes de enviar documento ao provedor", async () => {
    mock.auth.mockResolvedValueOnce({ role: "HR" });
    await expect(validateMedicalCertificate(input)).rejects.toThrow("perfil");
    expect(mock.prompt).not.toHaveBeenCalled();
  });
  it("retorno fora do contrato não é tratado como análise válida", async () => {
    mock.prompt.mockResolvedValueOnce({
      output: {
        authenticity: "legitimate",
        confidence: 101,
        extractedData: {},
        redFlags: [],
        reasoning: "Synthetic",
      },
    });
    expect((await validateMedicalCertificate(input)).authenticity).toBe("inconclusive");
  });
});
