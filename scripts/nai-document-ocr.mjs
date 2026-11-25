import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";
import { parentPort, workerData } from "node:worker_threads";
import { createOCREngine } from "tesseract-wasm";

const require = createRequire(import.meta.url);
const edge = 2050;
const maxPixels = 30000000;

async function recognize(engine, bytes, mime, renderer) {
  if (mime !== "application/pdf") {
    const { default: sharp } = renderer;
    const { data, info } = await sharp(bytes, { limitInputPixels: maxPixels })
      .rotate()
      .resize({ width: edge, height: edge, fit: "inside" })
      .flatten({ background: "#fff" })
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    engine.loadImage({ data, width: info.width, height: info.height });
    return { status: "ok", texts: [engine.getText().slice(0, 24000)] };
  }
  const { getDocument } = renderer;
  const loading = getDocument({
    data: new Uint8Array(bytes),
    maxImageSize: maxPixels,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 3) return { status: "page_limit" };
    const texts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: edge / Math.max(original.width, original.height),
      });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      const surface = pdf.canvasFactory.create(width, height);
      try {
        await page.render({ canvasContext: surface.context, viewport }).promise;
        engine.loadImage(surface.context.getImageData(0, 0, width, height));
        texts.push(engine.getText().slice(0, 24000));
      } finally {
        pdf.canvasFactory.destroy(surface);
        page.cleanup();
      }
    }
    return { status: "ok", texts };
  } finally {
    await loading.destroy();
  }
}

let failure = "dependency";
try {
  const wasm = new URL("./tesseract-core.wasm", import.meta.resolve("tesseract-wasm"));
  const model = require.resolve("@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz");
  const engine = await createOCREngine({ wasmBinary: await readFile(wasm) });
  try {
    engine.loadModel(gunzipSync(await readFile(model)));
    const mime = workerData.mime;
    if (mime === "application/pdf") {
      require("@napi-rs/canvas");
      require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    }
    const renderer =
      mime === "application/pdf"
        ? await import("pdfjs-dist/legacy/build/pdf.mjs")
        : await import("sharp");
    failure = "failed";
    parentPort.postMessage(await recognize(engine, Buffer.from(workerData.bytes), mime, renderer));
  } finally {
    engine.destroy();
  }
} catch {
  parentPort.postMessage({ status: failure });
}
