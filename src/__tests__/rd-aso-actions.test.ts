import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const ownGet = vi.fn();
  const sharedGet = vi.fn();
  const cardGet = vi.fn();
  const cardSet = vi.fn();
  const sharedDoc = vi.fn(() => ({ get: cardGet, set: cardSet }));
  const queue = (get: typeof ownGet, doc = vi.fn()) => ({
    orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ get })) })),
    doc,
  });
  const own = queue(ownGet);
  const shared = queue(sharedGet, sharedDoc);
  return {
    role: "OPERATIONS",
    tenantId: null as string | null,
    profileRead: vi.fn(),
    ownGet,
    sharedGet,
    cardGet,
    cardSet,
    sharedDoc,
    db: {
      runTransaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({ get: (ref: any) => ref.get(), update: (ref: any, changes: any) => ref.set(changes) }),
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => ({
          get: () => mocks.profileRead(),
          collection: vi.fn(() => (name === "users" ? own : shared)),
        })),
      })),
    },
  };
});
vi.mock("@/lib/firebase-admin", () => ({ adminDb: mocks.db }));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(async () => ({
    uid: "operator-test",
    role: mocks.role,
    tenantId: mocks.tenantId,
  })),
}));
vi.mock("next/server", () => ({ NextRequest: class {} }));
vi.mock("@/ai/flows/aso-scheduler-system-flow", () => ({
  processAsoSystemOrchestration: vi.fn(),
}));
import { getAsoRequestsAction, advancePipelineStepAction } from "@/actions/aso-scheduler-actions";

const card = {
  id: "rd-test",
  status: "solicitado",
  employeeName: "Pessoa de Teste",
  createdAt: "2026-10-09T12:00:00Z",
  source: "rd-conversas",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenantId = null;
  mocks.role = "OPERATIONS";
  mocks.profileRead.mockImplementation(() => ({
    data: () => ({ role: mocks.role, tenantId: mocks.tenantId }),
  }));
  mocks.ownGet.mockResolvedValue({
    docs: [{ data: () => ({ id: "own", createdAt: "2026-10-08T12:00:00Z" }) }],
  });
  mocks.sharedGet.mockResolvedValue({ docs: [{ data: () => card }] });
  mocks.cardGet.mockResolvedValue({ exists: true, data: () => card });
  mocks.cardSet.mockResolvedValue(undefined);
});
describe("shared RD ASO queue authorization", () => {
  it("operational team sees shared and existing personal cards in date order", async () => {
    const result = await getAsoRequestsAction("test-token");
    expect(result.data.map((item) => item.id)).toEqual(["rd-test", "own"]);
    expect(mocks.sharedGet).toHaveBeenCalledOnce();
  });
  it("client gets only personal cards without reading the shared queue", async () => {
    mocks.role = "CLIENT_ADMIN";
    const result = await getAsoRequestsAction("test-token");
    expect(result.data.map((item) => item.id)).toEqual(["own"]);
    expect(mocks.sharedGet).not.toHaveBeenCalled();
  });
  it("guest cannot list requests", async () => {
    mocks.role = "GUEST";
    await expect(getAsoRequestsAction("test-token")).rejects.toThrow();
    expect(mocks.sharedGet).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "OPERATIONS", "SUPER_ADMIN"])(
    "keeps tenant-bound %s out of the shared queue",
    async (role) => {
      mocks.role = role;
      mocks.tenantId = "empresa";
      expect((await getAsoRequestsAction("token")).data.map((card) => card.id)).toEqual(["own"]);
      expect((await advancePipelineStepAction("rd-test", "validando", "token")).success).toBe(
        false
      );
      expect(mocks.sharedGet).not.toHaveBeenCalled();
      expect(mocks.sharedDoc).not.toHaveBeenCalled();
    }
  );
  it("client cannot advance a shared card by guessing its ID", async () => {
    mocks.role = "CLIENT_ADMIN";
    const result = await advancePipelineStepAction("rd-test", "validando", "test-token");
    expect(result.success).toBe(false);
    expect(mocks.sharedDoc).not.toHaveBeenCalled();
    expect(mocks.cardSet).not.toHaveBeenCalled();
  });
  it("rechecks the current company scope when committing the move", async () => {
    mocks.profileRead.mockReturnValue({
      data: () => ({ role: "OPERATIONS", companyId: "empresa" }),
    });
    expect((await advancePipelineStepAction("rd-test", "validando", "token")).success).toBe(false);
    expect(mocks.cardSet).not.toHaveBeenCalled();
  });
  it("operator advances the shared card while preserving its source and identity", async () => {
    const result = await advancePipelineStepAction("rd-test", "validando", "test-token");
    expect(result.success).toBe(true);
    expect(mocks.sharedDoc).toHaveBeenCalledWith("rd-test");
    expect(mocks.cardSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "validando",
        updatedAt: expect.any(String),
      })
    );
    expect(result.data).toMatchObject({
      id: "rd-test",
      employeeName: "Pessoa de Teste",
      source: "rd-conversas",
    });
  });
});
