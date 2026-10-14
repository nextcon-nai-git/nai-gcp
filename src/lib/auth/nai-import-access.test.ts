import { describe, expect, it } from "vitest";
import type { AuthContext, UserRole } from "./auth-context";
import {
  canAccessClinicalImport,
  requirePgrCompany,
  requirePgrDocumentAccess,
} from "./require-pgr-access";
import { parsePgrDocumentPages } from "../pgr-document-parser";
import type { PgrAnalysisOutput } from "../pgr-schema";

const user = (role: UserRole): AuthContext => ({
  uid: "synthetic-reviewer",
  email: "reviewer@example.test",
  role,
  tenantId: "company-a",
  permissions: [],
  servedCompanies: [],
});
const analysis = (
  type: "PGR" | "PCMSO" | "ASO" | "PERICIA_MEDICA",
  clinical = false
): PgrAnalysisOutput => ({
  ...parsePgrDocumentPages([{ numero: 1, texto: "Documento sintético de SST" }]),
  documento: {
    tipo: type,
    agenteResponsavel: type === "PGR" ? "engenheiro_seguranca" : "medico_trabalho",
    statusClassificacao: "identificado",
    evidencias: [],
    justificativa: "Documento sintético para teste de acesso.",
    acesso: clinical ? "clinico_restrito" : "sst",
  },
});

describe("NAI importa: permissões clínicas", () => {
  it.each(["ENGINEER", "SAFETY_TECH", "OPERATIONS", "CLIENT_ADMIN", "PROVIDER", "GUEST"] as const)(
    "não concede acesso clínico ao perfil %s",
    (role) => {
      expect(canAccessClinicalImport(user(role))).toBe(false);
      expect(() => requirePgrDocumentAccess(user(role), analysis("ASO"))).toThrow();
    }
  );

  it.each(["PCMSO", "ASO", "PERICIA_MEDICA"] as const)(
    "protege %s mesmo se o marcador de acesso vier incorreto",
    (type) => {
      expect(() => requirePgrDocumentAccess(user("OPERATIONS"), analysis(type))).toThrow();
      expect(() => requirePgrDocumentAccess(user("DOCTOR"), analysis(type))).not.toThrow();
    }
  );

  it("protege anexos clínicos em um documento técnico", () => {
    expect(() => requirePgrDocumentAccess(user("ENGINEER"), analysis("PGR", true))).toThrow();
    expect(() => requirePgrDocumentAccess(user("ENGINEER"), analysis("PGR"))).not.toThrow();
  });

  it("o papel clínico não amplia a carteira nem o escopo de um administrador de tenant", () => {
    expect(() => requirePgrCompany(user("DOCTOR"), "company-b")).toThrow();
    expect(() => requirePgrCompany(user("ADMIN"), "company-b")).toThrow();
    expect(() => requirePgrCompany(user("DOCTOR"), "company-a")).not.toThrow();
  });
});
