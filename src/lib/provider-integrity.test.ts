import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/real-data", () => {
  throw new Error("Provider fallbacks must not import embedded records.");
});

import { getConsolidatedProviders } from "./all-consolidated-providers";
import {
  canKeepProviderActive,
  hashProviderIdentifier,
  isProviderAssociatedWithCompany,
  isProviderCsvSizeAllowed,
  mayUseProviderAsFiscalIdentity,
  isValidProviderIdentifier,
  MAX_PROVIDER_CSV_BYTES,
  MAX_PROVIDER_CSV_ROWS,
  providerIdForIdentityHash,
  providerSnapshotIsCurrent,
  previewProviderCsvRows,
  reserveAndWriteProvider,
  updateProviderIfCurrent,
} from "./provider-integrity";

function fakeCpf(seed: number): string {
  const base = String(100_000_000 + seed).padStart(9, "0");
  const digit = (value: string) => {
    const sum = [...value].reduce(
      (total, character, index) => total + Number(character) * (value.length + 1 - index),
      0
    );
    const result = (sum * 10) % 11;
    return String(result === 10 ? 0 : result);
  };
  const first = digit(base);
  return `${base}${first}${digit(`${base}${first}`)}`;
}

interface MemorySnapshot {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

class MemoryProviderStore {
  documents = new Map<string, Record<string, unknown>>();
  setCalls = 0;
  failNextProviderRead = false;
  failNextReservationRead = false;
  failNextTransaction = false;
  private transactionQueue = Promise.resolve();

  async runTransaction<T>(
    callback: (transaction: {
      get: (reference: string) => Promise<MemorySnapshot>;
      set: (reference: string, data: Record<string, unknown>) => void;
    }) => Promise<T>
  ): Promise<T> {
    let release!: () => void;
    const previous = this.transactionQueue;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const staged = new Map<string, Record<string, unknown>>();
    try {
      if (this.failNextTransaction) {
        this.failNextTransaction = false;
        throw new Error("synthetic transaction failure");
      }
      const result = await callback({
        get: async (reference) => this.snapshot(this.documents.get(reference)),
        set: (reference, data) => {
          staged.set(reference, data);
          this.setCalls += 1;
        },
      });
      for (const [reference, data] of staged) this.documents.set(reference, data);
      return result;
    } finally {
      release();
    }
  }

  async getFromServer(reference: string): Promise<MemorySnapshot> {
    if (reference.startsWith("provider/") && this.failNextProviderRead) {
      this.failNextProviderRead = false;
      throw new Error("read unavailable");
    }
    if (reference.startsWith("reservation/") && this.failNextReservationRead) {
      this.failNextReservationRead = false;
      throw new Error("read unavailable");
    }
    return this.snapshot(this.documents.get(reference));
  }

  private snapshot(data: Record<string, unknown> | undefined): MemorySnapshot {
    return {
      exists: () => data !== undefined,
      data: () => data,
    };
  }
}

class MemoryConditionalWriteStore {
  documents = new Map<string, Record<string, unknown>>();
  private transactionQueue = Promise.resolve();

  async runTransaction<T>(
    callback: (transaction: {
      get: (reference: string) => Promise<MemorySnapshot>;
      update: (reference: string, data: Record<string, unknown>) => void;
    }) => Promise<T>
  ): Promise<T> {
    const previous = this.transactionQueue;
    let release!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const staged = new Map<string, Record<string, unknown>>();
    try {
      const result = await callback({
        get: async (reference) => this.snapshot(this.documents.get(reference)),
        update: (reference, data) => staged.set(reference, data),
      });
      for (const [reference, update] of staged) {
        this.documents.set(reference, { ...this.documents.get(reference), ...update });
      }
      return result;
    } finally {
      release();
    }
  }

  async getFromServer(reference: string): Promise<MemorySnapshot> {
    return this.snapshot(this.documents.get(reference));
  }

  private snapshot(data: Record<string, unknown> | undefined): MemorySnapshot {
    return {
      exists: () => data !== undefined,
      data: () => data,
    };
  }
}

function reservedWrite(
  store: MemoryProviderStore,
  attemptId: string,
  identifier: string,
  identityHash: string
) {
  const providerId = providerIdForIdentityHash(identityHash);
  return reserveAndWriteProvider({
    store,
    reservationRef: `reservation/${identityHash}`,
    providerRef: `provider/${providerId}`,
    legacyProviderRefs: ["provider/legacy-candidate-id"],
    attemptId,
    identifier,
    identityHash,
    providerData: {
      id: providerId,
      cnpj: identifier,
      name: "PRESTADOR FICTÍCIO",
      taxIdStatus: "pending_verification",
      active: false,
      importAttemptId: attemptId,
    },
  });
}

describe("provider integrity", () => {
  it("never replaces an empty provider query with embedded records", () => {
    expect(getConsolidatedProviders()).toEqual([]);
    expect(getConsolidatedProviders()).not.toBe(getConsolidatedProviders());
  });

  it("validates CPF and rejects repeated or malformed identifiers", () => {
    const identifier = fakeCpf(321);

    expect(isValidProviderIdentifier(identifier)).toBe(true);
    expect(isValidProviderIdentifier("11111111111")).toBe(false);
    expect(isValidProviderIdentifier(`${identifier.slice(0, 10)}0`)).toBe(false);
  });

  it("validates CNPJ check digits without relying on taxpayer fixtures", () => {
    const valueOf = (character: string) => character.charCodeAt(0) - 48;
    const digit = (base: string, weights: number[]) => {
      const remainder =
        [...base].reduce((sum, character, index) => sum + valueOf(character) * weights[index], 0) %
        11;
      return String(remainder < 2 ? 0 : 11 - remainder);
    };
    const base = "12A45678000B";
    const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const first = digit(base, firstWeights);
    const second = digit(`${base}${first}`, [6, ...firstWeights]);
    const identifier = `${base}${first}${second}`;

    expect(isValidProviderIdentifier(identifier)).toBe(true);
    expect(isValidProviderIdentifier(`${identifier.slice(0, 13)}9`)).toBe(false);
  });

  it("keeps operational function separate and leaves unsupported fields absent", () => {
    const { rows } = previewProviderCsvRows(
      [
        {
          NOME: "Profissional Fictício",
          CPF: fakeCpf(555),
          "FUNÇÃO OPERACIONAL": "Assistência técnica médica em perícias",
        },
      ],
      []
    );

    expect(rows[0].record).toMatchObject({
      operationalFunction: "Assistência técnica médica em perícias",
    });
    expect(rows[0].record).not.toHaveProperty("specialty");
    expect(rows[0].record).not.toHaveProperty("type");
    expect(rows[0].record).not.toHaveProperty("rqe");
  });

  it("rejects repeated documents, existing identities, verified-name conflicts and invalid types", () => {
    const duplicateId = fakeCpf(111);
    const existingId = fakeCpf(222);
    const conflictId = fakeCpf(333);
    const { rows } = previewProviderCsvRows(
      [
        { NOME: "Pessoa Repetida", CPF: duplicateId },
        { NOME: "Pessoa Repetida", CPF: duplicateId },
        { NOME: "Pessoa Existente", CPF: existingId },
        { NOME: "Nome Verificado", CPF: conflictId, TIPO: "UNKNOWN" },
      ],
      [
        { name: "Pessoa Existente", cnpj: existingId },
        { name: "Nome Verificado", cnpj: fakeCpf(444), taxIdStatus: "verified" },
      ]
    );

    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain("Documento repetido no arquivo.");
    expect(rows[2].errors).toContain(
      "Documento já cadastrado; nenhum dado existente será sobrescrito."
    );
    expect(rows[3].errors).toContain("Nome em conflito com cadastro fiscal verificado.");
    expect(rows[3].errors).toContain("Tipo de prestador inválido.");
  });

  it("rejects CSV files beyond the row limit", () => {
    const { rows, errors } = previewProviderCsvRows(
      Array.from({ length: MAX_PROVIDER_CSV_ROWS + 1 }, () => ({})),
      []
    );

    expect(rows).toEqual([]);
    expect(errors).toEqual([`O arquivo excede o limite de ${MAX_PROVIDER_CSV_ROWS} linhas.`]);
  });

  it("enforces the CSV byte limit without rejecting a file at the boundary", () => {
    expect(isProviderCsvSizeAllowed(MAX_PROVIDER_CSV_BYTES)).toBe(true);
    expect(isProviderCsvSizeAllowed(MAX_PROVIDER_CSV_BYTES + 1)).toBe(false);
    expect(isProviderCsvSizeAllowed(Number.NaN)).toBe(false);
  });

  it("requires an explicit company link when filtering providers", () => {
    expect(isProviderAssociatedWithCompany({ id: "missing" }, "company-a")).toBe(false);
    expect(
      isProviderAssociatedWithCompany({ id: "linked", servedCompanies: ["company-b"] }, "company-a")
    ).toBe(false);
    expect(
      isProviderAssociatedWithCompany({ id: "linked", servedCompanies: ["company-a"] }, "company-a")
    ).toBe(true);
  });

  it("prevents activation while fiscal identity is pending without disabling a legacy active record", () => {
    expect(canKeepProviderActive("pending_verification", false, true)).toBe(false);
    expect(canKeepProviderActive("verified", false, true)).toBe(true);
    expect(canKeepProviderActive("verified", true, false)).toBe(false);
    expect(canKeepProviderActive(undefined, true, true)).toBe(true);
    expect(canKeepProviderActive(undefined, false, true)).toBe(false);
  });

  it("serializes competing sessions using a shared identity reservation", async () => {
    const store = new MemoryProviderStore();
    const identifier = fakeCpf(606);
    const identityHash = await hashProviderIdentifier(identifier);

    const results = await Promise.all([
      reservedWrite(store, "session-a-attempt", identifier, identityHash),
      reservedWrite(store, "session-b-attempt", identifier, identityHash),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual(["confirmed", "duplicate"]);
    expect([...store.documents.keys()].filter((key) => key.startsWith("provider/"))).toHaveLength(
      1
    );
  });

  it("preserves the attempt identity after commit when the server reread fails", async () => {
    const store = new MemoryProviderStore();
    const identifier = fakeCpf(707);
    const identityHash = await hashProviderIdentifier(identifier);
    store.failNextProviderRead = true;

    const first = await reservedWrite(store, "stable-attempt", identifier, identityHash);
    const retry = await reservedWrite(store, "stable-attempt", identifier, identityHash);

    expect(first.status).toBe("committed_unconfirmed");
    expect(retry.status).toBe("confirmed");
    expect(store.setCalls).toBe(2);
    expect(store.documents.get(`reservation/${identityHash}`)?.attemptId).toBe("stable-attempt");
  });

  it("reports a confirmed pre-commit failure separately and keeps successful CSV rows", async () => {
    const store = new MemoryProviderStore();
    const firstIdentifier = fakeCpf(717);
    const firstHash = await hashProviderIdentifier(firstIdentifier);
    const first = await reservedWrite(store, "row-one-attempt", firstIdentifier, firstHash);

    const secondIdentifier = fakeCpf(718);
    const secondHash = await hashProviderIdentifier(secondIdentifier);
    store.failNextTransaction = true;
    const second = await reservedWrite(store, "row-two-attempt", secondIdentifier, secondHash);

    expect(first.status).toBe("confirmed");
    expect(second.status).toBe("not_committed");
    expect([...store.documents.keys()].filter((key) => key.startsWith("provider/"))).toHaveLength(
      1
    );
    expect([...store.documents.keys()].some((key) => key.startsWith("users/"))).toBe(false);
  });

  it("keeps unknown commit outcomes distinct from a confirmed pre-commit failure", async () => {
    const store = new MemoryProviderStore();
    const identifier = fakeCpf(808);
    const identityHash = await hashProviderIdentifier(identifier);
    store.runTransaction = async () => {
      store.failNextReservationRead = true;
      throw new Error("transaction acknowledgment unavailable");
    };

    await expect(
      reservedWrite(store, "unknown-attempt", identifier, identityHash)
    ).resolves.toMatchObject({ status: "outcome_unknown" });
  });

  it("recognizes unchanged, archived, and fiscally verified snapshot state", () => {
    const original = {
      id: "legacy-fake",
      cnpj: "123",
      taxIdStatus: "verified",
      active: true,
      isDeleted: false,
      revision: 4,
    };

    expect(providerSnapshotIsCurrent(original, { ...original })).toBe(true);
    expect(providerSnapshotIsCurrent(original, { ...original, isDeleted: true })).toBe(false);
    expect(
      providerSnapshotIsCurrent(original, { ...original, taxIdStatus: "pending_verification" })
    ).toBe(false);
    expect(mayUseProviderAsFiscalIdentity("pending_verification")).toBe(false);
    expect(mayUseProviderAsFiscalIdentity("verified")).toBe(true);
    expect(mayUseProviderAsFiscalIdentity(undefined)).toBe(true);
  });

  it("allows only one stale-snapshot archive across concurrent sessions", async () => {
    const store = new MemoryConditionalWriteStore();
    const original = {
      id: "provider-fake",
      name: "Prestador Fictício",
      cnpj: "123",
      active: true,
      isDeleted: false,
      revision: 2,
    };
    store.documents.set("provider-fake", { ...original });

    const attempt = () =>
      updateProviderIfCurrent({
        store,
        reference: "provider-fake",
        expected: original,
        update: { active: false, isDeleted: true, revision: 3 },
        verify: { active: false, isDeleted: true },
      });
    const results = await Promise.allSettled([attempt(), attempt()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(store.documents.get("provider-fake")).toMatchObject({
      active: false,
      isDeleted: true,
      revision: 3,
    });
  });

  it("does not overwrite a fiscal identity changed after the edit snapshot", async () => {
    const store = new MemoryConditionalWriteStore();
    const original = {
      id: "provider-fake",
      name: "Prestador Fictício",
      cnpj: "123",
      taxIdStatus: "verified",
      active: true,
      revision: 2,
    };
    const verifiedByAnotherSession = {
      ...original,
      cnpj: "456",
      revision: 3,
    };
    store.documents.set("provider-fake", verifiedByAnotherSession);

    await expect(
      updateProviderIfCurrent({
        store,
        reference: "provider-fake",
        expected: original,
        update: { cnpj: "789", taxIdStatus: "pending_verification", active: false },
        verify: { cnpj: "789" },
      })
    ).rejects.toThrow("O cadastro mudou em outra sessão.");
    expect(store.documents.get("provider-fake")).toEqual(verifiedByAnotherSession);
  });
});
