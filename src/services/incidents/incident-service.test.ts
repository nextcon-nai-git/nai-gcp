import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  list: vi.fn(),
  audit: vi.fn(),
  analyze: vi.fn(),
}));
vi.mock("@/repositories/incidents/incident-repository", () => ({
  incidentRepository: { create: state.create, update: state.update, listByCompany: state.list },
}));
vi.mock("@/services/audit/audit-service", () => ({ auditService: { record: state.audit } }));
vi.mock("@/services/ai/incident-investigation-engine", () => ({
  analyzeIncidentWithNormativeGrounding: state.analyze,
}));
import { incidentService } from "./incident-service";

const context = {
  uid: "user-a",
  email: "synthetic@example.invalid",
  role: "ADMIN",
  tenantId: "company-a",
};
const input = { type: "Quase acidente", description: "Sem lesão e sem afastamento relatados." };
const opinion = {
  analysisStatus: "PRELIMINARY",
  reviewRequired: true,
  severity: null,
  esocialImpact: { requiresCatS2210: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  state.create.mockResolvedValue("incident-a");
  state.update.mockResolvedValue(undefined);
  state.audit.mockResolvedValue(undefined);
  state.analyze.mockResolvedValue(opinion);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("consumidor legado de incidentes preserva o recebimento e a revisão", () => {
  it("não promove gravidade, afastamento, CAT ou prazo do parecer para campos canônicos", async () => {
    const result = await incidentService.createIncident(context, input);
    expect(result).toMatchObject({
      incidentId: "incident-a",
      opinion,
      analysisAvailable: true,
      reviewRequired: true,
    });
    expect(state.create.mock.calls[0][0]).toMatchObject({
      companyId: "company-a",
      description: input.description,
      location: "",
      status: "ABERTO",
    });
    const update = state.update.mock.calls[0][1];
    expect(update).toMatchObject({ technicalOpinion: opinion, status: "EM_ANALISE" });
    for (const field of [
      "severity",
      "hasLeave",
      "daysOfLeave",
      "requiresCatS2210",
      "catDeadlineIso",
      "catDeadlineTimestamp",
      "catStatus",
    ])
      expect(update).not.toHaveProperty(field);
    expect(state.create.mock.invocationCallOrder[0]).toBeLessThan(
      state.analyze.mock.invocationCallOrder[0]
    );
  });

  it("recepção persistida continua confirmada quando a IA está indisponível", async () => {
    state.analyze.mockRejectedValueOnce(new Error("Private provider and patient detail"));
    const result = await incidentService.createIncident(context, input);
    expect(result).toEqual({
      incidentId: "incident-a",
      opinion: null,
      analysisAvailable: false,
      reviewRequired: true,
    });
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.update).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("Private provider");
  });

  it("falha da auditoria posterior à recepção não perde o identificador recebido", async () => {
    state.audit.mockRejectedValueOnce(new Error("Audit unavailable"));
    await expect(incidentService.createIncident(context, input)).resolves.toMatchObject({
      incidentId: "incident-a",
      opinion: null,
      analysisAvailable: false,
      reviewRequired: true,
    });
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.analyze).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });

  it("falha ao persistir parecer não é atribuída ao recebimento já concluído", async () => {
    state.update.mockRejectedValueOnce(new Error("Write failed after receipt"));
    await expect(incidentService.createIncident(context, input)).resolves.toMatchObject({
      incidentId: "incident-a",
      opinion: null,
      analysisAvailable: false,
      reviewRequired: true,
    });
    expect(state.create).toHaveBeenCalledTimes(1);
  });

  it("falha real de recepção não anuncia incidente recebido nem dispara análise", async () => {
    state.create.mockRejectedValueOnce(new Error("Receipt could not be persisted"));
    await expect(incidentService.createIncident(context, input)).rejects.toThrow(
      "Receipt could not be persisted"
    );
    expect(state.audit).not.toHaveBeenCalled();
    expect(state.analyze).not.toHaveBeenCalled();
  });
});
