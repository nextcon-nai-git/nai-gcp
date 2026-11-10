/** Returns the verified digits of a plain or formatted CPF. */
export function parseCpf(value: string): string | null {
  const digits = value.replace(/[.\s-]/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return null;
  for (const size of [9, 10]) {
    const sum = [...digits.slice(0, size)].reduce((n, d, i) => n + Number(d) * (size + 1 - i), 0);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(digits[size])) return null;
  }
  return digits;
}

export function isValidCpf(value: string): boolean {
  return parseCpf(value) !== null;
}
