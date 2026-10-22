import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  listener: undefined as undefined | ((user: unknown) => void),
  auth: {},
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "a".repeat(48) }) }));
vi.mock("@/firebase", () => ({ useAuth: () => m.auth }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_: unknown, callback: (user: unknown) => void) => {
    m.listener = callback;
    return () => undefined;
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));
import Page from "./page";
let root: Root;
let container: HTMLDivElement;
const user = { uid: "doctor", email: "doctor@example.test", getIdToken: async () => "token" };
const view = {
  identity: {
    employeeName: "Private Worker",
    companyName: "Company",
    cpf: "123",
    cnpj: "456",
    roleTitle: "Role",
    department: "Dept",
    examType: "periodico",
  },
  role: "doctor",
  state: "invited",
  version: 0,
  expiresAt: "2030-01-01",
  clinicName: "Clinic",
  doctorName: "Doctor",
  crm: "123",
  uf: "PR",
  exams: [],
  risks: [],
  clinical: {
    attendanceDate: "2026-01-01",
    history: "PRIVATE ANAMNESIS",
    occupationalHistory: "",
    medications: "",
    complaints: "",
    vitalSigns: "",
    physicalExam: "",
    results: "",
    conduct: "",
    conclusion: "pendente",
    observations: "",
  },
};
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Page />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("clears the previous account's identity and clinical form on account change", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => view }));
  await act(async () => m.listener?.(user));
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Abrir atendimento")!
      .click()
  );
  expect(container.textContent).toContain("Private Worker");
  expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
    "PRIVATE ANAMNESIS"
  );
  await act(async () => m.listener?.({ ...user, uid: "other", email: "other@example.test" }));
  expect(container.textContent).not.toContain("Private Worker");
  expect(container.querySelector("textarea")).toBeNull();
});
it("discards a late clinical response after sign-out", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    )
  );
  await act(async () => m.listener?.(user));
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Abrir atendimento")!
      .click()
  );
  await act(async () => m.listener?.(null));
  await act(async () => resolve({ ok: true, json: async () => view }));
  expect(container.textContent).not.toContain("Private Worker");
  expect(container.textContent).toContain("Entrar com o e-mail convidado");
  expect(container.querySelector("textarea")).toBeNull();
});
