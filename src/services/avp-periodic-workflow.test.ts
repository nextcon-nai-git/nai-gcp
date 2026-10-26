// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  control: vi.fn(),
  query: vi.fn(),
  txGet: vi.fn(),
  set: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("./avp-periodic-control", () => ({ readAvpPeriodicControl: mocks.control }));
vi.mock("@/lib/firebase-admin", () => {
  const ref: Record<string, unknown> = {};
  Object.assign(ref, { collection: () => ref, doc: () => ref, limit: () => ref, get: mocks.query });
  return { adminDb: { collection: () => ref, runTransaction: mocks.transaction } };
});
import { readPeriodicWork, patchPeriodicWork } from "./avp-periodic-workflow";
const person = {
  id: "periodico-2026-1",
  name: "Pessoa de teste",
  unit: "Empresa",
  city: "Curitiba",
  uf: "PR",
  cityKey: "CURITIBA|PR",
  status: "Agendado",
  review: "OK",
  admission: "01/01/2020",
  classification: "listed",
  duplicateRows: 0,
  sourceRows: [2],
  lastExam: "01/01/2025",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.control.mockResolvedValue({ checkedAt: "2026-10-22", people: [person] });
  mocks.query.mockResolvedValue({ size: 0, docs: [] });
  mocks.txGet.mockResolvedValue({ exists: false });
  mocks.transaction.mockImplementation(async (fn) => fn({ get: mocks.txGet, set: mocks.set }));
});
describe("persistência de cards periódicos", () => {
  it("não transforma agendado na fonte em realização ou conclusão e não grava na leitura", async () => {
    const result = await readPeriodicWork();
    expect(result.cards[0].stage).toBe("validar");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("grava ação e evidência juntas com operador e revisão", async () => {
    const { cards } = await readPeriodicWork();
    const patch = {
      id: person.id,
      sourceVersion: cards[0].sourceVersion,
      revision: 0,
      stage: "agendar" as const,
      responsible: "Equipe teste",
      nextDate: "",
      evidence: "Vínculo e exame conferidos em fonte de teste",
    };
    await patchPeriodicWork(patch, "actor");
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[0][1]).toMatchObject({
      revision: 1,
      updatedBy: "actor",
      stage: "agendar",
    });
    expect(mocks.set.mock.calls[1][1]).toMatchObject({
      evidence: patch.evidence,
      previousStage: "validar",
    });
  });
  it("mudança do último exame invalida a liberação anterior", async () => {
    const { cards } = await readPeriodicWork();
    mocks.query.mockResolvedValue({
      size: 1,
      docs: [
        {
          id: person.id,
          data: () => ({ sourceVersion: cards[0].sourceVersion, stage: "agendar", revision: 1 }),
        },
      ],
    });
    mocks.control.mockResolvedValue({ people: [{ ...person, lastExam: "01/10/2026" }] });
    expect((await readPeriodicWork()).cards[0]).toMatchObject({
      sourceChanged: true,
      state: null,
      stage: "validar",
    });
    await expect(
      patchPeriodicWork(
        {
          id: person.id,
          sourceVersion: cards[0].sourceVersion,
          revision: 0,
          stage: "agendar",
          responsible: "Teste",
          nextDate: "",
          evidence: "Fonte antiga",
        },
        "actor"
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rejeita atualização concorrente sem sobrescrever evidências", async () => {
    const { cards } = await readPeriodicWork();
    mocks.txGet.mockResolvedValue({
      exists: true,
      data: () => ({ sourceVersion: cards[0].sourceVersion, revision: 2, stage: "validar" }),
    });
    await expect(
      patchPeriodicWork(
        {
          id: person.id,
          sourceVersion: cards[0].sourceVersion,
          revision: 0,
          stage: "agendar",
          responsible: "Teste",
          nextDate: "",
          evidence: "Fonte de teste",
        },
        "actor"
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
