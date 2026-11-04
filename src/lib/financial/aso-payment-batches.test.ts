import { describe, expect, it } from "vitest";
import {
  buildClinicPaymentPreview,
  nextClinicPaymentDate,
} from "./aso-payment-batches";
import { emptyFinanceBook, type FinanceBook } from "./operations";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";

function aso(overrides: Partial<GrupoAvpAso> = {}): GrupoAvpAso {
  return {
    id: "avp_" + "a".repeat(32),
    numero: "1",
    urgencia: "NORMAL",
    urgenciaRaw: "NORMAL",
    dataPedido: "01/11/2026",
    dataPedidoIso: "2026-11-01",
    diasParado: 0,
    cidadeRaw: "ILHEUS BA",
    cidade: "ILHÉUS",
    uf: "BA",
    colaborador: "COLABORADOR TESTE",
    tipoExame: "PERIÓDICO",
    telefoneGestor: "",
    oQueFazer: "",
    status: "EXAME FEITO",
    responsavel: "NEXTCON",
    dataAgendada: "03/11/2026",
    dataAgendadaIso: "2026-11-03",
    tipoSolicitacao: "PERIÓDICO",
    nomeClinica: "CLINMETRA",
    telefoneClinica: "",
    emailClinica: "",
    valorAso: "30,00",
    cnpjClinica: "12.345.678/0001-90",
    chavePix: "",
    pixRealizado: "NÃO",
    enderecoClinica: "",
    ...overrides,
  };
}

describe("clinic ASO payment batches", () => {
  it("groups completed ASOs by clinic CNPJ and competence", () => {
    const book = emptyFinanceBook();
    const preview = buildClinicPaymentPreview(
      [
        aso(),
        aso({
          id: "avp_" + "b".repeat(32),
          colaborador: "OUTRO COLABORADOR",
          valorAso: "R$ 35,00",
          dataAgendadaIso: "2026-11-04",
        }),
        aso({
          id: "avp_" + "c".repeat(32),
          status: "AGENDADO",
        }),
      ],
      book
    );

    expect(preview.batches).toHaveLength(1);
    expect(preview.batches[0]).toMatchObject({
      clinicDocument: "12345678000190",
      competence: "2026-11",
      amountCents: 6500,
    });
    expect(preview.batches[0].items).toHaveLength(2);
    expect(preview.totals).toEqual({ clinics: 1, asos: 2, amountCents: 6500 });
    expect(preview.ignored).toBe(1);
  });

  it("blocks paid, invalid and already-batched ASOs", () => {
    const book = emptyFinanceBook();
    const titleId = "title_active";
    book.titles.push({
      id: titleId,
      kind: "payable",
      party: "CLINMETRA",
      description: "Lote",
      amountCents: 3000,
      competence: "2026-11",
      dueDate: "2026-11-03",
      category: "Exames ocupacionais",
      center: "Grupo AVP",
      contractId: null,
      sourceKey: "clinic-asos:active",
      source: "manual",
      externalReference: "",
      evidence: "Lote de ASOs",
      status: "draft",
      createdBy: "creator",
      approvedBy: null,
    });
    book.clinicPaymentBatches.push({
      id: "batch_active",
      clinicName: "CLINMETRA",
      clinicDocument: "12345678000190",
      competence: "2026-11",
      dueDate: "2026-11-03",
      amountCents: 3000,
      titleId,
      items: [
        {
          asoId: "avp_" + "a".repeat(32),
          collaborator: "COLABORADOR TESTE",
          city: "ILHÉUS/BA",
          examDate: "2026-11-03",
          amountCents: 3000,
        },
      ],
      createdBy: "creator",
      createdAt: "2026-11-03T12:00:00.000Z",
    });

    const preview = buildClinicPaymentPreview(
      [
        aso(),
        aso({ id: "avp_" + "b".repeat(32), pixRealizado: "SIM" }),
        aso({ id: "avp_" + "c".repeat(32), cnpjClinica: "" }),
        aso({ id: "avp_" + "d".repeat(32), valorAso: "30 e 35" }),
        aso({ id: "avp_" + "e".repeat(32), dataAgendadaIso: "" }),
      ],
      book
    );

    expect(preview.batches).toHaveLength(0);
    expect(preview.blocked.map((row) => row.code).sort()).toEqual(
      [
        "ALREADY_BATCHED",
        "ALREADY_PAID",
        "INVALID_AMOUNT",
        "INVALID_DOCUMENT",
        "MISSING_EXAM_DATE",
      ].sort()
    );
  });

  it("allows an ASO to be rebatched after the previous title is cancelled", () => {
    const book = emptyFinanceBook();
    book.titles.push({
      id: "title_cancelled",
      kind: "payable",
      party: "CLINMETRA",
      description: "Lote cancelado",
      amountCents: 3000,
      competence: "2026-11",
      dueDate: "2026-11-03",
      category: "Exames ocupacionais",
      center: "Grupo AVP",
      contractId: null,
      sourceKey: "clinic-asos:cancelled",
      source: "manual",
      externalReference: "",
      evidence: "Lote cancelado de ASOs",
      status: "cancelled",
      createdBy: "creator",
      approvedBy: null,
    });
    book.clinicPaymentBatches.push({
      id: "batch_cancelled",
      clinicName: "CLINMETRA",
      clinicDocument: "12345678000190",
      competence: "2026-11",
      dueDate: "2026-11-03",
      amountCents: 3000,
      titleId: "title_cancelled",
      items: [
        {
          asoId: "avp_" + "a".repeat(32),
          collaborator: "COLABORADOR TESTE",
          city: "ILHÉUS/BA",
          examDate: "2026-11-03",
          amountCents: 3000,
        },
      ],
      createdBy: "creator",
      createdAt: "2026-11-03T12:00:00.000Z",
    });

    expect(buildClinicPaymentPreview([aso()], book).totals.asos).toBe(1);
  });

  it("uses Tuesday and Friday as the default payment review cadence", () => {
    expect(nextClinicPaymentDate("2026-11-02")).toBe("2026-11-03");
    expect(nextClinicPaymentDate("2026-11-03")).toBe("2026-11-03");
    expect(nextClinicPaymentDate("2026-11-04")).toBe("2026-11-06");
    expect(nextClinicPaymentDate("2026-11-07")).toBe("2026-11-10");
  });

  it("keeps legacy finance books compatible through schema defaults", async () => {
    const legacy: Omit<FinanceBook, "clinicPaymentBatches"> = {
      ...emptyFinanceBook(),
    };
    delete (legacy as Partial<FinanceBook>).clinicPaymentBatches;
    const { FinanceBookSchema } = await import("./operations");
    expect(FinanceBookSchema.parse(legacy).clinicPaymentBatches).toEqual([]);
  });
});
