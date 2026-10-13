/** Bound generated display text; the original fields remain in the source and audit. */
export function financialLabel(value: string, suffix = ""): string {
  const room = 180 - suffix.length;
  return (value.length <= room ? value : value.slice(0, room - 1).trimEnd() + "…") + suffix;
}
