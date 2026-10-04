import { describe, it, expect } from "vitest";
import { getAllowedAgentsForUser } from "@/lib/agent-access-control";

describe("Agent Access Control Unit Tests", () => {
  it("deve conceder acesso total para SUPER_ADMIN ou ADMIN independentemente do conselho", () => {
    const adminWithCoren = getAllowedAgentsForUser({
      userRole: "SUPER_ADMIN",
      professionalType: "COREN",
      category: "Enfermagem",
    });

    expect(adminWithCoren.isFullAccess).toBe(true);
    expect(adminWithCoren.allowedRoles).toHaveLength(5);
  });

  it("deve restritar enfermeiro com COREN apenas ao agente de enfermagem", () => {
    const nurse = getAllowedAgentsForUser({
      userRole: "USER",
      professionalType: "COREN",
      category: "Enfermagem do Trabalho",
    });

    expect(nurse.isFullAccess).toBe(false);
    expect(nurse.allowedRoles).toEqual(["enfermeiro_trabalho"]);
    expect(nurse.userTitle).toBe("Enfermeira do Trabalho");
  });

  it("deve restritar médico com CRM apenas ao agente de medicina", () => {
    const doctor = getAllowedAgentsForUser({
      userRole: "USER",
      professionalType: "CRM",
      category: "Medicina do Trabalho",
    });

    expect(doctor.isFullAccess).toBe(false);
    expect(doctor.allowedRoles).toEqual(["medico_trabalho"]);
    expect(doctor.userTitle).toBe("Médico(a) do Trabalho");
  });

  it("deve restritar técnico de segurança com MTE apenas ao agente técnico", () => {
    const tech = getAllowedAgentsForUser({
      userRole: "USER",
      professionalType: "MTE",
      category: "Técnico em Segurança",
    });

    expect(tech.isFullAccess).toBe(false);
    expect(tech.allowedRoles).toEqual(["tecnico_seguranca"]);
  });

  it("deve conceder acesso total padrão para gestor sem restrições específicas", () => {
    const defaultUser = getAllowedAgentsForUser({
      userRole: "ENGINEER",
    });

    expect(defaultUser.isFullAccess).toBe(true);
    expect(defaultUser.allowedRoles).toHaveLength(5);
  });
});
