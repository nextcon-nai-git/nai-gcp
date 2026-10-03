// @vitest-environment node
import DefaultJsPDF, { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";

describe("PDF runtime compatibility", () => {
  it("keeps proposal generation and Blob upload compatible with the default import", async () => {
    const pdf = new DefaultJsPDF();
    pdf.setFont("helvetica", "bold");
    pdf.text("Proposta Tecnica SST", 105, 25, { align: "center" });
    const blob = pdf.output("blob");
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
    expect(await blob.text()).toContain("Proposta Tecnica SST");
  });

  it("keeps receipt drawing, text wrapping and inline image evidence compatible", () => {
    const pdf = new jsPDF();
    pdf.setFillColor(0, 53, 107);
    pdf.rect(0, 0, 210, 40, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text("Controle EPIs NAI", 105, 25, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.text("Comprovante de entrega de equipamento e treinamento.", 20, 130, { maxWidth: 170 });
    // Synthetic RGBA evidence avoids reading files or depending on the network.
    pdf.addImage({
      imageData: { data: new Uint8ClampedArray([0, 53, 107, 255]), width: 1, height: 1 },
      format: "RGBA",
      x: 75,
      y: 150,
      width: 60,
      height: 45,
    });
    const result = pdf.output();
    expect(result.startsWith("%PDF-")).toBe(true);
    expect(result).toContain("/Subtype /Image");
    expect(result).toContain("Controle EPIs NAI");
    expect(result.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf.getNumberOfPages()).toBe(1);
  });
});
