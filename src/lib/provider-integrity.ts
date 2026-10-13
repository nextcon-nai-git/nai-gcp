export const MAX_PROVIDER_CSV_BYTES = 1_000_000;
export const MAX_PROVIDER_CSV_ROWS = 500;

export function isProviderCsvSizeAllowed(size: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= MAX_PROVIDER_CSV_BYTES;
}

export const PROVIDER_TYPES = [
  "CLINIC",
  "LAB",
  "DOCTOR",
  "HOSPITAL",
  "NURSE",
  "ENGINEER",
  "TECH_NURSE",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface ProviderCsvRecord {
  name: string;
  cnpj: string;
  profession?: string;
  operationalFunction?: string;
  councilNumber?: string;
  rqe?: string;
  taxIdType?: "CPF" | "CNPJ";
  type?: ProviderType;
  specialty?: string;
  city?: string;
  state?: string;
  email?: string;
}

export interface ProviderCsvPreviewRow {
  rowNumber: number;
  record?: ProviderCsvRecord;
  errors: string[];
}

export interface ExistingProviderIdentity {
  id?: string;
  name?: string;
  cnpj?: string;
  taxIdStatus?: string;
}

interface ProviderSnapshot {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

export async function writeAndConfirmProvider(
  write: () => Promise<void>,
  read: () => Promise<ProviderSnapshot>,
  expected: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await write();
  const snapshot = await read();
  const data = snapshot.data();
  if (
    !snapshot.exists() ||
    !data ||
    Object.entries(expected).some(([key, value]) => data[key] !== value)
  ) {
    throw new Error("A gravação não pôde ser confirmada por nova leitura.");
  }
  return data;
}

export function normalizeProviderIdentifier(value: string): string {
  return value.replace(/[^a-z\d]/gi, "").toUpperCase();
}

function checkDigit(sum: number): number {
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    return (sum * 10) % 11 === 10 ? 0 : (sum * 10) % 11;
  };

  return calculate(9) === Number(value[9]) && calculate(10) === Number(value[10]);
}

function isValidCnpj(value: string): boolean {
  if (
    !/^[A-Z\d]{12}\d{2}$/.test(value) ||
    /^0{12}\d{2}$/.test(value) ||
    /^(.)(\1){11}\d{2}$/.test(value)
  ) {
    return false;
  }

  const charValue = (character: string) => character.charCodeAt(0) - 48;
  const calculate = (base: string, weights: number[]) => {
    const sum = [...base].reduce(
      (total, character, index) => total + charValue(character) * weights[index],
      0
    );
    return checkDigit(sum);
  };
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];
  const first = calculate(value.slice(0, 12), firstWeights);
  const second = calculate(`${value.slice(0, 12)}${first}`, secondWeights);

  return first === Number(value[12]) && second === Number(value[13]);
}

export function isValidProviderIdentifier(value: string): boolean {
  const normalized = normalizeProviderIdentifier(value);
  return isValidCpf(normalized) || isValidCnpj(normalized);
}

function normalizeText(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

export function normalizeProviderName(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function cell(row: Record<string, unknown>, ...names: string[]): string {
  const entries = Object.entries(row);
  const key = entries.find(([name]) => names.includes(normalizeText(name)))?.[0];
  const value = key ? row[key] : "";
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function optionalValue(value: string, label: string, maxLength: number, errors: string[]) {
  if (value.length > maxLength) errors.push(`${label} excede ${maxLength} caracteres.`);
  return value || undefined;
}

export function previewProviderCsvRows(
  rawRows: Record<string, unknown>[],
  existingProviders: ExistingProviderIdentity[]
): { rows: ProviderCsvPreviewRow[]; errors: string[] } {
  if (rawRows.length > MAX_PROVIDER_CSV_ROWS) {
    return {
      rows: [],
      errors: [`O arquivo excede o limite de ${MAX_PROVIDER_CSV_ROWS} linhas.`],
    };
  }

  const seenIdentifiers = new Set<string>();
  const existingByIdentifier = new Set(
    existingProviders
      .map((provider) => normalizeProviderIdentifier(provider.cnpj || ""))
      .filter(Boolean)
  );
  const verifiedNames = new Map(
    existingProviders
      .filter((provider) => provider.taxIdStatus === "verified" && provider.name)
      .map((provider) => [
        normalizeText(provider.name || ""),
        normalizeProviderIdentifier(provider.cnpj || ""),
      ])
  );

  const rows = rawRows.map((row, index): ProviderCsvPreviewRow => {
    const errors: string[] = [];
    const name = cell(row, "NOME", "RAZAO SOCIAL", "NOME COMPLETO");
    const identifier = normalizeProviderIdentifier(
      cell(row, "CNPJ", "CPF", "CPF/CNPJ", "DOCUMENTO", "DOCUMENTO FISCAL")
    );
    const typeValue = cell(row, "TIPO").toUpperCase();
    const profession = cell(row, "PROFISSAO");
    const operationalFunction = cell(row, "FUNCAO OPERACIONAL", "FUNCAO");
    const councilNumber = cell(row, "REGISTRO CONSELHO", "REGISTRO", "CRM", "CREA", "COREN");
    const rqe = cell(row, "RQE");
    const specialty = cell(row, "ESPECIALIDADE REGISTRADA", "ESPECIALIDADE");
    const city = cell(row, "CIDADE");
    const state = cell(row, "UF", "ESTADO");
    const email = cell(row, "EMAIL", "E-MAIL");

    if (name.length < 3 || name.length > 160) {
      errors.push("Nome deve ter entre 3 e 160 caracteres.");
    }
    if (!identifier || !isValidProviderIdentifier(identifier)) {
      errors.push("CPF/CNPJ ausente ou inválido.");
    }
    if (identifier && seenIdentifiers.has(identifier)) {
      errors.push("Documento repetido no arquivo.");
    } else if (identifier) {
      seenIdentifiers.add(identifier);
    }
    if (identifier && existingByIdentifier.has(identifier)) {
      errors.push("Documento já cadastrado; nenhum dado existente será sobrescrito.");
    }
    const verifiedIdentifier = verifiedNames.get(normalizeText(name));
    if (verifiedIdentifier && identifier && verifiedIdentifier !== identifier) {
      errors.push("Nome em conflito com cadastro fiscal verificado.");
    }
    if (typeValue && !PROVIDER_TYPES.includes(typeValue as ProviderType)) {
      errors.push("Tipo de prestador inválido.");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("E-mail inválido.");
    }

    const record: ProviderCsvRecord = {
      name: name.toLocaleUpperCase("pt-BR"),
      cnpj: identifier,
      taxIdType: identifier.length === 11 ? "CPF" : "CNPJ",
    };
    const recordValues = [
      ["profession", profession, "Profissão", 100],
      ["operationalFunction", operationalFunction, "Função operacional", 160],
      ["councilNumber", councilNumber, "Registro profissional", 80],
      ["rqe", rqe, "RQE", 40],
      ["specialty", specialty, "Especialidade registrada", 120],
      ["city", city, "Cidade", 100],
      ["state", state, "UF", 2],
      ["email", email, "E-mail", 254],
    ] as const;

    for (const [field, value, label, maxLength] of recordValues) {
      const normalized = optionalValue(value, label, maxLength, errors);
      if (normalized) Object.assign(record, { [field]: normalized });
    }
    if (typeValue && PROVIDER_TYPES.includes(typeValue as ProviderType)) {
      record.type = typeValue as ProviderType;
    }

    return errors.length > 0
      ? { rowNumber: index + 2, errors }
      : { rowNumber: index + 2, record, errors };
  });

  return { rows, errors: [] };
}

export function isProviderAssociatedWithCompany(
  provider: ExistingProviderIdentity & { companyId?: string; servedCompanies?: unknown },
  companyId?: string | null
): boolean {
  if (!companyId || companyId === "all") return true;
  return (
    provider.companyId === companyId ||
    (Array.isArray(provider.servedCompanies) && provider.servedCompanies.includes(companyId))
  );
}
