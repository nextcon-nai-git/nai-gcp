import { describe, expect, it } from "vitest";
import {
  FinancialActionImportSchema,
  FinancialActionPatchSchema,
  isFinancialEvidenceUrl,
} from "./actions";
import { actionImportFixture } from "../../../tests/fixtures/financial-actions";

describe("financial action import contract", () => {
  it("accepts the versioned contract and requires a rationale, evidence and caveat", () => {
    expect(FinancialActionImportSchema.parse(actionImportFixture)).toEqual(actionImportFixture);
    for (const field of ["rationale", "caveat"] as const) {
      const data = structuredClone(actionImportFixture);
      data.actions[0][field] = " ";
      expect(FinancialActionImportSchema.safeParse(data).success).toBe(false);
    }
    const data = structuredClone(actionImportFixture);
    data.actions[0].evidence = [];
    expect(FinancialActionImportSchema.safeParse(data).success).toBe(false);
  });
  it("rejects unsupported versions, duplicate keys, invalid dates and fractional cent values", () => {
    expect(
      FinancialActionImportSchema.safeParse({ ...actionImportFixture, schemaVersion: 2 }).success
    ).toBe(false);
    expect(
      FinancialActionImportSchema.safeParse({
        ...actionImportFixture,
        actions: [...actionImportFixture.actions, ...actionImportFixture.actions],
      }).success
    ).toBe(false);
    for (const change of [
      { proposedDueDate: "2026-02-30" },
      { period: { start: "2026-10-01", end: "2026-09-30", label: "Invertido" } },
      { baseAmountCents: 1.5 },
      { estimatedSavingsCents: -1 },
      { estimateBasis: undefined },
      {
        checklist: [
          actionImportFixture.actions[0].checklist[0],
          actionImportFixture.actions[0].checklist[0],
        ],
      },
    ]) {
      expect(
        FinancialActionImportSchema.safeParse({
          ...actionImportFixture,
          actions: [{ ...actionImportFixture.actions[0], ...change }],
        }).success
      ).toBe(false);
    }
  });
  it("cannot import a completed action with pending required checks or inject server fields", () => {
    expect(
      FinancialActionImportSchema.safeParse({
        ...actionImportFixture,
        actions: [{ ...actionImportFixture.actions[0], status: "done" }],
      }).success
    ).toBe(false);
    expect(
      FinancialActionImportSchema.safeParse({ ...actionImportFixture, importedBy: "other-admin" })
        .success
    ).toBe(false);
    expect(
      FinancialActionImportSchema.safeParse({
        ...actionImportFixture,
        actions: [{ ...actionImportFixture.actions[0], version: 100 }],
      }).success
    ).toBe(false);
  });
  it("allows only safe source links and protected document identifiers", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "//external.test/path",
      "/api/financial/actions",
      "/financial/../../admin",
      "https://user:password@example.com",
      "https://example.com\n/path",
      "https://example.com\\path",
    ]) {
      expect(isFinancialEvidenceUrl(url), url).toBe(false);
    }
    expect(isFinancialEvidenceUrl("https://www.gov.br/nfse/pt-br/biblioteca/aliquotas")).toBe(true);
    expect(isFinancialEvidenceUrl("/financial/omie/dre?start=2026-01-01")).toBe(true);
    const data = structuredClone(actionImportFixture);
    data.actions[0].evidence[0].document = { kind: "ledger", id: "../private" };
    expect(FinancialActionImportSchema.safeParse(data).success).toBe(false);
  });
  it("limits patches to status and checked flags with a version", () => {
    const patch = {
      batchId: "a".repeat(64),
      actionId: "b".repeat(64),
      expectedVersion: 1,
      status: "in_progress",
    };
    expect(FinancialActionPatchSchema.safeParse(patch).success).toBe(true);
    expect(FinancialActionPatchSchema.safeParse({ ...patch, expectedVersion: 0 }).success).toBe(
      false
    );
    expect(
      FinancialActionPatchSchema.safeParse({ ...patch, title: "Changed evidence" }).success
    ).toBe(false);
    expect(
      FinancialActionPatchSchema.safeParse({
        ...patch,
        checklist: [{ id: "documento", checked: true, required: false }],
      }).success
    ).toBe(false);
    expect(
      FinancialActionPatchSchema.safeParse({
        ...patch,
        checklist: [{ id: "documento", checked: true, text: "Changed required item" }],
      }).success
    ).toBe(false);
  });
});
