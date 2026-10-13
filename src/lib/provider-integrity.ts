import {
  getDocFromServer,
  runTransaction,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type UpdateData,
} from "firebase/firestore";

export const MAX_PROVIDER_CSV_BYTES = 1_000_000;
export const MAX_PROVIDER_CSV_ROWS = 500;

export function isProviderCsvSizeAllowed(size: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= MAX_PROVIDER_CSV_BYTES;
}

export function canKeepProviderActive(
  taxIdStatus: string | undefined,
  wasAlreadyActive: boolean,
  identifierUnchanged: boolean
): boolean {
  if (!identifierUnchanged) return false;
  if (taxIdStatus === "verified") return true;
  return taxIdStatus === undefined && wasAlreadyActive;
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
  attemptId?: string;
  record?: ProviderCsvRecord;
  errors: string[];
}

export interface ExistingProviderIdentity {
  id?: string;
  name?: string;
  cnpj?: string;
  taxIdStatus?: string;
}

export function normalizeProviderIdentifier(value: string): string {
  return value.replace(/[^a-z\d]/gi, "").toUpperCase();
}

export async function hashProviderIdentifier(value: string): Promise<string> {
  const normalized = normalizeProviderIdentifier(value);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function providerIdForIdentityHash(hash: string): string {
  return `fiscal_${hash}`;
}

interface ProviderSnapshot {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

export interface ReservationTransaction<Reference> {
  get(reference: Reference): Promise<ProviderSnapshot>;
  set(reference: Reference, data: Record<string, unknown>): void;
}

export interface ProviderReservationStore<Reference> {
  runTransaction<T>(
    update: (transaction: ReservationTransaction<Reference>) => Promise<T>
  ): Promise<T>;
  getFromServer(reference: Reference): Promise<ProviderSnapshot>;
}

export interface ProviderConditionalWriteTransaction<Reference> {
  get(reference: Reference): Promise<ProviderSnapshot>;
  update(reference: Reference, data: Record<string, unknown>): void;
}

export interface ProviderConditionalWriteStore<Reference> {
  runTransaction<T>(
    update: (transaction: ProviderConditionalWriteTransaction<Reference>) => Promise<T>
  ): Promise<T>;
  getFromServer(reference: Reference): Promise<ProviderSnapshot>;
}

export function createFirestoreProviderConditionalWriteStore(
  db: Firestore
): ProviderConditionalWriteStore<DocumentReference<DocumentData>> {
  return {
    runTransaction: (callback) =>
      runTransaction(db, (transaction) =>
        callback({
          get: (reference) => transaction.get(reference),
          update: (reference, data) =>
            transaction.update(reference, data as UpdateData<DocumentData>),
        })
      ),
    getFromServer: getDocFromServer,
  };
}

export async function updateProviderIfCurrent<Reference>({
  store,
  reference,
  expected,
  update,
  verify,
}: {
  store: ProviderConditionalWriteStore<Reference>;
  reference: Reference;
  expected: Record<string, unknown>;
  update: Record<string, unknown>;
  verify: Record<string, unknown>;
}): Promise<void> {
  await store.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("O cadastro não existe mais. Atualize a listagem.");
    const current = {
      ...snapshot.data(),
      ...(typeof expected.id === "string" ? { id: expected.id } : {}),
    };
    if (!providerSnapshotIsCurrent(expected, current)) {
      throw new Error("O cadastro mudou em outra sessão. Atualize antes de salvar.");
    }
    transaction.update(reference, update);
  });

  const persisted = await store.getFromServer(reference);
  const persistedData = persisted.data();
  if (
    !persisted.exists() ||
    !persistedData ||
    Object.entries(verify).some(([key, value]) => persistedData[key] !== value)
  ) {
    throw new Error("A atualização foi enviada, mas não pôde ser confirmada no servidor.");
  }
}

export function createFirestoreProviderReservationStore(
  db: Firestore
): ProviderReservationStore<DocumentReference<DocumentData>> {
  return {
    runTransaction: (callback) =>
      runTransaction(db, (transaction) =>
        callback({
          get: (reference) => transaction.get(reference),
          set: (reference, data) => transaction.set(reference, data),
        })
      ),
    getFromServer: getDocFromServer,
  };
}

export type ReservedProviderWriteResult =
  | { status: "confirmed" }
  | { status: "duplicate" }
  | { status: "not_committed" }
  | { status: "committed_unconfirmed" }
  | { status: "outcome_unknown" };

export async function reserveAndWriteProvider<Reference>({
  store,
  reservationRef,
  providerRef,
  legacyProviderRefs,
  attemptId,
  identifier,
  identityHash,
  providerData,
}: {
  store: ProviderReservationStore<Reference>;
  reservationRef: Reference;
  providerRef: Reference;
  legacyProviderRefs: Reference[];
  attemptId: string;
  identifier: string;
  identityHash: string;
  providerData: Record<string, unknown>;
}): Promise<ReservedProviderWriteResult> {
  const reservation = {
    attemptId,
    identityHash,
    providerId: providerData.id,
    updatedAt: providerData.updatedAt,
  };

  const confirmCommittedReservation = async (): Promise<ReservedProviderWriteResult> => {
    try {
      const [reservationSnapshot, providerSnapshot] = await Promise.all([
        store.getFromServer(reservationRef),
        store.getFromServer(providerRef),
      ]);
      const storedReservation = reservationSnapshot.data();
      const storedProvider = providerSnapshot.data();
      const expectedProviderFields = Object.entries(providerData).filter(
        ([key]) => key !== "createdAt" && key !== "updatedAt"
      );
      if (
        !reservationSnapshot.exists() ||
        !providerSnapshot.exists() ||
        storedReservation?.attemptId !== attemptId ||
        storedReservation?.identityHash !== identityHash ||
        storedReservation?.providerId !== providerData.id ||
        storedProvider?.importAttemptId !== attemptId ||
        normalizeProviderIdentifier(String(storedProvider?.cnpj || "")) !==
          normalizeProviderIdentifier(identifier) ||
        expectedProviderFields.some(
          ([key, value]) =>
            JSON.stringify(comparableProviderData(storedProvider?.[key])) !==
            JSON.stringify(comparableProviderData(value))
        )
      ) {
        return { status: "committed_unconfirmed" };
      }
      return { status: "confirmed" };
    } catch {
      return { status: "committed_unconfirmed" };
    }
  };

  try {
    const result = await store.runTransaction(async (transaction) => {
      const reservationSnapshot = await transaction.get(reservationRef);
      if (reservationSnapshot.exists()) {
        const storedReservation = reservationSnapshot.data();
        if (
          storedReservation?.attemptId !== attemptId ||
          storedReservation?.identityHash !== identityHash ||
          storedReservation?.providerId !== providerData.id
        ) {
          return "duplicate" as const;
        }
        return "same_attempt" as const;
      }

      const references = [...new Set([providerRef, ...legacyProviderRefs])];
      const existingSnapshots = await Promise.all(
        references.map((reference) => transaction.get(reference))
      );
      if (existingSnapshots.some((snapshot) => snapshot.exists())) {
        return "duplicate" as const;
      }

      transaction.set(reservationRef, reservation);
      transaction.set(providerRef, providerData);
      return "created" as const;
    });

    if (result === "duplicate") return { status: "duplicate" };
    return confirmCommittedReservation();
  } catch {
    try {
      const snapshot = await store.getFromServer(reservationRef);
      if (!snapshot.exists()) return { status: "not_committed" };
      const storedReservation = snapshot.data();
      if (
        storedReservation?.attemptId === attemptId &&
        storedReservation?.identityHash === identityHash &&
        storedReservation?.providerId === providerData.id
      ) {
        return { status: "committed_unconfirmed" };
      }
      return { status: "duplicate" };
    } catch {
      return { status: "outcome_unknown" };
    }
  }
}

function comparableProviderData(value: unknown): unknown {
  if (value && typeof value === "object" && "toMillis" in value) {
    const timestamp = value as { toMillis?: () => number };
    if (typeof timestamp.toMillis === "function") return { timestamp: timestamp.toMillis() };
  }
  if (value instanceof Date) return { timestamp: value.getTime() };
  if (Array.isArray(value)) return value.map(comparableProviderData);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, comparableProviderData(entry)])
    );
  }
  return value;
}

export function providerSnapshotIsCurrent(
  expected: Record<string, unknown>,
  current: Record<string, unknown>
): boolean {
  return (
    JSON.stringify(comparableProviderData(expected)) ===
    JSON.stringify(comparableProviderData(current))
  );
}

export function mayUseProviderAsFiscalIdentity(taxIdStatus: unknown): boolean {
  return taxIdStatus === undefined || taxIdStatus === "verified";
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
