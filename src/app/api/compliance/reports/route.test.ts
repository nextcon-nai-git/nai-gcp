import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  create: vi.fn(),
}));

vi.mock("firebase-admin/app-check", () => ({
  getAppCheck: () => ({ verifyToken: mocks.verify }),
}));

vi.mock("@/firebase/config", () => ({
  firebaseConfig: { appId: "app-test" },
}));

vi.mock("@/services/compliance-reports", async () => {
  const actual = await vi.importActual<typeof import("@/services/compliance-reports")>(
    "@/services/compliance-reports"
  );
  return {
    ...actual,
    createComplianceReport: mocks.create,
  };
});

import { POST } from "./route";

const body = {
  isAnonimo: true,
  nome: "",
  email: "",
  categoria: "assedio_moral",
  descricao: "Descrição suficientemente detalhada para registrar o relato.",
  dataFato: "2026-11-01",
  local: "Unidade de teste",
};

function request(appCheck?: string) {
  return new NextRequest("https://nai.test/api/compliance/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(appCheck ? { "X-Firebase-AppCheck": appCheck } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("public compliance report route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.verify.mockReset();
    mocks.create.mockReset();
    mocks.create.mockResolvedValue("DEN-2026-ABCDEF0123456789ABCDEF01");
  });

  it("accepts a bounded report when App Check enforcement is staged", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      protocol: "DEN-2026-ABCDEF0123456789ABCDEF01",
    });
    expect(mocks.create).toHaveBeenCalledWith(body);
  });

  it("rejects a supplied invalid App Check token", async () => {
    mocks.verify.mockRejectedValue(new Error("invalid"));
    const response = await POST(request("bad-token"));
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("accepts a valid token only from the configured Firebase app", async () => {
    mocks.verify.mockResolvedValue({ appId: "app-test" });
    expect((await POST(request("valid-token"))).status).toBe(201);

    mocks.create.mockClear();
    mocks.verify.mockResolvedValue({ appId: "other-app" });
    expect((await POST(request("other-token"))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("can enforce App Check before any persistence", async () => {
    vi.stubEnv("COMPLIANCE_APP_CHECK_ENFORCE", "true");
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
