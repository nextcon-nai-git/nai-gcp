// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applySignatureEvent,
  approveSignature,
  prepareSignature,
  recordSignatureSubmission,
  SignatureRequestSchema,
} from "./lifecycle";

const document = {
  tenantId: "tenant-a",
  recordId: "contract-a",
  documentVersion: 1,
  sourceSha256: "a".repeat(64),
};
const submission = {
  provider: "clicksign",
  envelopeId: "envelope-a",
  environment: "sandbox" as const,
};
const draft = () => prepareSignature({ ...document, id: "request-a" });
const approved = () => approveSignature(draft(), "approver-a", "2026-10-24T12:00:00Z");
const sent = () => recordSignatureSubmission(approved(), document, submission);
const event = (patch = {}) => ({
  ...document,
  ...submission,
  id: "event-a",
  requestId: "request-a",
  status: "partially_signed",
  finalArtifact: null,
  ...patch,
});

describe("signature lifecycle foundation", () => {
  it("requires explicit approval and preserves the draft", () => {
    const original = draft();
    expect(() => recordSignatureSubmission(original, document, submission)).toThrow("Aprovação");
    expect(approved().approval?.actorId).toBe("approver-a");
    expect(original.status).toBe("draft");
    expect(() => approveSignature(approved(), "actor", "2026-10-24T12:00:00Z")).toThrow();
  });
  it.each([
    { sourceSha256: "b".repeat(64) },
    { documentVersion: 2 },
    { tenantId: "tenant-b" },
    { recordId: "contract-b" },
  ])("rejects approval reuse against changed document: %j", (patch) => {
    expect(() =>
      recordSignatureSubmission(approved(), { ...document, ...patch }, submission)
    ).toThrow("documento");
  });
  it.each([
    { requestId: "other" },
    { tenantId: "other" },
    { recordId: "other" },
    { documentVersion: 2 },
    { sourceSha256: "b".repeat(64) },
    { provider: "other" },
    { envelopeId: "other" },
    { environment: "production" },
  ])("rejects cross-document, tenant or environment event: %j", (patch) => {
    expect(() => applySignatureEvent(sent(), event(patch))).toThrow("Evento não corresponde");
  });
  it("deduplicates events without modifying the request", () => {
    const original = sent();
    const partial = applySignatureEvent(original, event());
    expect(partial.status).toBe("partially_signed");
    expect(applySignatureEvent(partial, event())).toEqual(partial);
    expect(partial.events).toHaveLength(1);
    expect(original.events).toHaveLength(0);
    expect(() => applySignatureEvent(partial, event({ status: "cancelled" }))).toThrow("distinto");
  });
  it("keeps source and final hashes separate and does not claim certificate validity", () => {
    const complete = applySignatureEvent(
      sent(),
      event({
        status: "provider_completed",
        finalArtifact: { sha256: "b".repeat(64), evidenceReference: "private-evidence-a" },
      })
    );
    expect(complete.sourceSha256).toBe(document.sourceSha256);
    expect(complete.finalArtifact?.sha256).toBe("b".repeat(64));
    expect(complete.status).toBe("provider_completed");
    expect(complete).not.toHaveProperty("signatureValidated");
    expect(() => applySignatureEvent(sent(), event({ status: "provider_completed" }))).toThrow();
  });
  it.each(["cancelled", "expired", "provider_completed"])(
    "never reopens a terminal state (%s) through a late event",
    (status) => {
      const terminalEvent = event({
        status,
        finalArtifact:
          status === "provider_completed"
            ? { sha256: "b".repeat(64), evidenceReference: "private-evidence-a" }
            : null,
      });
      const terminal = applySignatureEvent(sent(), terminalEvent);
      expect(applySignatureEvent(terminal, terminalEvent)).toEqual(terminal);
      expect(() => applySignatureEvent(terminal, event({ id: "late-event" }))).toThrow("tardio");
    }
  );
  it("rejects forged state combinations and unbounded history", () => {
    expect(() => SignatureRequestSchema.parse({ ...draft(), status: "submitted" })).toThrow();
    expect(() =>
      SignatureRequestSchema.parse({
        ...sent(),
        finalArtifact: { sha256: "a".repeat(64), evidenceReference: "x" },
      })
    ).toThrow();
    const request = sent();
    request.events = Array.from({ length: 500 }, (_, i) => ({
      id: `event-${i}`,
      fingerprint: "c".repeat(64),
    }));
    expect(() => applySignatureEvent(request, event())).toThrow("Limite");
    expect(() => applySignatureEvent(draft(), event())).toThrow();
  });
});
