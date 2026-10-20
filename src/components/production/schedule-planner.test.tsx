import React, { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
import {
  applyCommand,
  CommandSchema,
  emptyBook,
  type ProductionRecord,
} from "@/lib/production/model";
import { SchedulePlanner } from "./schedule-planner";

function recordFixture() {
  const command = CommandSchema.parse({
    action: "create",
    requestId: "fa57b815-55d0-42bc-b01c-de52cbdb320a",
    expectedVersion: 0,
    recordId: "r1",
    companyId: "c1",
    cnpj: "11222333000181",
    name: "Contrato teste",
    owner: "Equipe de teste",
    terms: {
      scope: "PGR e exames ASO",
      units: "Unidade de teste",
      deliverables: "Documentos revisados",
      valueCents: 9_999_900,
      startsOn: "2026-10-01",
      endsOn: "",
      paymentTerms: "Valor global, não uma mensalidade",
      recurring: true,
      obligations: [
        {
          id: "pgr",
          title: "Elaborar PGR",
          serviceType: "PGR",
          owner: "Engenharia",
          due: "2026-10-30",
          deadlineRule: "Após receber dados",
          trigger: "",
          sourceReference: "Contrato, cláusula 3",
          sourceExcerpt: "Elaborar PGR conforme a ordem de serviço.",
        },
        {
          id: "aso",
          title: "Realizar ASOs",
          serviceType: "ASO",
          owner: "",
          due: "",
          deadlineRule: "Cinco dias corridos após a ordem",
          trigger: "Quando houver solicitação",
          sourceReference: "Contrato, cláusula 4",
          sourceExcerpt: "Realizar ASOs solicitados em cinco dias corridos.",
        },
      ],
    },
    document: null,
    effectiveOn: "2026-10-01",
    evidence: "Contrato sintético revisado",
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
let screen: ReturnType<typeof ui>;
let record: ProductionRecord;
type SaveSchedule = React.ComponentProps<typeof SchedulePlanner>["save"];
let save: ReturnType<typeof vi.fn<SaveSchedule>>;
beforeEach(() => {
  screen = ui();
  record = recordFixture();
  save = vi.fn<SaveSchedule>().mockResolvedValue(true);
});
afterEach(async () => screen.cleanup());
async function render(disabled = false, currentRecord = record, cycleId = "r1_initial") {
  await screen.render(
    <SchedulePlanner record={currentRecord} cycleId={cycleId} disabled={disabled} save={save} />
  );
}
async function selectObligation(id: string) {
  await act(async () =>
    screen.container
      .querySelector<HTMLInputElement>(`[name="scheduleObligationIds"][value="${id}"]`)!
      .click()
  );
}
async function approve() {
  await act(async () =>
    screen.container
      .querySelector<HTMLInputElement>(
        '[aria-label="Prévia da programação"] input[type="checkbox"]'
      )!
      .click()
  );
}
async function currentPreview() {
  await screen.input('[name="scheduleAnchorLabel"]', "Recebimento dos dados");
  await screen.input('[name="scheduleAnchorOn"]', "2026-10-10");
  await screen.input(
    '[name="scheduleReason"]',
    "Recebimento e prazo conferidos na ordem de serviço"
  );
  await selectObligation("pgr");
  await screen.input('[name="scheduleOffset.pgr"]', "15");
  await screen.submit();
}
async function recurringFields() {
  await screen.input('[name="scheduleMode"]', "cycles");
  await screen.input('[name="scheduleRevision"]', "0");
  await screen.input('[name="scheduleService"]', "ASOs recorrentes");
  await screen.input('[name="scheduleFrequency"]', "monthly");
  await screen.input('[name="scheduleOccurrences"]', "3");
  await screen.input('[name="scheduleAnchorLabel"]', "Ordem mensal aprovada");
  await screen.input('[name="scheduleAnchorOn"]', "2027-01-31");
  await screen.input(
    '[name="scheduleReason"]',
    "Frequência e valor por competência conferidos no contrato"
  );
  await selectObligation("aso");
  await screen.input('[name="scheduleOffset.aso"]', "5");
}

it("shows source, anchor, offset, previous and calculated dates before an approved command", async () => {
  await render();
  await currentPreview();
  const preview = screen.container.querySelector('[aria-label="Prévia da programação"]')!;
  expect(preview.textContent).toContain("Contrato, cláusula 3");
  expect(preview.textContent).toContain("2026-10-10");
  expect(preview.textContent).toContain("2026-10-30");
  expect(preview.textContent).toContain("2026-10-25");
  expect(save).not.toHaveBeenCalled();
  expect(screen.button("Aplicar programação aprovada").disabled).toBe(true);
  await approve();
  await screen.click("Aplicar programação aprovada");
  expect(save).toHaveBeenCalledWith({
    action: "scheduleTasks",
    cycleId: "r1_initial",
    reviewed: true,
    reason: "Recebimento e prazo conferidos na ordem de serviço",
    plan: {
      anchorLabel: "Recebimento dos dados",
      anchorOn: "2026-10-10",
      rules: [{ obligationId: "pgr", offsetDays: 15 }],
    },
  });
  expect(screen.container.textContent).toContain("Programação registrada");
});

it("keeps a missing anchor unresolved instead of using the current or contract date", async () => {
  await render();
  expect(screen.container.querySelector<HTMLInputElement>('[name="scheduleAnchorOn"]')!.value).toBe(
    ""
  );
  await screen.input('[name="scheduleAnchorLabel"]', "Assinatura conferida");
  await screen.input('[name="scheduleReason"]', "Cláusula revisada");
  await selectObligation("pgr");
  await screen.input('[name="scheduleOffset.pgr"]', "15");
  await screen.submit();
  expect(screen.container.querySelector('[role="alert"]')!.textContent).toContain("data válida");
  expect(screen.container.querySelector('[aria-label="Prévia da programação"]')).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("invalidates an already-approved preview when any scheduling field changes", async () => {
  await render();
  await currentPreview();
  await approve();
  await screen.input('[name="scheduleOffset.pgr"]', "20");
  expect(screen.container.querySelector('[aria-label="Prévia da programação"]')).toBeNull();
  await screen.submit();
  expect(screen.button("Aplicar programação aprovada").disabled).toBe(true);
  expect(
    screen.container.querySelector('[aria-label="Prévia da programação"]')!.textContent
  ).toContain("2026-10-30");
  expect(save).not.toHaveBeenCalled();
});

it("requires explicit recurrence selection and previews a per-cycle price without using the global amount", async () => {
  await render();
  await recurringFields();
  expect(screen.container.querySelector<HTMLInputElement>('[name="scheduleAmount"]')!.value).toBe(
    ""
  );
  await screen.input('[name="scheduleAmount"]', "12,34");
  await screen.submit();
  const preview = screen.container.querySelector('[aria-label="Prévia da programação"]')!;
  expect(preview.textContent).toContain("3 novos ciclos");
  expect(preview.textContent).toContain("2027-01-31");
  expect(preview.textContent).toContain("2027-02-28");
  expect(preview.textContent).toContain("2027-03-31");
  expect(preview.textContent).toContain("37,02");
  expect(preview.textContent).not.toContain("Elaborar PGR");
  await approve();
  await screen.click("Aplicar programação aprovada");
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "scheduleCycles",
      seriesId: expect.any(String),
      reviewed: true,
      plan: expect.objectContaining({
        revision: 0,
        firstOn: "2027-01-31",
        frequency: "monthly",
        occurrences: 3,
        contractedCents: 1234,
        rules: [{ obligationId: "aso", offsetDays: 5 }],
      }),
    })
  );
});

it("allows pending prices and pending selected deadlines but rejects zero prices", async () => {
  await render();
  await recurringFields();
  await screen.input('[name="scheduleAmount"]', "0");
  await screen.submit();
  expect(screen.container.querySelector('[role="alert"]')!.textContent).toContain("valor positivo");
  await screen.input('[name="scheduleAmount"]', "");
  await screen.input('[name="scheduleOffset.aso"]', "");
  await screen.submit();
  expect(
    screen.container.querySelector('[aria-label="Prévia da programação"]')!.textContent
  ).toContain("pendentes");
  await approve();
  await screen.click("Aplicar programação aprovada");
  expect(save.mock.calls[0][0].plan).toMatchObject({
    contractedCents: null,
    rules: [{ obligationId: "aso", offsetDays: null }],
  });
});

it.each(["record", "cycle"] as const)(
  "discards a preview after the selected %s changes",
  async (changed) => {
    await render();
    await currentPreview();
    await approve();
    await render(
      false,
      changed === "record" ? structuredClone(record) : record,
      changed === "cycle" ? "another-cycle" : "r1_initial"
    );
    expect(screen.container.querySelector('[aria-label="Prévia da programação"]')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  }
);

it("retains the form after failed persistence and requires review again", async () => {
  save.mockResolvedValue(false);
  await render();
  await currentPreview();
  await approve();
  await screen.click("Aplicar programação aprovada");
  expect(screen.container.querySelector('[role="alert"]')!.textContent).toContain(
    "Gravação não confirmada"
  );
  expect(screen.container.querySelector<HTMLInputElement>('[name="scheduleAnchorOn"]')!.value).toBe(
    "2026-10-10"
  );
  expect(screen.button("Aplicar programação aprovada").disabled).toBe(true);
  await render(true);
  await screen.click("Aplicar programação aprovada");
  expect(save).toHaveBeenCalledTimes(1);
});

it("submits once for rapid clicks and ignores a late response after unmount", async () => {
  const pending = deferred<boolean>();
  save.mockReturnValue(pending.promise);
  await render();
  await currentPreview();
  await approve();
  const button = screen.button("Aplicar programação aprovada");
  await act(async () => {
    button.click();
    button.click();
  });
  expect(save).toHaveBeenCalledTimes(1);
  await screen.render(<p>Outro registro</p>);
  await act(async () => pending.resolve(true));
  expect(screen.container.textContent).toBe("Outro registro");
});

it("highlights a reviewed delivery date outside contract validity", async () => {
  record.revisions[0].terms.endsOn = "2026-10-31";
  await render();
  await currentPreview();
  await screen.input('[name="scheduleAnchorOn"]', "2026-10-25");
  await screen.submit();
  expect(
    screen.container.querySelector('[aria-label="Prévia da programação"]')!.textContent
  ).toContain("2026-11-09");
  expect(screen.container.textContent).toContain(
    "Prazo fora da vigência; confira a regra de entrega."
  );
});
