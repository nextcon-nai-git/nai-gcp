import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const logAccess = vi.fn();
vi.mock("@/lib/medical-audit-logger", () => ({
  MedicalAuditLogger: { logAccess, getAuditTrail: () => [] },
}));
import { AuditTrailView } from "./audit-trail-view";
it("does not fabricate an access or claim an immutable audit without a server source", () => {
  const html = renderToStaticMarkup(<AuditTrailView />);
  expect(logAccess).not.toHaveBeenCalled();
  expect(html).toContain("não está conectada");
  expect(html).not.toContain("Imutável");
  expect(html).not.toContain("doc_102");
});
