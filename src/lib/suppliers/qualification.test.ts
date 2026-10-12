import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "@/lib/auth/auth-context";
import {
  SupplierBook,
  SupplierCommand,
  applySupplierCommand,
  accessApplication,
  supplierView,
  qualificationCurrent,
} from "./qualification";
const user: AuthContext = {
  uid: "supplier-a",
  email: "a@example.test",
  role: "PROVIDER",
  tenantId: "a",
  permissions: [],
  servedCompanies: [],
};
const admin: AuthContext = { ...user, uid: "reviewer", role: "SUPER_ADMIN", tenantId: null };
const at = "2026-10-12T15:00:00Z";
const profile = {
  name: "Fornecedor sintético",
  document: "12345678000190",
  email: "test@example.test",
  phone: "",
  services: "Serviços de teste",
  city: "São Paulo / SP",
};
const initial = () => SupplierBook.parse({ version: 0, applications: [], audit: [] });
function run(b: ReturnType<typeof initial>, data: object, u = user) {
  const c = SupplierCommand.parse({
    requestId: randomUUID(),
    expectedVersion: b.applications[0]?.version || 0,
    ...data,
  });
  return applySupplierCommand(b, c, u, at, JSON.stringify(c));
}
function fixture() {
  let b = run(initial(), { action: "create", profile });
  const a = b.applications[0];
  b = run(
    b,
    {
      action: "requirements",
      id: a.id,
      requirements: [{ id: randomUUID(), label: "Licença", required: true }],
      reason: "Atividade exige licença",
    },
    admin
  );
  const app = b.applications[0];
  app.documents.push({
    id: randomUUID(),
    requirementId: app.requirements[0].id,
    name: "licenca.pdf",
    mime: "application/pdf",
    size: 10,
    sha256: "a".repeat(64),
    expires: "2026-12-31",
    uploadedBy: user.uid,
    uploadedAt: at,
    review: "pending",
    reviewer: null,
    reason: "",
  });
  return run(b, { action: "submit", id: app.id });
}
describe("supplier qualification boundaries", () => {
  it("isolates owners and strips internal audit identities", () => {
    const b = fixture();
    expect(supplierView(b, { ...user, uid: "other" }, "2026-10-12").applications).toEqual([]);
    expect(() => accessApplication(b, b.applications[0].id, { ...user, uid: "other" })).toThrow(
      "não encontrado"
    );
    const v = supplierView(b, user, "2026-10-12");
    expect(v.audit).toEqual([]);
    expect(v.applications[0].documents[0].uploadedBy).toBe("");
  });
  it.each(["CLIENT_ADMIN", "DOCTOR", "COMPLIANCE"] as const)("denies %s before access", (role) => {
    expect(() => supplierView(initial(), { ...user, role }, "2026-10-12")).toThrow("restrito");
  });
  it("denies tenant admin and provider review", () => {
    const b = fixture();
    expect(() =>
      supplierView(b, { ...admin, role: "ADMIN", tenantId: "client" }, "2026-10-12")
    ).toThrow("restrito");
    expect(() =>
      run(b, {
        action: "decide",
        id: b.applications[0].id,
        status: "approved",
        validUntil: "2026-11-01",
        reason: "Conferido",
      })
    ).toThrow("Somente");
  });
  it("requires document acceptance and independent reviewer", () => {
    let b = fixture();
    const a = b.applications[0];
    const decide = {
      action: "decide",
      id: a.id,
      status: "approved",
      validUntil: "2026-11-30",
      reason: "Conferido",
    };
    expect(() => run(b, decide, admin)).toThrow("revisão");
    expect(() =>
      run(
        b,
        {
          action: "reviewDocument",
          id: a.id,
          documentId: a.documents[0].id,
          review: "accepted",
          reason: "Conferido",
        },
        { ...admin, uid: user.uid }
      )
    ).toThrow("Outro administrador");
    b = run(
      b,
      {
        action: "reviewDocument",
        id: a.id,
        documentId: a.documents[0].id,
        review: "accepted",
        reason: "Conferido",
      },
      admin
    );
    expect(() => run(b, decide, { ...admin, uid: user.uid })).toThrow("Outro administrador");
    b = run(b, decide, admin);
    expect(qualificationCurrent(b.applications[0], "2026-11-30")).toBe(true);
    expect(qualificationCurrent(b.applications[0], "2026-12-01")).toBe(false);
  });
  it("bounds validity by document expiry and invalidates changed dossier", () => {
    let b = fixture();
    const a = b.applications[0];
    b = run(
      b,
      {
        action: "reviewDocument",
        id: a.id,
        documentId: a.documents[0].id,
        review: "accepted",
        reason: "Conferido",
      },
      admin
    );
    expect(() =>
      run(
        b,
        {
          action: "decide",
          id: a.id,
          status: "approved",
          validUntil: "2027-01-01",
          reason: "Conferido",
        },
        admin
      )
    ).toThrow("ultrapassar");
    b = run(
      b,
      {
        action: "decide",
        id: a.id,
        status: "changes",
        validUntil: null,
        reason: "Corrigir contato",
      },
      admin
    );
    b = run(b, { action: "edit", id: a.id, profile: { ...profile, phone: "11999999999" } });
    expect(b.applications[0].documents[0].review).toBe("pending");
  });
  it("uses idempotent commands, CAS versions and normalized document uniqueness", () => {
    const c = SupplierCommand.parse({
      action: "create",
      profile,
      requestId: randomUUID(),
      expectedVersion: 0,
    });
    const b = applySupplierCommand(initial(), c, user, at, "hash");
    expect(applySupplierCommand(b, c, user, at, "hash")).toBe(b);
    expect(() => applySupplierCommand(b, c, user, at, "different")).toThrow("utilizado");
    expect(() =>
      run(b, { action: "edit", id: b.applications[0].id, profile, expectedVersion: 0 })
    ).toThrow("alterado");
    expect(() =>
      run(b, {
        action: "create",
        profile: { ...profile, document: "12.345.678/0001-90" },
        expectedVersion: 0,
      })
    ).toThrow("já possui");
  });
  it("cannot approve incomplete or expired documents or replace submitted evidence", () => {
    const b = fixture(),
      a = b.applications[0];
    a.documents[0].expires = "2026-10-11";
    expect(() =>
      run(
        b,
        {
          action: "reviewDocument",
          id: a.id,
          documentId: a.documents[0].id,
          review: "accepted",
          reason: "Conferido",
        },
        admin
      )
    ).toThrow("vencido");
    expect(() => run(b, { action: "edit", id: a.id, profile })).toThrow("devolução");
  });
});
