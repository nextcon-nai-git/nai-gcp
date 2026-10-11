import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  collection: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mocks.collection },
}));

import { FieldValue } from "firebase-admin/firestore";
import { medicalAuditService } from "./medical-audit-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue({ add: mocks.add });
  mocks.add.mockResolvedValue({ id: "audit-1" });
});

describe("MedicalAuditService", () => {
  it("writes minimal audit metadata to the server-managed PHI log", async () => {
    await medicalAuditService.record({
      actorId: "doctor-1",
      actorRole: "DOCTOR",
      tenantId: "company-a",
      patientId: "patient-1",
      action: "MEDICAL_ASSISTANT_USED",
    });

    expect(mocks.collection).toHaveBeenCalledWith("phi_audit_logs");
    expect(mocks.add).toHaveBeenCalledWith({
      actorId: "doctor-1",
      actorRole: "DOCTOR",
      tenantId: "company-a",
      patientId: "patient-1",
      action: "MEDICAL_ASSISTANT_USED",
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  it("propagates persistence errors so sensitive processing can fail closed", async () => {
    mocks.add.mockRejectedValueOnce(new Error("audit storage unavailable"));

    await expect(
      medicalAuditService.record({
        actorId: "doctor-1",
        actorRole: "DOCTOR",
        tenantId: "company-a",
        patientId: "patient-1",
        action: "MEDICAL_ASSISTANT_USED",
      })
    ).rejects.toThrow("audit storage unavailable");
  });
});
