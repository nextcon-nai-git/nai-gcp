// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  control: vi.fn(),
  query: vi.fn(),
  txGet: vi.fn(),
  set: vi.fn(),
  transaction: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("./avp-periodic-sync", () => ({ readAvpPeriodicSnapshot: mocks.control }));
vi.mock("@/lib/firebase-admin", () => {
  const ref: Record<string, unknown> = {};
  Object.assign(ref, { collection: () => ref, doc: () => ref, limit: () => ref, get: mocks.query });
  return {
    adminDb: {
      collection: (name: string) => {
        mocks.collection(name);
        return ref;
      },
      runTransaction: mocks.transaction,
    },
  };
});
import { readPeriodicWork, patchPeriodicWork } from "./avp-periodic-workflow";
const person = {
  id: `periodico-2026-${"a".repeat(64)}`,
  name: "Pessoa de teste",
  workId: `periodico-2026-${"a".repeat(64)}`,
  workSourceVersion: "a".repeat(64),
  workIdentityComplete: true,
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
    expect(mocks.collection).toHaveBeenCalledWith("clinic_portal_private");
    expect(mocks.control).toHaveBeenCalledWith(true);
  });
  it("mantém revisão monotônica quando a fonte invalida a etapa", async () => {
    mocks.query.mockResolvedValue({
      size: 1,
      docs: [
        {
          id: person.workId,
          data: () => ({ sourceVersion: "b".repeat(64), revision: 7, stage: "concluido" }),
        },
      ],
    });
    expect((await readPeriodicWork()).cards[0]).toMatchObject({
      revision: 7,
      state: null,
      stage: "validar",
      sourceChanged: true,
    });
  });
  it("não permite que requisição antiga sobrescreva um registro de outra versão da fonte", async () => {
    mocks.txGet.mockResolvedValue({
      exists: true,
      data: () => ({ sourceVersion: "b".repeat(64), revision: 1, stage: "agendar" }),
    });
    await expect(
      patchPeriodicWork(
        {
          id: person.workId,
          sourceVersion: person.workSourceVersion,
          revision: 0,
          stage: "agendar",
          responsible: "Operador teste",
          nextDate: "",
          evidence: "Conferência da origem sintética",
          evidenceDate: "2026-11-02",
          evidenceKind: "eligibility",
          clinic: "",
          appointmentTime: "",
          receiptNumber: "",
          nonApplicabilityReason: "",
        },
        "actor"
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("recusa fonte antiga sem fingerprint e sincronização com erro", async () => {
    mocks.control.mockResolvedValueOnce({ people: [{ ...person, workSourceVersion: undefined }] });
    await expect(readPeriodicWork()).rejects.toThrow("vínculos de origem");
    mocks.control.mockResolvedValueOnce({ people: [person], sync: { status: "ERROR" } });
    await expect(readPeriodicWork()).rejects.toThrow("sincronização");
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
      evidenceDate: "2026-10-22",
      evidenceKind: "eligibility" as const,
      clinic: "",
      appointmentTime: "",
      receiptNumber: "",
      nonApplicabilityReason: "",
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
    mocks.control.mockResolvedValue({
      people: [{ ...person, lastExam: "01/10/2026", workSourceVersion: "b".repeat(64) }],
    });
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
          evidenceDate: "2026-10-22",
          evidenceKind: "eligibility" as const,
          clinic: "",
          appointmentTime: "",
          receiptNumber: "",
          nonApplicabilityReason: "",
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
          evidenceDate: "2026-10-22",
          evidenceKind: "eligibility" as const,
          clinic: "",
          appointmentTime: "",
          receiptNumber: "",
          nonApplicabilityReason: "",
        },
        "actor"
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
