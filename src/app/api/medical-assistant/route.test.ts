import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  history: vi.fn(),
  audit: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/medical-history", () => ({
  getAuthorizedMedicalHistory: mocks.history,
}));
vi.mock("@/services/audit/medical-audit-service", () => ({
  medicalAuditService: { record: mocks.audit },
}));
vi.mock("@/ai/genkit", () => ({ ai: { generateStream: mocks.generate } }));

import { POST } from "./route";

const user = {
  uid: "doctor-1",
  email: "doctor@example.test",
  role: "DOCTOR",
  tenantId: "company-a",
  permissions: [],
  servedCompanies: [],
};
const body = {
  mensagemMedico: "Resuma os exames disponíveis.",
  pacienteId: "patient-1",
  companyId: "company-a",
};

function request() {
  return new NextRequest("https://nai.test/api/medical-assistant", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(user);
  mocks.history.mockResolvedValue({ statusConsulta: "SEM_REGISTROS" });
  mocks.audit.mockResolvedValue(undefined);
  mocks.generate.mockReturnValue({
    stream: (async function* () {
      yield { text: "Resposta validada pelo médico." };
    })(),
  });
});

describe("medical assistant audit", () => {
  it("records access before generating a response without logging the prompt", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith({
      actorId: user.uid,
      actorRole: user.role,
      tenantId: body.companyId,
      patientId: body.pacienteId,
      action: "MEDICAL_ASSISTANT_USED",
    });
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generate.mock.invocationCallOrder[0]
    );
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(body.mensagemMedico);
  });

  it("does not send clinical context to the model when the audit write fails", async () => {
    mocks.audit.mockRejectedValueOnce(new Error("audit storage unavailable"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("does not create an audit event or invoke the model when access is denied", async () => {
    mocks.history.mockRejectedValueOnce(new AuthError("Sem acesso.", 403));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
