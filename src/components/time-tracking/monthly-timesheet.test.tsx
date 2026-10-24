import React from "react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  queries: [] as unknown[][],
  data: [] as unknown[],
  loading: false,
  error: null as Error | null,
  employer: null as unknown,
  print: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useDoc: () => ({ data: m.employer, isLoading: false, error: null }),
  useCollection: () => ({ data: m.data, isLoading: m.loading, error: m.error }),
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...p: string[]) => p.join("/"),
  doc: (_db: unknown, ...p: string[]) => p.join("/"),
  where: (...args: unknown[]) => args,
  query: (...args: unknown[]) => {
    m.queries.push(args);
    return args;
  },
}));
import { MonthlyTimesheet } from "./monthly-timesheet";
let v: ReturnType<typeof ui>;
const person = {
  id: "synthetic",
  name: "Pessoa teste",
  cpf: "CPF sintético",
  admissionDate: "2026-01-02",
  role: "Assistente",
  workSchedule: "Seg a sex 08h às 17h / intervalo 12h às 13h",
  weeklyHours: 40,
  employer: { companyName: "Empresa sintética", cnpj: "CNPJ sintético" },
};
beforeEach(() => {
  v = ui();
  m.queries = [];
  m.data = [];
  m.loading = false;
  m.error = null;
  m.employer = null;
  m.print.mockReset();
  vi.stubGlobal("print", m.print);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
it("requests the whole authorized month, prints only on explicit action and includes identification and all days", async () => {
  await v.render(<MonthlyTimesheet employee={person} employeePath="nxc_employees" rosterReady />);
  await v.input('input[type="month"]', "2026-02");
  expect(m.queries.at(-1)).toEqual([
    "nxc_employees/synthetic/time_clock_entries",
    ["date", ">=", "2026-02-01"],
    ["date", "<", "2026-03-01"],
  ]);
  const paper = document.querySelector(".clt-timesheet-print")!;
  expect(paper.querySelectorAll("tbody tr")).toHaveLength(28);
  for (const text of [
    "Empresa sintética",
    "CNPJ sintético",
    "CPF sintético",
    "02/01/2026",
    "Assistente",
    "40",
    "PRELIMINAR",
  ])
    expect(paper.textContent).toContain(text);
  expect(m.print).not.toHaveBeenCalled();
  await v.click("Imprimir folha mensal");
  expect(m.print).toHaveBeenCalledOnce();
});
it("blocks printing and removes private output when data fails, loads or roster authorization is lost", async () => {
  for (const state of ["error", "loading", "roster"]) {
    m.error = state === "error" ? Error("denied") : null;
    m.loading = state === "loading";
    await v.render(
      <MonthlyTimesheet
        employee={person}
        employeePath="nxc_employees"
        rosterReady={state !== "roster"}
      />
    );
    expect(v.button("Imprimir folha mensal").disabled).toBe(true);
    expect(document.querySelector(".clt-timesheet-print")!.textContent).not.toContain(person.cpf);
  }
});
it("uses the selected tenant employer and marks missing fields rather than borrowing internal company defaults", async () => {
  m.employer = { name: "Cliente selecionado", cnpj: "Cadastro cliente" };
  await v.render(
    <MonthlyTimesheet
      employee={{ ...person, cpf: undefined, workSchedule: undefined }}
      employeePath="companies/tenant-a/employees"
      rosterReady
    />
  );
  const paper = document.querySelector(".clt-timesheet-print")!.textContent;
  expect(paper).toContain("Cliente selecionado");
  expect(paper).not.toContain("Empresa sintética");
  expect(paper).toContain("Cadastro pendente");
  expect(paper).not.toContain("44.337.647");
});
it("clears print output when the selected employee is removed", async () => {
  await v.render(<MonthlyTimesheet employee={person} employeePath="nxc_employees" rosterReady />);
  await v.render(<MonthlyTimesheet employee={null} employeePath="nxc_employees" rosterReady />);
  expect(document.querySelector(".clt-timesheet-print")!.textContent).not.toContain(person.cpf);
  expect(v.button("Imprimir folha mensal").disabled).toBe(true);
});
