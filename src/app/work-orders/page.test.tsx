import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  toast: vi.fn(),
  download: vi.fn(),
  message: vi.fn().mockReturnValue("Minuta%20para%20revisar"),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/services/documents/construfam-os-pdf-generator", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  downloadConstrufamOsPdf: m.download,
  getWhatsAppOsDispatchMessage: m.message,
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.toast.mockReset();
  m.download.mockReset();
  m.message.mockClear();
  vi.spyOn(window, "open").mockImplementation(() => null);
  vi.spyOn(window, "print").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
async function identity() {
  await v.input("#nome", "Pessoa Sintética");
  await v.input("#cpf", "529.982.247-25");
}
describe("Work order draft actions", () => {
  it.each(["Baixar minuta PDF", "Enviar WhatsApp", "Imprimir"])(
    "blocks %s without valid identity",
    async (action) => {
      await v.render(<Page />);
      await v.input("#nome", "AB");
      await v.click(action);
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Confira os dados do colaborador" })
      );
      expect(m.download).not.toHaveBeenCalled();
      expect(window.open).not.toHaveBeenCalled();
      expect(window.print).not.toHaveBeenCalled();
    }
  );
  it("keeps edited employee fields in the generated draft", async () => {
    await v.render(<Page />);
    await identity();
    const edits = {
      matricula: "TEST-1",
      cargo: "Função sintética",
      colete: "CV-TEST",
      arrais: "DOC-TEST",
      dataAdmissao: "01/10/2026",
      dataEmissao: "18/10/2026",
    };
    for (const [key, value] of Object.entries(edits)) await v.input("#" + key, value);
    await v.click("Baixar minuta PDF");
    expect(m.download).toHaveBeenCalledWith(
      expect.objectContaining({
        colaborador: expect.objectContaining({
          nome: "Pessoa Sintética",
          cpf: "529.982.247-25",
          matricula: "TEST-1",
          cargo: "Função sintética",
          numeroColeteSalvaVidas: "CV-TEST",
          registroArrais: "DOC-TEST",
          dataAdmissao: "01/10/2026",
          dataEmissaoOs: "18/10/2026",
        }),
      })
    );
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Minuta PDF gerada" })
    );
    expect(v.container.textContent).toContain("não representa emissão ou assinatura digital");
  });
  it.each(["HIDROMETRISTA...", "AUXILIAR...", "TOPÓGRAFO...", "OPERADOR..."])(
    "changes the role without inventing a license: %s",
    async (preset) => {
      await v.render(<Page />);
      await v.input("#arrais", "Old license");
      await v.click(preset);
      expect((v.container.querySelector("#arrais") as HTMLInputElement).value).toBe("");
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Preset Aplicado" })
      );
    }
  );
  it("reports PDF failure and allows retry", async () => {
    await v.render(<Page />);
    await identity();
    m.download.mockImplementationOnce(() => {
      throw new Error("PDF indisponível");
    });
    await v.click("Baixar minuta PDF");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro ao gerar PDF", description: "PDF indisponível" })
    );
    expect(v.button("Baixar minuta PDF").disabled).toBe(false);
    await v.click("Baixar minuta PDF");
    expect(m.download).toHaveBeenCalledTimes(2);
  });
  it("opens only a prepared conversation and does not claim delivery", async () => {
    await v.render(<Page />);
    await identity();
    await v.input("#phone", "+55 (11) 99999-0000");
    await v.click("Enviar WhatsApp");
    expect(window.open).toHaveBeenCalledWith(
      "https://wa.me/5511999990000?text=Minuta%20para%20revisar",
      "_blank"
    );
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining("não confirmou entrega") })
    );
    await v.input("#phone", "55");
    await v.click("Disparar");
    expect(window.open).toHaveBeenLastCalledWith(
      "https://wa.me/?text=Minuta%20para%20revisar",
      "_blank"
    );
  });
  it("prints only after validation and restores the original draft fields", async () => {
    await v.render(<Page />);
    const original = (v.container.querySelector("#nome") as HTMLInputElement).value;
    await identity();
    await v.click("Imprimir");
    expect(window.print).toHaveBeenCalledOnce();
    await v.click("Restaurar Padrão PGR Construfam");
    expect((v.container.querySelector("#nome") as HTMLInputElement).value).toBe(original);
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Padrão Restaurado" })
    );
  });
});
