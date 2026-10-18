import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  scope: "a",
  role: "DOCTOR",
  user: { uid: "doctor" } as any,
  status: "Em Atendimento",
  error: null as any,
  create: vi.fn(),
  advance: vi.fn(),
  headers: vi.fn(),
  fetch: vi.fn(),
  toast: vi.fn(),
  review: null as any,
}));
const appointment = () => ({
  id: "appointment",
  companyId: m.scope,
  colaborador_id: "employee",
  colaborador_nome: "Pessoa sintética",
  companyName: "Empresa sintética",
  status: m.status,
  data_hora: "2026-10-18T08:00:00",
  tipo: "Periódico",
});
vi.mock("@/firebase", async () => ({
  useUser: () => ({
    user: m.user,
    role: m.role,
    companyId: m.scope,
    servedCompanies: [],
    isUserLoading: false,
  }),
  useFirestore: () => db,
  useMemoFirebase: React.useMemo,
  useCollection: (q: any) => ({
    data: !q
      ? null
      : q.mode
        ? q.mode === "active" || (q.mode === "scheduled" && m.status === "Agendado")
          ? [appointment()]
          : []
        : q.path?.at(-1) === "clinical_records"
          ? [
              {
                id: "aso",
                companyId: m.scope,
                sourceHash: "a".repeat(64),
                fileName: "ASO sintético.pdf",
                storageGeneration: "1",
                clinicalReview: m.review,
              },
            ]
          : q.path?.at(-1) === "employees"
            ? [{ id: "employee", name: "Pessoa sintética" }]
            : [{ id: m.scope, name: "Empresa sintética" }],
    isLoading: false,
    error: m.error,
  }),
}));
const db = {};
vi.mock("firebase/firestore", () => ({
  collection: (_: any, ...path: string[]) => ({ path }),
  query: (c: any) => c,
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/services/clinical-scheduling", () => ({
  createClinicalAppointment: m.create,
  advanceClinicalAppointment: m.advance,
}));
vi.mock("@/services/clinical-queue", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  clinicalQueueToday: () => "2026-10-18",
  clinicalQueueQuery: (_: any, company: string, mode: string) => ({ company, mode }),
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ activeClientId: m.scope, isGlobalStaff: false, authorizedCompanies: [m.scope] }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/pgr-request-headers", () => ({ pgrRequestHeaders: m.headers }));
vi.mock("@/components/GoogleCalendarSyncWidget", () => ({ GoogleCalendarSyncWidget: () => null }));
vi.mock("@/components/ui/select", () => import("../../../tests/ui/native-select"));
import Page from "./clinical-workspace";
let v: ReturnType<typeof ui>;
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  v = ui();
  m.scope = "a";
  m.role = "DOCTOR";
  m.user = { uid: "doctor" };
  m.status = "Em Atendimento";
  m.error = null;
  m.review = null;
  for (const mock of [m.create, m.advance, m.headers, m.fetch, m.toast]) mock.mockReset();
  m.create.mockResolvedValue({ employeeName: "Pessoa sintética" });
  m.advance.mockResolvedValue(undefined);
  m.headers.mockResolvedValue({ Authorization: "Bearer token" });
  m.fetch.mockResolvedValue(new Response("pdf"));
  vi.stubGlobal("fetch", m.fetch);
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn().mockReturnValue("blob:aso") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function selectAso() {
  await v.render(<Page />);
  await v.click("Retomar atendimento");
  await v.input('[role="dialog"] select', "a".repeat(64));
}
async function original() {
  await selectAso();
  await v.click("Carregar ASO original");
  await act(async () => document.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
}
describe("clinical confirmation workflow", () => {
  it("requires original inspection and a persisted review before completion", async () => {
    await selectAso();
    expect(v.button("Registrar revisão clínica").disabled).toBe(true);
    await v.click("Carregar ASO original");
    expect(m.fetch.mock.calls[0][0]).toContain("companyId=a&cardId=");
    expect(v.button("Registrar revisão clínica").disabled).toBe(true);
    await act(async () => document.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
    m.fetch.mockResolvedValueOnce(json({ status: "reviewed" }));
    await v.click("Registrar revisão clínica");
    const payload = JSON.parse(m.fetch.mock.calls.at(-1)![1].body);
    expect(payload).toMatchObject({
      action: "review",
      companyId: "a",
      employeeId: "employee",
      confirmedOriginal: true,
      appointmentSnapshot: {
        appointmentId: "appointment",
        employeeName: "Pessoa sintética",
        dateTime: "2026-10-18T08:00:00",
      },
    });
    m.fetch.mockResolvedValueOnce(json({ status: "completed" }));
    await v.click("Vincular ASO e concluir");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Atendimento concluído" })
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it.each(["denied", "unconfirmed"])("does not enable completion for a %s review", async (mode) => {
    await original();
    m.fetch.mockResolvedValueOnce(
      mode === "denied" ? json({ error: "Denied" }, 403) : json({ status: "pending" })
    );
    await v.click("Registrar revisão clínica");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Revisão não confirmada" })
    );
    expect(document.body.textContent).not.toContain("Vincular ASO e concluir");
  });
  it("keeps the appointment open when completion is not confirmed", async () => {
    await original();
    m.fetch.mockResolvedValueOnce(json({ status: "reviewed" }));
    await v.click("Registrar revisão clínica");
    m.fetch.mockResolvedValueOnce(json({ error: "Conflict" }, 409));
    await v.click("Vincular ASO e concluir");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Vínculo não confirmado" })
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it("reports unavailable originals and leaves confirmation disabled", async () => {
    await selectAso();
    m.fetch.mockResolvedValueOnce(json({ error: "Original indisponível" }, 404));
    await v.click("Carregar ASO original");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Original não disponível" })
    );
    expect(v.button("Registrar revisão clínica").disabled).toBe(true);
  });
  it("revokes an opened original and clears review context on company change", async () => {
    await original();
    m.scope = "b";
    await v.render(<Page />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:aso");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("does not fetch an original after delayed credentials from the old company", async () => {
    await selectAso();
    const p = deferred<any>();
    m.headers.mockReturnValueOnce(p.promise);
    await v.click("Carregar ASO original");
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve({ Authorization: "old" }));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("does not announce a late review from a former session", async () => {
    await original();
    const p = deferred<Response>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Registrar revisão clínica");
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve(json({ status: "reviewed" })));
    expect(m.toast).not.toHaveBeenCalled();
  });
  it("blocks reuse of a review belonging to another appointment", async () => {
    m.review = { status: "reviewed", appointmentId: "different" };
    await selectAso();
    expect(document.body.textContent).toContain("revisado para outro vínculo");
    expect(document.body.textContent).not.toContain("Vincular ASO e concluir");
  });
  it("requires a doctor for document review", async () => {
    m.role = "OPERATIONS";
    await v.render(<Page />);
    await v.click("Retomar atendimento");
    expect(document.body.textContent).toContain("exigem um médico atualmente autorizado");
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("confirms check-in only after persistence and blocks duplicate transitions", async () => {
    m.status = "Agendado";
    const p = deferred<any>();
    m.advance.mockReturnValueOnce(p.promise);
    await v.render(<Page />);
    await v.click("Check-in");
    await v.click("Check-in");
    expect(m.advance).toHaveBeenCalledOnce();
    expect(m.toast).not.toHaveBeenCalled();
    await act(async () => p.resolve(undefined));
    expect(m.advance).toHaveBeenCalledWith(db, "a", "appointment", "Em Espera");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Check-in Realizado" })
    );
  });
  it("opens clinical review after a successful start and reports transition failures", async () => {
    m.status = "Em Espera";
    m.advance.mockRejectedValueOnce(Error("conflict"));
    await v.render(<Page />);
    await v.click("Iniciar Atendimento");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível atualizar o atendimento" })
    );
    await v.click("Iniciar Atendimento");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it("validates scheduling fields and submits the selected employee/date/time", async () => {
    await v.render(<Page />);
    await v.click("Agendar Exame");
    await v.click("Confirmar Agendamento");
    expect(m.create).not.toHaveBeenCalled();
    const select = document.querySelectorAll('[role="dialog"] select')[1];
    select.setAttribute("data-employee", "true");
    await v.input("select[data-employee]", "employee");
    await v.input('[role="dialog"] input[type="date"]', "2026-10-24");
    await v.input('input[type="time"]', "09:30");
    await v.click("Confirmar Agendamento");
    expect(m.create).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        companyId: "a",
        employeeId: "employee",
        date: "2026-10-24",
        time: "09:30",
      })
    );
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Exame Agendado" }));
  });
  it("keeps scheduling available after a failure without displaying old session success", async () => {
    await v.render(<Page />);
    await v.click("Agendar Exame");
    document.querySelectorAll('[role="dialog"] select')[1].setAttribute("data-employee", "true");
    await v.input("select[data-employee]", "employee");
    m.create.mockRejectedValueOnce(Error("offline"));
    await v.click("Confirmar Agendamento");
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Erro ao Agendar" }));
    m.toast.mockClear();
    const p = deferred<any>();
    m.create.mockReturnValueOnce(p.promise);
    await v.click("Confirmar Agendamento");
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve({ employeeName: "Pessoa antiga" }));
    expect(m.toast).not.toHaveBeenCalled();
  });
});
