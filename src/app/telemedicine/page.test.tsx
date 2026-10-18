import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: null as any,
  role: "ADMIN",
  db: {} as any,
  records: [] as any[],
  loading: false,
  error: null as any,
  toast: vi.fn(),
  add: vi.fn(),
  query: vi.fn((...args: any[]) => args),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user, role: m.role }),
  useFirestore: () => m.db,
  useCollection: () => ({ data: m.records, isLoading: m.loading, error: m.error }),
  useMemoFirebase: (fn: any) => fn(),
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: any, path: string) => path,
  query: m.query,
  orderBy: (...args: any[]) => args,
  limit: (n: number) => n,
  Timestamp: { fromDate: (d: Date) => d.toISOString() },
  serverTimestamp: () => "SERVER_TIME",
  addDoc: m.add,
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "author" };
  m.role = "ADMIN";
  m.db = {};
  m.records = [];
  m.loading = false;
  m.error = null;
  m.toast.mockReset();
  m.add.mockReset().mockResolvedValue({ id: "saved" });
  m.query.mockClear();
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
async function form() {
  await v.click("Novo agendamento");
  for (const [id, value] of Object.entries({
    titulo: "Consulta sintética",
    pacienteEmail: "patient@example.com",
    medicoEmail: "doctor@example.com",
    data: "2099-10-18",
    hora: "10:30",
    linkMeet: "https://meet.google.com/abc-defg-hij",
  }))
    await v.input("#" + id, value);
}
describe("Administrative telemedicine appointments", () => {
  it.each([null, "DOCTOR", "CLIENT"])(
    "does not query or write for an unauthorized session: %s",
    async (role) => {
      if (role === null) m.user = null;
      else m.role = role;
      await v.render(<Page />);
      expect(m.query).not.toHaveBeenCalled();
      expect(v.container.textContent).toMatch(/Entre no NAI|equipe autorizada/);
      expect(m.add).not.toHaveBeenCalled();
    }
  );
  it("separates loading, query failure, and an empty agenda", async () => {
    m.loading = true;
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Carregando agendamentos");
    m.loading = false;
    m.error = new Error("denied");
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Não foi possível consultar");
    expect(v.container.textContent).not.toContain("Nenhum agendamento");
    m.error = null;
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Nenhum agendamento cadastrado");
    expect(m.query).toHaveBeenCalledWith("agendamentos_telemedicina", ["inicio", "desc"], 50);
  });
  it("saves a Brasília appointment with a 30 minute duration and unsent invitation", async () => {
    await v.render(<Page />);
    await form();
    await v.submit();
    expect(m.add).toHaveBeenCalledWith("agendamentos_telemedicina", {
      titulo: "Consulta sintética",
      paciente_email: "patient@example.com",
      medico_email: "doctor@example.com",
      inicio: "2099-10-18T13:30:00.000Z",
      fim: "2099-10-18T14:00:00.000Z",
      link_meet: "https://meet.google.com/abc-defg-hij",
      status: "agendada",
      is_mock: false,
      invitationStatus: "not_sent",
      createdBy: "author",
      createdAt: "SERVER_TIME",
    });
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Agendamento salvo",
        description: expect.stringContaining("Nenhum convite foi enviado"),
      })
    );
    expect(document.querySelector("#pacienteEmail")).toBeNull();
    await v.click("Novo agendamento");
    expect((document.querySelector("#pacienteEmail") as HTMLInputElement).value).toBe("");
  });
  it("blocks invalid meeting links and allows correction", async () => {
    await v.render(<Page />);
    await form();
    await v.input("#linkMeet", "https://example.com/room");
    await v.submit();
    expect(m.add).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Agendamento não salvo" })
    );
    await v.input("#linkMeet", "https://meet.google.com/abc-defg-hij");
    await v.submit();
    expect(m.add).toHaveBeenCalledOnce();
  });
  it("preserves a failed appointment for retry and hides Firebase internals", async () => {
    const e = new Error("private database details");
    e.name = "FirebaseError";
    m.add.mockRejectedValueOnce(e);
    await v.render(<Page />);
    await form();
    await v.submit();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: "Verifique a conexão e sua permissão antes de tentar novamente.",
      })
    );
    expect((document.querySelector("#pacienteEmail") as HTMLInputElement).value).toBe(
      "patient@example.com"
    );
    await v.submit();
    expect(m.add).toHaveBeenCalledTimes(2);
  });
  it("prevents duplicate writes while saving", async () => {
    const pending = deferred<any>();
    m.add.mockReturnValueOnce(pending.promise);
    await v.render(<Page />);
    await form();
    await v.submit();
    await v.submit();
    expect(m.add).toHaveBeenCalledOnce();
    expect(v.button("Salvar agendamento").disabled).toBe(true);
    await act(async () => pending.resolve({ id: "ok" }));
  });
  it.each(["resolve", "reject"])("ignores a late %s after the account changes", async (outcome) => {
    const pending = deferred<any>();
    m.add.mockReturnValueOnce(pending.promise);
    await v.render(<Page />);
    await form();
    await v.submit();
    m.user = { uid: "other" };
    await v.render(<Page />);
    await act(async () =>
      outcome === "resolve" ? pending.resolve({ id: "ok" }) : pending.reject(new Error("late"))
    );
    expect(m.toast).not.toHaveBeenCalled();
    expect(document.querySelector("#pacienteEmail")).toBeNull();
  });
  it("only opens real valid meeting URLs and handles missing metadata", async () => {
    m.records = [
      {
        id: "real",
        titulo: "Real",
        is_mock: false,
        link_meet: "https://meet.google.com/abc-defg-hij",
        inicio: { toDate: () => new Date("2026-10-18T13:30:00Z") },
      },
      { id: "mock", is_mock: true, link_meet: "https://meet.google.com/abc-defg-hij" },
      {
        id: "bad",
        is_mock: false,
        link_meet: "javascript:alert(1)",
        inicio: { toDate: () => new Date("invalid") },
      },
    ];
    await v.render(<Page />);
    const links = [...v.container.querySelectorAll<HTMLAnchorElement>("a")].filter((a) =>
      a.href.includes("meet.google.com")
    );
    expect(links).toHaveLength(1);
    expect(links[0].rel).toBe("noopener noreferrer");
    expect(v.container.textContent).toContain("10:30");
    expect(v.container.textContent).toContain("Data não informada");
    expect(v.container.textContent).toContain("Paciente não informado");
    expect(v.container.textContent).toContain("Status não informado");
  });
});
