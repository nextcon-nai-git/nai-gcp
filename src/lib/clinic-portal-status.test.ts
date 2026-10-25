import { expect, it } from "vitest";
import { formatClinicPortalStatus } from "./clinic-portal-status";
const now = Date.parse("2026-10-25T12:00:00Z");
it("marks expired access without discarding an already received document", () => {
  expect(
    formatClinicPortalStatus({ state: "invited", expiresAt: "2026-10-23T12:00:00Z" }, now)
  ).toContain("acesso expirado");
  const received = formatClinicPortalStatus(
    { state: "invited", documentReceived: true, expiresAt: "2026-10-23T12:00:00Z" },
    now
  );
  expect(received).toContain("ASO recebido para conferência");
  expect(received).toContain("acesso expirado");
});
it("gives revocation precedence and does not invent validity for malformed dates", () => {
  expect(formatClinicPortalStatus({ revoked: true, expiresAt: "2026-10-23" }, now)).toContain(
    "acesso revogado"
  );
  expect(formatClinicPortalStatus({ state: "invited", expiresAt: "bad" }, now)).toContain(
    "validade indisponível"
  );
  expect(formatClinicPortalStatus({ state: "invited", expiresAt: "2026-11-01" }, now)).toContain(
    "acesso vigente"
  );
});
