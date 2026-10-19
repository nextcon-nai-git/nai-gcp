import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { CommandSchema, applyCommand, emptyBook } from "./model";
import {
  CycleSchedulePlanSchema,
  TaskSchedulePlanSchema,
  addCalendarDays,
  addCalendarMonths,
  parseScheduleAmount,
  previewCycleSchedule,
  previewTaskSchedule,
  sameCycleSlot,
  type CycleSchedulePlan,
} from "./scheduling";

function recordFixture() {
  const command = CommandSchema.parse({
    action: "create",
    requestId: randomUUID(),
    expectedVersion: 0,
    recordId: "record",
    companyId: "company",
    cnpj: "11222333000181",
    name: "Contrato SST de teste",
    owner: "Equipe de teste",
    terms: {
      scope: "PGR pontual e ASOs recorrentes de teste",
      units: "Unidade de teste",
      deliverables: "Documentos de teste",
      valueCents: 9_990_000,
      startsOn: "2026-10-01",
      endsOn: "",
      paymentTerms: "Valor global; competências precisam de aprovação",
      recurring: true,
      obligations: [
        {
          id: "pgr",
          title: "Elaborar PGR pontual",
          serviceType: "PGR",
          owner: "Engenharia",
          due: "2026-10-20",
          deadlineRule: "Entregar após o recebimento dos dados",
          trigger: "",
          sourceReference: "Contrato de teste, cláusula 3",
          sourceExcerpt: "Elaborar o PGR após o recebimento dos dados.",
        },
        {
          id: "aso",
          title: "Executar ASOs da competência",
          serviceType: "ASO",
          owner: "",
          due: "",
          deadlineRule: "Cinco dias após a ordem de serviço",
          trigger: "Quando houver solicitação de exame",
          sourceReference: "Contrato de teste, cláusula 4",
          sourceExcerpt: "Realizar os ASOs solicitados em cinco dias corridos.",
        },
      ],
    },
    document: null,
    effectiveOn: "2026-10-01",
    evidence: "Cadastro sintético revisado",
    reviewed: true,
  });
  const record = applyCommand(
    emptyBook(),
    command,
    "admin",
    "2026-10-01T12:00:00Z",
    "create",
    "Cliente de teste"
  ).records[0];
  record.formalizedAt = "2026-10-01T12:00:00Z";
  return record;
}
const plan: CycleSchedulePlan = {
  revision: 0,
  service: "ASOs de teste",
  anchorLabel: "Ordem de serviço revisada",
  firstOn: "2026-11-30",
  frequency: "monthly",
  occurrences: 3,
  contractedCents: null,
  rules: [{ obligationId: "aso", offsetDays: 5 }],
};

describe("calendar arithmetic and reviewed money", () => {
  it("handles leap days and year changes without timezone drift", () => {
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addCalendarDays("2026-10-19", 0)).toBe("2026-10-19");
  });

  it("keeps the original monthly day and bounds the supported calendar", () => {
    expect([0, 1, 2].map((offset) => addCalendarMonths("2027-01-31", offset))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
    expect(addCalendarMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addCalendarMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(() => addCalendarDays("2026-02-30", 1)).toThrow();
    expect(() => addCalendarDays("2100-12-31", 1)).toThrow(/2100/);
    expect(() => addCalendarDays("2026-10-01", 0.5)).toThrow(/inteira|3.650/);
    expect(() => addCalendarMonths("2100-12-31", 1)).toThrow(/2100/);
  });

  it("requires unambiguous integer cents and leaves missing values pending", () => {
    expect(parseScheduleAmount("")).toBeNull();
    expect(parseScheduleAmount(" 1234,56 ")).toBe(123456);
    expect(parseScheduleAmount("40.10")).toBe(4010);
    expect(parseScheduleAmount("0,01")).toBe(1);
    for (const value of ["0", "-40", "1.234,56", "30,001", "1e5", "99999999999999999999"])
      expect(() => parseScheduleAmount(value)).toThrow();
    expect(CycleSchedulePlanSchema.safeParse({ ...plan, contractedCents: 12.5 }).success).toBe(
      false
    );
  });
});

describe("contractual schedule preview", () => {
  it("does not derive a date from text or copy a one-time duty into selected recurring work", () => {
    const record = recordFixture();
    expect(() =>
      previewTaskSchedule(record, "record_initial", {
        anchorLabel: "Recebimento conferido",
        anchorOn: "2026-10-10",
        rules: [{ obligationId: "pgr", offsetDays: null }],
      })
    ).toThrow(/dias corridos/);
    const rows = previewCycleSchedule(record, randomUUID(), {
      ...plan,
      rules: [{ obligationId: "aso", offsetDays: null }],
    });
    expect(rows).toHaveLength(3);
    expect(
      rows.every(
        (row) =>
          row.tasks.length === 1 && row.tasks[0].obligationId === "aso" && row.tasks[0].due === ""
      )
    ).toBe(true);
    expect(record.cycles[0].tasks[0].due).toBe("2026-10-20");
  });

  it("rejects absent/invalid anchors and duplicated or foreign obligations", () => {
    const record = recordFixture();
    const input = {
      anchorLabel: "Recebimento conferido",
      anchorOn: "",
      rules: [{ obligationId: "pgr", offsetDays: 10 }],
    };
    expect(TaskSchedulePlanSchema.safeParse(input).success).toBe(false);
    expect(() =>
      previewTaskSchedule(record, "record_initial", {
        ...input,
        anchorOn: "2026-10-10",
        rules: [{ obligationId: "missing", offsetDays: 10 }],
      })
    ).toThrow(/pertencentes/);
    expect(() =>
      previewCycleSchedule(record, randomUUID(), { ...plan, rules: [plan.rules[0], plan.rules[0]] })
    ).toThrow(/repetição/);
    expect(() => previewCycleSchedule(record, randomUUID(), { ...plan, rules: [] })).toThrow(
      /Selecione/
    );
    expect(
      TaskSchedulePlanSchema.safeParse({ ...input, anchorOn: "2026-10-10", due: "2026-01-01" })
        .success
    ).toBe(false);
  });

  it("requires formalized recurring terms and finite counts", () => {
    const record = recordFixture();
    record.formalizedAt = null;
    expect(() => previewCycleSchedule(record, randomUUID(), plan)).toThrow(/Formalize/);
    record.formalizedAt = "2026-10-01T12:00:00Z";
    record.revisions[0].terms.recurring = false;
    expect(() => previewCycleSchedule(record, randomUUID(), plan)).toThrow(/recorrência aprovada/);
    expect(CycleSchedulePlanSchema.safeParse({ ...plan, occurrences: 13 }).success).toBe(false);
    expect(CycleSchedulePlanSchema.safeParse({ ...plan, occurrences: 1 }).success).toBe(false);
    record.revisions[0].terms.recurring = true;
    record.cycles = Array.from({ length: 199 }, (_, i) => ({
      ...record.cycles[0],
      id: `old_${i}`,
    }));
    expect(() => previewCycleSchedule(record, randomUUID(), plan)).toThrow(/200 ciclos/);
  });

  it("validates every occurrence against contract dates and later amendments", () => {
    const record = recordFixture();
    expect(() =>
      previewCycleSchedule(record, randomUUID(), { ...plan, firstOn: "2026-09-30" })
    ).toThrow(/vigência/);
    record.revisions[0].terms.endsOn = "2026-12-31";
    expect(() => previewCycleSchedule(record, randomUUID(), plan)).toThrow(/vigência/);
    record.revisions[0].terms.endsOn = "";
    record.revisions.push({
      ...structuredClone(record.revisions[0]),
      effectiveOn: "2026-12-01",
      evidence: "Aditivo sintético revisado",
    });
    expect(() => previewCycleSchedule(record, randomUUID(), plan)).toThrow(/revisão posterior/);
    expect(record.cycles).toHaveLength(1);
  });

  it("allows a reviewed delivery after contract expiry while keeping its anchor within validity", () => {
    const record = recordFixture();
    record.revisions[0].terms.endsOn = "2026-12-31";
    const rows = previewCycleSchedule(record, randomUUID(), { ...plan, occurrences: 2 });
    expect(rows[1].anchorOn).toBe("2026-12-30");
    expect(rows[1].tasks[0].due).toBe("2027-01-04");
  });

  it("finds later duplicate occurrences without mutating any part of the record", () => {
    const record = recordFixture();
    record.cycles.push({
      ...structuredClone(record.cycles[0]),
      id: "existing",
      service: " ASOs  de teste ",
      period: "2026-12-15",
    });
    const before = structuredClone(record);
    expect(() => previewCycleSchedule(record, randomUUID(), plan)).toThrow(/2026-12/);
    expect(record).toEqual(before);
    expect(sameCycleSlot({ service: "Serviço", period: "2026-10" }, "serviço", "2026-10-15")).toBe(
      true
    );
    expect(sameCycleSlot({ service: "Serviço", period: "10/2026" }, "serviço", "2026-10")).toBe(
      true
    );
    expect(sameCycleSlot({ service: "Serviço", period: "2026-10" }, "serviço", "10/2026")).toBe(
      true
    );
    expect(sameCycleSlot({ service: "Serviço", period: "10/2026" }, "serviço", "2026-10-15")).toBe(
      true
    );
    expect(
      sameCycleSlot({ service: "Serviço", period: "Outubro/2026" }, "serviço", "2026-10")
    ).toBe(false);
    expect(sameCycleSlot({ service: "Serviço", period: "13/2026" }, "serviço", "2026-10")).toBe(
      false
    );
    expect(
      sameCycleSlot({ service: "Serviço", period: "2026-10-01" }, "serviço", "2026-10-15")
    ).toBe(false);
    expect(sameCycleSlot({ service: "Serviço", period: "OS-15" }, "outro", "OS-15")).toBe(false);
    expect(sameCycleSlot({ service: "Serviço", period: "OS-15" }, "serviço", "OS-16")).toBe(false);
  });

  it("preserves started work and requires reopening downstream execution first", () => {
    const record = recordFixture();
    const input = {
      anchorLabel: "Recebimento conferido",
      anchorOn: "2026-10-10",
      rules: [{ obligationId: "pgr", offsetDays: 10 }],
    };
    record.cycles[0].tasks[0].status = "doing";
    expect(() => previewTaskSchedule(record, "record_initial", input)).toThrow(/não iniciadas/);
    record.cycles[0].tasks[0].status = "todo";
    record.cycles[0].cards.find((card) => card.id === "produce")!.status = "done";
    expect(() => previewTaskSchedule(record, "record_initial", input)).toThrow(/Reabra/);
    record.active = false;
    expect(() => previewTaskSchedule(record, "record_initial", input)).toThrow(/Reative/);
  });
});
