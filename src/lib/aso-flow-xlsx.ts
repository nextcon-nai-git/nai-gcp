import type { JSZipObject, JSZipStreamHelper } from "jszip";

/** Limits apply to the ZIP container before ExcelJS allocates worksheet objects. */
export const ASO_XLSX_EXPANDED_LIMIT = 32 * 1024 * 1024;
export const ASO_XLSX_ENTRY_LIMIT = 512;

const invalidArchive = () =>
  new Error("XLSX inválido ou não suportado. Exporte a aba de dados para um novo XLSX ou CSV.");
const expandedLimit = () =>
  new Error("O XLSX excede 32 MB após descompactação. Exporte apenas a aba de dados para CSV.");
const entriesLimit = () =>
  new Error("O XLSX contém componentes demais. Exporte apenas a aba de dados para CSV.");

// Documented by JSZip, but omitted from JSZipObject in its bundled declarations:
// https://stuk.github.io/jszip/documentation/api_zipobject/internal_stream.html
type StreamingZipEntry = JSZipObject & {
  internalStream(type: "uint8array"): JSZipStreamHelper<Uint8Array>;
};
function hasEntryStream(entry: JSZipObject): entry is StreamingZipEntry {
  return "internalStream" in entry && typeof entry.internalStream === "function";
}

/**
 * Read the bounded ZIP32 directory before JSZip creates entries. XLSX imports do
 * not need ZIP64, encrypted archives or multiple disks. Check actual directory
 * records as well as the claimed count, which an untrusted file can understate.
 */
function checkZipDirectory(bytes: ArrayBuffer): void {
  const view = new DataView(bytes);
  let end = -1;
  for (
    let offset = bytes.byteLength - 4;
    offset >= Math.max(0, bytes.byteLength - 65557);
    offset--
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  // JSZip selects the last signature. Never validate an earlier directory when
  // a second archive/signature inside the comment would make it parse another.
  if (
    end < 0 ||
    end + 22 > bytes.byteLength ||
    end + 22 + view.getUint16(end + 20, true) !== bytes.byteLength
  )
    throw invalidArchive();
  const expectedCount = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryStart = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== expectedCount ||
    expectedCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryStart === 0xffffffff ||
    directoryStart + directorySize !== end
  )
    throw invalidArchive();
  if (expectedCount > ASO_XLSX_ENTRY_LIMIT) throw entriesLimit();

  let count = 0;
  let declaredBytes = 0;
  let offset = directoryStart;
  while (offset < end) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw invalidArchive();
    if (++count > ASO_XLSX_ENTRY_LIMIT) throw entriesLimit();
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const compressedBytes = view.getUint32(offset + 20, true);
    const expandedBytes = view.getUint32(offset + 24, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (
      flags & 1 ||
      (compression !== 0 && compression !== 8) ||
      compressedBytes === 0xffffffff ||
      expandedBytes === 0xffffffff ||
      view.getUint16(offset + 34, true) !== 0 ||
      localOffset + 30 > directoryStart ||
      view.getUint32(localOffset, true) !== 0x04034b50 ||
      view.getUint16(localOffset + 6, true) & 1 ||
      view.getUint16(localOffset + 8, true) !== compression
    )
      throw invalidArchive();
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    if (dataStart + compressedBytes > directoryStart) throw invalidArchive();
    declaredBytes += expandedBytes;
    if (declaredBytes > ASO_XLSX_EXPANDED_LIMIT) throw expandedLimit();
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    if (offset > end) throw invalidArchive();
  }
  if (!count || count !== expectedCount) throw invalidArchive();
}

export async function assertSafeAsoXlsx(bytes: ArrayBuffer): Promise<void> {
  checkZipDirectory(bytes);
  const { default: JSZip } = await import("jszip");
  // CRC checking here would eagerly inflate every entry before the budget runs.
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
  const entries = Object.values(zip.files);
  if (entries.length > ASO_XLSX_ENTRY_LIMIT) throw entriesLimit();
  let expandedBytes = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    if (!hasEntryStream(entry)) throw invalidArchive();
    // ZIP sizes are attacker-controlled. Count real output without collecting it
    // into a string/buffer, then let ExcelJS parse only an already-bounded file.
    await new Promise<void>((resolve, reject) => {
      const stream = entry.internalStream("uint8array");
      let finished = false;
      stream
        .on("data", (chunk: Uint8Array) => {
          if (finished) return;
          expandedBytes += chunk.byteLength;
          if (expandedBytes > ASO_XLSX_EXPANDED_LIMIT) {
            finished = true;
            stream.pause();
            reject(expandedLimit());
          }
        })
        .on("error", () => {
          if (finished) return;
          finished = true;
          reject(invalidArchive());
        })
        .on("end", () => {
          if (finished) return;
          finished = true;
          resolve();
        })
        .resume();
    });
  }
}
