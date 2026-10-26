import { expect, it } from "vitest";
import { expertCompanyIds, projectExpertCompany, projectExpertTask } from "./expert-workspace";
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
