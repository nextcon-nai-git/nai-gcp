import { describe, expect, it } from "vitest";
import type { AsoFlowCard } from "./aso-flow";
import {
  contactPilotScore,
  reconcileAsoEvidence,
  specialistReviewGate,
} from "./sst-evidence-pilot";
const card = (patch: Partial<AsoFlowCard> = {}) =>
  ({
    status: "scheduled",
    events: [],
    appointment: { date: "2026-11-18" },
    ...patch,
  }) as AsoFlowCard;
describe("SST evidence and shadow pilot", () => {
  it("does not convert elapsed appointments into no-shows", () => {
    expect(reconcileAsoEvidence(card(), "2026-11-20").attendance).toBe("Realização não confirmada");
  });
  it("requires evidence even for terminal status", () => {
    expect(reconcileAsoEvidence(card({ status: "delivered" }), "2026-11-20")).toMatchObject({
      delivered: false,
      discrepancy: true,
    });
  });
  it("binds review and delivery to the received version", () => {
    const value = card({
      aso: { hash: "new", reference: "source", examDate: "2026-11-18" } as AsoFlowCard["aso"],
      review: {
        hash: "old",
        identityConfirmed: true,
        documentChecked: true,
      } as AsoFlowCard["review"],
    });
    expect(reconcileAsoEvidence(value, "2026-11-20")).toMatchObject({
      received: true,
      reviewed: false,
      delivered: false,
    });
  });
  it("requires an explicit audit event for absence", () => {
    expect(reconcileAsoEvidence(card({ status: "no_show" }), "2026-11-20").attendance).not.toBe(
      "Falta registrada"
    );
    expect(
      reconcileAsoEvidence(
        card({
          status: "no_show",
          events: [
            {
              status: "no_show",
              actor: "operator",
              at: "2026-11-19",
            } as AsoFlowCard["events"][number],
          ],
        }),
        "2026-11-20"
      ).attendance
    ).toBe("Falta registrada");
  });
  it("computes only calibrated valid probabilities", () => {
    expect(contactPilotScore(0.4, 60, true)).toBe(24);
    for (const p of [NaN, Infinity, -1, 1.1]) expect(contactPilotScore(p, 60, true)).toBeNull();
    expect(contactPilotScore(0.4, 60, false)).toBeNull();
    expect(contactPilotScore(0.4, 0, true)).toBeNull();
  });
  it("does not infer explanation quality from prediction accuracy", () => {
    expect(
      specialistReviewGate({
        dataQualityConfirmed: true,
        predictionValidated: true,
        explanationValidated: false,
        professionalApproved: true,
      })
    ).toEqual({ pending: ["explanationValidated"], readyForProfessionalUse: false });
  });
});
