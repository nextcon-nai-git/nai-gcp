import { jsPDF } from "jspdf";
import sharp from "sharp";

// Painted glyphs (not a PDF text layer) exercise the Portuguese model and the PDF renderer.
export async function makeAsoScan() {
  const lines = [
    "ASO - Atestado de Saúde Ocupacional",
    "Razão Social: Empresa de Ensaio",
    "CNPJ: 98.765.432/0000-07",
    "Funcionário",
    "Nome:",
    "Pessoa Ficticia Alfa",
    "Cargo: Analista | Resultado: CONFIDENCIAL",
    "Setor: Arquivo",
    "Tipo de exame",
    "Admissional",
    "Periódico",
    "Demissional",
    "Médico responsável pelo PCMSO",
    "Nome: Profissional Ficticio Beta",
  ];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1100"><rect width="100%" height="100%" fill="white"/>' +
    lines
      .map(
        (line, i) =>
          `<text x="50" y="${80 + i * 70}" font-size="38" font-family="sans-serif">${line}</text>`
      )
      .join("") +
    "</svg>";
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const pdf = new jsPDF();
  pdf.addImage(new Uint8Array(png), "PNG", 10, 20, 190, 150);
  const scan = Buffer.from(pdf.output("arraybuffer"));
  pdf.text("ASO - Atestado de Saude Ocupacional - Periodico", 10, 12);
  return { png, scan, pdf: Buffer.from(pdf.output("arraybuffer")) };
}
