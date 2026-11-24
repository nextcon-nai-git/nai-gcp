// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import sharp from "sharp";
import { readNaiScan } from "./nai-document-ocr";

vi.mock("server-only", () => ({}));

describe("OCR local do NAI importa", () => {
  it("lê o título impresso em imagem e em PDF sem camada de texto", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360"><rect width="100%" height="100%" fill="white"/><text x="60" y="130" font-family="sans-serif" font-size="64">ASO - Atestado de Saude</text><text x="60" y="230" font-family="sans-serif" font-size="64">Ocupacional</text></svg>'
    );
    const png = await sharp(svg).png().toBuffer();
    const photo = "data:image/png;base64," + png.toString("base64");
    const pdf = new jsPDF();
    pdf.addImage(new Uint8Array(png), "PNG", 10, 15, 180, 54);
    const scan = Buffer.from(pdf.output("arraybuffer")).toString("base64");
    for (const input of [photo, "data:application/pdf;base64," + scan]) {
      const [text] = await readNaiScan(input);
      expect(text).toMatch(/atestado/i);
      expect(text).toMatch(/ocupacional/i);
    }
  }, 85000);
});
