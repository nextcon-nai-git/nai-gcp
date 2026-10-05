import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";

// Bytes PDF/base64 e filename nunca são usados como texto ou identidade.
export function parsePgrWithHeuristics(text: string, _fileName?: string) {
  return parsePgrDocumentPages([{ numero: 1, texto: text.startsWith("data:") ? "" : text }]);
}
