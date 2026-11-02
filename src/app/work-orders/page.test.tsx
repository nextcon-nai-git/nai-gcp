import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  toast: vi.fn(),
  download: vi.fn(),
  message: vi.fn().mockReturnValue("Minuta%20para%20revisar"),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/services/documents/work-order-pdf-generator", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadWorkOrderPdf: m.download,
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
async function fill() {
  await v.input("#nome", "Pessoa Sintética");
  await v.input("#cpf", "529.982.247-25");
  await v.input("#empresa-razaoSocial", "Cliente Alfa");
  await v.input("#empresa-cnpj", "11.222.333/0001-81");
  await v.input("#cargo", "Assistente");
  await v.input("#pgr", "PGR Cliente Alfa");
  await v.input("#atividades", "Atividade informada");
}
describe("Minuta genérica de Ordem de Serviço", () => {
  it("não exibe dados nem controles exclusivos de um cliente", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).not.toMatch(
      /construfam|chesf|statkraft|embarcado|arrais|colete/i
    );
    expect(v.container.textContent).toContain("não significa ausência de riscos");
  });
  it.each(["Baixar minuta PDF", "Preparar WhatsApp", "Imprimir"])(
    "bloqueia %s sem os dados básicos",
    async (action) => {
      await v.render(<Page />);
      await v.click(action);
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Confira os dados da minuta" })
      );
      expect(m.download).not.toHaveBeenCalled();
      expect(window.open).not.toHaveBeenCalled();
      expect(window.print).not.toHaveBeenCalled();
    }
  );
  it("usa os dados editados do cliente, riscos, EPIs e emergência na prévia e no PDF", async () => {
    await v.render(<Page />);
    await fill();
    await v.input("#empresa-razaoSocial", "Cliente Beta");
    await v.input("#pgr", "PGR Cliente Beta");
    await v.click("Adicionar risco");
    await v.input("#risco-0-fatorRisco", "Risco informado");
    await v.input("#medidas-0", "Medida informada");
    await v.click("Adicionar EPI");
    await v.input("#epi-0-equipamento", "Equipamento informado");
    await v.input("#emergencia", "Contato local de emergência");
    await v.click("Baixar minuta PDF");
    expect(m.download).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa: expect.objectContaining({ razaoSocial: "Cliente Beta" }),
        versaoPgr: "PGR Cliente Beta",
        riscosIdentificados: [
          expect.objectContaining({
            fatorRisco: "Risco informado",
            medidasPrevenconais: "Medida informada",
          }),
        ],
        episObrigatorios: [expect.objectContaining({ equipamento: "Equipamento informado" })],
        procedimentosEmergencia: ["Contato local de emergência"],
      })
    );
    const preview = v.container.querySelector("#work-order-preview")!.textContent;
    expect(preview).toContain("Cliente Beta");
    expect(preview).not.toContain("Cliente Alfa");
    expect(preview).toContain("Medida informada");
  });
  it("nova ordem limpa os dados técnicos e a empresa anterior", async () => {
    await v.render(<Page />);
    await fill();
    await v.click("Adicionar risco");
    await v.click("Nova ordem de serviço");
    expect((v.container.querySelector("#nome") as HTMLInputElement).value).toBe("");
    expect((v.container.querySelector("#empresa-razaoSocial") as HTMLInputElement).value).toBe("");
    expect(v.container.querySelector("#risco-0-fatorRisco")).toBeNull();
  });
  it("informa falha do PDF e permite nova tentativa", async () => {
    await v.render(<Page />);
    await fill();
    m.download.mockImplementationOnce(() => {
      throw new Error("PDF indisponível");
    });
    await v.click("Baixar minuta PDF");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Operação não concluída", description: "PDF indisponível" })
    );
    expect(v.button("Baixar minuta PDF").disabled).toBe(false);
    await v.click("Baixar minuta PDF");
    expect(m.download).toHaveBeenCalledTimes(2);
  });
  it("prepara WhatsApp sem confirmar envio e imprime após validação", async () => {
    await v.render(<Page />);
    await fill();
    await v.input("#phone", "+55 (11) 99999-0000");
    await v.click("Preparar WhatsApp");
    expect(window.open).toHaveBeenCalledWith(
      "https://wa.me/5511999990000?text=Minuta%20para%20revisar",
      "_blank",
      "noopener,noreferrer"
    );
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining("não confirmou entrega") })
    );
    await v.click("Imprimir");
    expect(window.print).toHaveBeenCalledOnce();
  });
});
