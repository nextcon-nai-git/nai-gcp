import "server-only";
import { parseBalancePages, type BalanceTextItem } from "@/lib/financial/balance";

export async function extractBalancePdf(bytes: Buffer) {
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
  }, 30000);
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 20) throw new Error("Use um balanço de até 20 páginas.");
    const pages: BalanceTextItem[][] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages.push(
        content.items.flatMap((item) =>
          "str" in item ? [{ text: item.str, x: item.transform[4], y: item.transform[5] }] : []
        )
      );
      page.cleanup();
    }
    return parseBalancePages(pages);
  } finally {
    clearTimeout(timeout);
    await loading.destroy();
  }
}
