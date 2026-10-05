import "server-only";
import { PGR_MAX_FILE_BYTES, type PgrPage } from "@/lib/pgr-schema";

export async function readPgrPdfPages(bytes: Uint8Array): Promise<PgrPage[]> {
  if (bytes.byteLength > PGR_MAX_FILE_BYTES) throw new Error("PDF acima do limite de 12 MB.");
  if (Buffer.from(bytes.subarray(0, 8)).toString("ascii").indexOf("%PDF-") !== 0)
    throw new Error("O arquivo não é um PDF válido.");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    verbosity: 0,
  });
  const timeout = setTimeout(() => {
    void loading.destroy();
  }, 45000);
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 300)
      throw new Error("Divida o documento: o limite é de 300 páginas por análise.");
    const pages: PgrPage[] = [];
    let chars = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let texto = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 3) texto += "\n";
        texto += item.str + (item.hasEOL ? "\n" : " ");
        lastY = y;
      }
      chars += texto.length;
      if (chars > 1000000)
        throw new Error("Documento com texto acima do limite; divida em unidades ou seções.");
      pages.push({ numero: n, texto: texto.trim() });
      page.cleanup();
    }
    return pages;
  } finally {
    clearTimeout(timeout);
    await loading.destroy();
  }
}
