import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  where: vi.fn(),
  commit: vi.fn(),
  set: vi.fn(),
  employee: {} as Record<string, unknown>,
}));
vi.mock("@/lib/firebase-admin", () => {
  const collection = (path: string): object => {
    const c = {
      doc: (id: string) => ({
        id,
        path: `${path}/${id}`,
        collection: (name: string) => collection(`${path}/${id}/${name}`),
      }),
      where: (...args: unknown[]) => {
        state.where(...args);
        return c;
      },
      select: () => c,
      limit: () => c,
      get: state.get,
    };
    return c;
  };
  return { adminDb: { collection, batch: () => ({ set: state.set, commit: state.commit }) } };
});
vi.mock("@/lib/developer-api-guard", async (original) => ({
  ...(await original<typeof import("@/lib/developer-api-guard")>()),
  requireDeveloperPrincipal: state.auth,
}));
import { POST } from "./route";
const request = (body: unknown) =>
  new NextRequest("https://nai.test/api/v1/access-control/check", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));
  state.auth.mockResolvedValue({
    id: "key-a",
    clientId: "company-a",
    scopes: ["access_control:read"],
  });
  state.employee = {
    name: "Pessoa sintética",
    companyId: "company-a",
    cpf: "123.456.789-09",
    badgeCode: "badge-a",
    status: "active",
    fitnessStatus: "Apto",
    nextAsoDate: "2027-01-20",
    requiredNrs: ["NR-10"],
    completedNrs: { "NR-10": "2026-12-31" },
  };
  state.get.mockImplementation(async () => ({
    size: 1,
    empty: false,
    docs: [{ id: "employee-a", data: () => state.employee }],
  }));
  state.commit.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
const check = async (body: unknown = { cpf: "12345678909" }) => {
  const response = await POST(request(body));
  return { status: response.status, body: await response.json(), response };
};
describe("controle de acesso M2M", () => {
  it("confere cadastro atual e CPF formatado com Admin SDK, sem cache público", async () => {
    const result = await check();
    expect(result.status).toBe(200);
    expect(result.body.allowed).toBe(true);
    expect(state.where).toHaveBeenCalledWith("cpf", "in", ["12345678909", "123.456.789-09"]);
    expect(state.commit).toHaveBeenCalledTimes(1);
    expect(result.response.headers.get("cache-control")).toContain("no-store");
  });
  it("preserva o endereço materializado do crachá após separar credenciais e identidade", async () => {
    expect((await check()).body.allowed).toBe(true);
    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "access_cards/d78346943f4eb35d07d02198f418875a7efcbb286d30e37dae9e1e096ac5460f",
      }),
      expect.objectContaining({ companyId: "company-a", badgeCode: "badge-a" })
    );
  });
  it.each(["fired", "leave", "inactive", "terminated"])(
    "nega cadastro %s mesmo com ASO ainda vigente",
    async (status) => {
      state.employee.status = status;
      expect((await check()).body.allowed).toBe(false);
    }
  );
  it.each(["Inapto", "Pendente", "Apto com Restrições", ""])(
    "não libera aptidão %s sem confirmação profissional",
    async (fitnessStatus) => {
      state.employee.fitnessStatus = fitnessStatus;
      expect((await check()).body.allowed).toBe(false);
    }
  );
  it("recalcula os treinamentos depois do vencimento", async () => {
    state.employee.nextAsoDate = "2027-12-31";
    expect((await check()).body.allowed).toBe(true);
    vi.setSystemTime(new Date("2027-01-02T15:00:00Z"));
    const result = await check();
    expect(result.body.allowed).toBe(false);
    expect(result.body.missingNrs).toEqual(["NR-10"]);
    expect(state.get).toHaveBeenCalledTimes(2);
  });
  it.each(["", "2026-02-30", "not-a-date", "2025-01-01", "2027-01-01T99:99:99Z"])(
    "recusa validade de ASO ausente, inválida ou vencida: %s",
    async (date) => {
      state.employee.nextAsoDate = date;
      expect((await check()).body.allowed).toBe(false);
    }
  );
  it("respeita o dia de validade no fuso brasileiro", async () => {
    vi.setSystemTime(new Date("2026-10-13T01:00:00Z"));
    state.employee.nextAsoDate = "2026-10-12";
    expect((await check()).body.allowed).toBe(true);
    vi.setSystemTime(new Date("2026-10-13T03:01:00Z"));
    expect((await check()).body.allowed).toBe(false);
  });
  it("nega empresa alheia antes de ler cadastro", async () => {
    expect((await check({ cpf: "12345678909", companyId: "company-b" })).status).toBe(403);
    expect(state.get).not.toHaveBeenCalled();
    expect(state.commit).not.toHaveBeenCalled();
  });
  it("exige empresa concreta de uma chave global", async () => {
    state.auth.mockResolvedValue({
      id: "global-key",
      clientId: "GLOBAL",
      scopes: ["access_control:read"],
    });
    expect((await check()).status).toBe(400);
    expect(state.get).not.toHaveBeenCalled();
    expect((await check({ cpf: "12345678909", companyId: "company-a" })).body.allowed).toBe(true);
  });
  it("exige correspondência simultânea de crachá e CPF", async () => {
    const result = await check({ badgeCode: "badge-a", cpf: "98765432100" });
    expect(result.body.allowed).toBe(false);
    expect(state.commit).not.toHaveBeenCalled();
  });
  it("nega identificadores duplicados sem escolher o primeiro cadastro", async () => {
    state.get.mockResolvedValue({ size: 2, empty: false, docs: [] });
    expect((await check()).body.allowed).toBe(false);
    expect(state.commit).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    { cpf: 123 },
    { badgeCode: "../employee-a" },
    { cpf: "12" },
    { companyId: "company-a/employees/other", cpf: "12345678909" },
  ])("rejeita corpo inválido %j", async (body) => {
    expect((await check(body)).status).toBe(400);
    expect(state.get).not.toHaveBeenCalled();
  });
  it("não informa liberação se a persistência falhar", async () => {
    state.commit.mockRejectedValue(new Error("private-storage-error"));
    const result = await check();
    expect(result.status).toBe(500);
    expect(result.body.allowed).not.toBe(true);
    expect(JSON.stringify(result.body)).not.toContain("private-storage-error");
  });
});
