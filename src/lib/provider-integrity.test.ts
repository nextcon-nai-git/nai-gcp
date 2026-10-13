import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/real-data", () => {
  throw new Error("Provider fallbacks must not import embedded records.");
});

import { getConsolidatedProviders } from "./all-consolidated-providers";
import {
  isProviderAssociatedWithCompany,
  isProviderCsvSizeAllowed,
  isValidProviderIdentifier,
  MAX_PROVIDER_CSV_BYTES,
  MAX_PROVIDER_CSV_ROWS,
  previewProviderCsvRows,
  writeAndConfirmProvider,
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

  it("confirms a provider write only after a matching reread", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const read = vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ isDeleted: true, active: false }),
    });

    await expect(
      writeAndConfirmProvider(write, read, { isDeleted: true, active: false })
    ).resolves.toMatchObject({ isDeleted: true, active: false });
    expect(write).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledOnce();
  });

  it("does not read or report success when a provider write fails", async () => {
    const write = vi.fn().mockRejectedValue(new Error("write denied"));
    const read = vi.fn();

    await expect(writeAndConfirmProvider(write, read, { isDeleted: true })).rejects.toThrow(
      "write denied"
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects a provider write whose reread does not match", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const read = vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ isDeleted: false }),
    });

    await expect(writeAndConfirmProvider(write, read, { isDeleted: true })).rejects.toThrow(
      "A gravação não pôde ser confirmada por nova leitura."
    );
  });
});
