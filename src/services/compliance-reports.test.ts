import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => ({
  creates: [] as Array<{ path: string; data: Record<string, unknown> }>,
  failures: [] as unknown[],
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __serverTimestamp: true }),
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        create: async (data: Record<string, unknown>) => {
          const failure = memory.failures.shift();
          if (failure) throw failure;
          memory.creates.push({ path: `${name}/${id}`, data });
        },
      }),
    }),
  },
}));

import { ComplianceReportSchema, createComplianceReport } from "./compliance-reports";

const base = {
  isAnonimo: true,
  nome: "",
  email: "",
  categoria: "assedio_moral",
  descricao: "Descrição suficientemente detalhada para registrar o relato.",
  dataFato: "2026-11-01",
  local: "Unidade de teste",
};

describe("compliance reports", () => {
  beforeEach(() => {
    memory.creates = [];
    memory.failures = [];
  });

  it("stores anonymous reports without identification and with a server protocol", async () => {
    const protocol = await createComplianceReport(base);
    expect(protocol).toMatch(/^DEN-\d{4}-[A-F0-9]{24}$/);
    expect(memory.creates).toHaveLength(1);
    expect(memory.creates[0].path).toBe("denuncias/" + protocol);
    expect(memory.creates[0].data).toMatchObject({
      protocolo: protocol,
      tipoRelato: "anonimo",
      dadosIdentificacao: { nome: null, email: null },
      categoria: "assedio_moral",
      status: "triagem",
      prioridade: "Média-Alta",
      schemaVersion: 1,
    });
  });

  it("normalizes identified email and requires a valid identity", async () => {
    await createComplianceReport({
      ...base,
      isAnonimo: false,
      nome: "Pessoa Teste",
      email: "PESSOA@EXAMPLE.COM",
    });
    expect(memory.creates[0].data).toMatchObject({
      tipoRelato: "identificado",
      dadosIdentificacao: {
        nome: "Pessoa Teste",
        email: "pessoa@example.com",
      },
    });

    expect(() =>
      ComplianceReportSchema.parse({
        ...base,
        isAnonimo: false,
        nome: "Pessoa",
        email: "invalido",
      })
    ).toThrow();
  });

  it("rejects invalid category, short description and future dates", () => {
    expect(() => ComplianceReportSchema.parse({ ...base, categoria: "outro" })).toThrow();
    expect(() => ComplianceReportSchema.parse({ ...base, descricao: "curto" })).toThrow();
    expect(() => ComplianceReportSchema.parse({ ...base, dataFato: "2099-01-01" })).toThrow();
  });

  it("retries an atomic create when a protocol collision is reported", async () => {
    memory.failures.push({ code: 6 });
    const protocol = await createComplianceReport(base);
    expect(memory.creates).toHaveLength(1);
    expect(memory.creates[0].path).toBe("denuncias/" + protocol);
  });

  it("does not retry unrelated storage failures", async () => {
    memory.failures.push(new Error("storage unavailable"));
    await expect(createComplianceReport(base)).rejects.toThrow("storage unavailable");
    expect(memory.creates).toHaveLength(0);
  });
});
