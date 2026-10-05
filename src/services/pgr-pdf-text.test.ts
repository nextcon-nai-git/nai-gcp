// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { deflateSync } from "node:zlib";
import { readPgrPdfPages } from "./pgr-pdf-text";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
vi.mock("server-only", () => ({}));
function compressedPdf() {
  const text =
    "BT /F1 10 Tf 50 760 Td (RAZAO SOCIAL: CLIENTE ALFA) Tj 0 -20 Td (CNPJ: 43.776.491/0001-70) Tj ET";
  const stream = deflateSync(Buffer.from(text));
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
    ),
    Buffer.concat([
      Buffer.from("<< /Length " + stream.length + " /Filter /FlateDecode >>\nstream\n"),
      stream,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];
  let bytes = Buffer.from("%PDF-1.7\n% AVP is metadata, not the client\n");
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(bytes.length);
    bytes = Buffer.concat([bytes, Buffer.from(i + 1 + " 0 obj\n"), obj, Buffer.from("\nendobj\n")]);
  });
  const xref = bytes.length;
  return new Uint8Array(
    Buffer.concat([
      bytes,
      Buffer.from(
        "xref\n0 6\n0000000000 65535 f \n" +
          offsets
            .slice(1)
            .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
            .join("") +
          "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
          xref +
          "\n%%EOF"
      ),
    ])
  );
}
describe("leitura PDF real", () => {
  it("descomprime texto e ignora AVP nos bytes de metadados", async () => {
    const pages = await readPgrPdfPages(compressedPdf());
    const a = parsePgrDocumentPages(pages);
    expect(pages).toHaveLength(1);
    expect(a.pgrCardDetalhado.razaoSocial).toBe("CLIENTE ALFA");
    expect(a.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
  });
  it("recusa binário que não seja PDF", async () => {
    await expect(readPgrPdfPages(new TextEncoder().encode("AVP not a PDF"))).rejects.toThrow(
      "PDF válido"
    );
  });
});
