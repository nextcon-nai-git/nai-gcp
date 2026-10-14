import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ transaction: vi.fn(), set: vi.fn(), get: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  serverTimestamp: () => "timestamp",
  runTransaction: mock.transaction,
}));
import { EmployeeCreateDialog } from "./employee-create-dialog";
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  mock.get.mockResolvedValue({ exists: () => false });
  mock.transaction.mockImplementation(async (_db, fn) => fn({ get: mock.get, set: mock.set }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function form(cpf: string) {
  const saved = vi.fn(),
    close = vi.fn();
  await act(async () =>
    root.render(
      <EmployeeCreateDialog
        open
        onOpenChange={close}
        db={{} as never}
        companies={[{ id: "synthetic-company", name: "Synthetic company" }]}
        selectedCompany="synthetic-company"
        onSaved={saved}
      />
    )
  );
  (document.getElementById("employee-name") as HTMLInputElement).value = "Pessoa sintética";
  (document.getElementById("employee-job") as HTMLInputElement).value = "Assistente";
  (document.getElementById("employee-cpf") as HTMLInputElement).value = cpf;
  await act(async () => {
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  return { saved, close };
}
it("rejects repeated-digit CPF before persistence", async () => {
  await form("00000000000");
  expect(mock.transaction).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("CPF válido");
});
it("does not overwrite an existing CPF", async () => {
  mock.get.mockResolvedValue({ exists: () => true });
  const f = await form("52998224725");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("já possui");
  expect(mock.set).not.toHaveBeenCalled();
  expect(f.saved).not.toHaveBeenCalled();
});
it("confirms success only after persistence and preserves the company", async () => {
  const f = await form("52998224725");
  expect(f.saved).toHaveBeenCalledOnce();
  expect(mock.set.mock.calls[0][1]).toMatchObject({
    companyId: "synthetic-company",
    job_role: { title: "Assistente" },
    status: "active",
  });
  expect(mock.set.mock.calls[0][1]).not.toHaveProperty("fitnessStatus");
});

it("OCR prefill waits for review, requires an explicit company, and never grants fitness", async () => {
  const saved = vi.fn();
  await act(async () =>
    root.render(
      <EmployeeCreateDialog
        open
        onOpenChange={vi.fn()}
        db={{} as never}
        companies={[{ id: "synthetic-company", name: "Synthetic company" }]}
        selectedCompany="all"
        onSaved={saved}
        initialValues={{
          name: "Pessoa sintética",
          cpf: "52998224725",
          jobTitle: "Assistente",
          birthDate: "1988-05-15",
          cnhCategory: "B",
          cnhExpiration: "2028-10-15",
        }}
      />
    )
  );
  expect((document.getElementById("employee-name") as HTMLInputElement).value).toBe(
    "Pessoa sintética"
  );
  expect((document.getElementById("employee-company") as HTMLSelectElement).value).toBe("");
  expect(mock.transaction).not.toHaveBeenCalled();
  await act(async () => {
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mock.transaction).not.toHaveBeenCalled();
  (document.getElementById("employee-company") as HTMLSelectElement).value = "synthetic-company";
  await act(async () => {
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(saved).toHaveBeenCalledOnce();
  expect(mock.set.mock.calls[0][1]).toMatchObject({
    companyId: "synthetic-company",
    birthDate: "1988-05-15",
    cnhCategory: "B",
    cnhExpiration: "2028-10-15",
  });
  expect(mock.set.mock.calls[0][1]).not.toHaveProperty("fitnessStatus");
});
