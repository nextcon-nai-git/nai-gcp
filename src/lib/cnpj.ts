export function normalizeCnpj(value: string): string {
  return value.replace(/[^a-z\d]/gi, "").toUpperCase();
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1+$/.test(cnpj)) return false;

  const checkDigit = (input: string, weights: readonly number[]) => {
    const sum = [...input].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = checkDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}
