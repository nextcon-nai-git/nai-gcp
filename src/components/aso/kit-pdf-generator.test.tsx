import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const mock = vi.hoisted(() => ({ generate: vi.fn(), save: vi.fn() }));
vi.mock("@/services/occupational-kit-pdf", () => ({
  EMPTY_KIT_REGISTRATION: {
    registration: "",
    birthDate: "",
    admissionDate: "",
    unit: "",
    companyAddress: "",
    pcmsoDoctor: "",
    pcmsoCrm: "",
  },
  generateOccupationalKitPdf: mock.generate,
  occupationalKitFilename: () => "Kit-Teste.pdf",
}));
import { KitPdfGenerator } from "./kit-pdf-generator";
import type { DigitalKit } from "@/types/aso-scheduler-types";
const kit = {
  clinicDetails: { name: "Clínica Teste", address: "Local Teste", phone: "" },
  appointmentDateTime: "A confirmar",
} as DigitalKit;
let view: ReturnType<typeof ui>;
afterEach(async () => {
  await view?.cleanup();
  vi.clearAllMocks();
});
describe("Download do kit", () => {
  it("exige conferência, gera com os complementos e não indica envio", async () => {
    mock.generate.mockReturnValue({ save: mock.save });
    view = ui();
    await view.render(<KitPdfGenerator kit={kit} />);
    expect(view.button("Baixar kit completo em PDF").disabled).toBe(true);
    await view.input("input", "1234");
    await act(async () =>
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    );
    await view.click("Baixar kit completo em PDF");
    expect(mock.generate.mock.calls[0][1].registration).toBe("1234");
    expect(mock.save).toHaveBeenCalledWith("Kit-Teste.pdf");
    expect(document.body.textContent).toContain("não registra pedido no SOC");
    await view.input("input", "5678");
    expect(view.button("Baixar kit completo em PDF").disabled).toBe(true);
  });
  it("exibe falha e permite tentar novamente", async () => {
    mock.generate.mockImplementation(() => {
      throw new Error("PDF failure");
    });
    view = ui();
    await view.render(<KitPdfGenerator kit={kit} />);
    await act(async () =>
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    );
    await view.click("Baixar kit completo em PDF");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("tente novamente");
    expect(view.button("Baixar kit completo em PDF").disabled).toBe(false);
  });
});
