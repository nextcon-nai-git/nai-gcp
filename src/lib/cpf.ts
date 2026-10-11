/** Verifies CPF check digits; formatting alone is not an identity check. */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const size of [9, 10]) {
    const sum = [...digits.slice(0, size)].reduce((n, d, i) => n + Number(d) * (size + 1 - i), 0);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(digits[size])) return false;
  }
  return true;
}
