import { expect, it } from "vitest";
import {
  expertCompanyIds,
  formatExpertDeadline,
  projectExpertCompany,
  projectExpertTask,
} from "./expert-workspace";
it.each([
  ["2026-11-03", "03/11/2026"],
  ["2026-11-03T00:00:00.000Z", "03/11/2026"],
  ["2026-11-03T23:59:59Z", "03/11/2026"],
  ["2026-11-03T23:59:59.999-03:00", "03/11/2026"],
  ["2028-02-29T00:00:00.000Z", "29/02/2028"],
  ["", "Não informado"],
  ["invalid", "Não informado"],
  ["2026-02-29", "Não informado"],
  ["2026-02-30T00:00:00.000Z", "Não informado"],
  ["2026-11-03T99:00:00.000Z", "Não informado"],
  ["2026-11-03garbage", "Não informado"],
])("formats card deadline %s without changing its calendar day", (input, expected) => {
  expect(formatExpertDeadline(input)).toBe(expected);
});
it("drops commercial, clinical, attachment and internal fields instead of returning whole documents", () => {
  const company = projectExpertCompany("allowed", {
    name: "Sintética",
    cnpj: "123",
    contractUrl: "secret",
    billingValue: 500,
    bank: "secret",
    employees: ["private"],
  });
  expect(company).toEqual({ id: "allowed", name: "Sintética", cnpj: "123", city: "", state: "" });
  const task = projectExpertTask("task", {
    title: "Verificar posto",
    status: "todo",
    dueDate: "2026-11-03",
    financial: { value: 100 },
    attachments: ["private"],
    checklist: [{ text: "Conferir evidência", checked: true, patient: "private" }],
  });
  expect(task.checklist).toEqual([{ text: "Conferir evidência", checked: true }]);
  expect(JSON.stringify({ company, task })).not.toMatch(
    /secret|private|billing|financial|attachments/
  );
});
it("never converts an empty or global grant into a company scope", () => {
  expect(
    expertCompanyIds(["all", "nextcon", "unauthorized", "", "a/b", "unit", "unit", null])
  ).toEqual(["unit"]);
  expect(expertCompanyIds(undefined)).toEqual([]);
});
