/** Encode one text cell for CSV downloads opened in spreadsheet applications. */
export function csvTextCell(value: unknown): string {
  const text = String(value ?? "");
  // Quoting alone does not prevent a spreadsheet from evaluating a formula.
  // Also inspect beyond whitespace/control characters that importers can ignore.
  const formula = /^[\s\p{Cc}]*[=+\-@＝＋－＠]/u.test(text);
  const lineControl = /^[\t\r\n]/.test(text);
  const escaped = formula || lineControl ? "'" + text : text;
  return `"${escaped.replaceAll('"', '""')}"`;
}
