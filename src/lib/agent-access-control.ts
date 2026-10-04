import { AgentRole } from "@/ai/flows/sesmt-agents-flow";

export interface UserAgentPermissionInfo {
  userRole?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  professionalType?: string | null; // CRM, COREN, CREA, MTE, CREFITO
  category?: string | null;
}

export function getAllowedAgentsForUser(info: UserAgentPermissionInfo): {
  allowedRoles: AgentRole[];
  isFullAccess: boolean;
  userTitle: string;
} {
  const roleUpper = (info.userRole || "").toUpperCase();
  const emailLower = (info.userEmail || "").toLowerCase();
  const nameUpper = (info.userName || "").toUpperCase();
  const profTypeUpper = (info.professionalType || "").toUpperCase();
  const categoryLower = (info.category || "").toLowerCase();

  // All 5 agents
  const ALL_AGENTS: AgentRole[] = [
    "engenheiro_seguranca",
    "tecnico_seguranca",
    "enfermeiro_trabalho",
    "ergonomista",
    "medico_trabalho",
  ];

  // 0. ADMIN / MANAGEMENT / SUPER_ADMIN OVERRIDE: Always grant full access to all 5 agents + Mesa Redonda
  const isManagementOrAdmin =
    roleUpper.includes("ADMIN") ||
    roleUpper.includes("ENGINEER") ||
    roleUpper === "SUPER_ADMIN" ||
    roleUpper === "GERENTE";

  if (isManagementOrAdmin) {
    return {
      allowedRoles: ALL_AGENTS,
      isFullAccess: true,
      userTitle: "Gestor Geral / Engenheiro do SESMT",
    };
  }

  // 1. Specific Nurse Profile (Giovanna / Thamires / COREN)
  const isNurse =
    roleUpper === "NURSE" || profTypeUpper === "COREN" || categoryLower.includes("enfermagem");

  if (isNurse) {
    return {
      allowedRoles: ["enfermeiro_trabalho"],
      isFullAccess: false,
      userTitle: "Enfermeira do Trabalho",
    };
  }

  // 2. Specific Doctor Profile (Dr. Bruzamolin / Dra. Ana / CRM)
  const isDoctor =
    roleUpper === "DOCTOR" ||
    profTypeUpper === "CRM" ||
    categoryLower.includes("médic") ||
    categoryLower.includes("medic");

  if (isDoctor) {
    return {
      allowedRoles: ["medico_trabalho"],
      isFullAccess: false,
      userTitle: "Médico(a) do Trabalho",
    };
  }

  // 3. Specific Safety Tech Profile (MTE / TST)
  const isSafetyTech =
    roleUpper === "SAFETY_TECH" ||
    profTypeUpper === "MTE" ||
    categoryLower.includes("técnico") ||
    categoryLower.includes("tecnico") ||
    categoryLower.includes("tst");

  if (isSafetyTech) {
    return {
      allowedRoles: ["tecnico_seguranca"],
      isFullAccess: false,
      userTitle: "Técnico(a) em Segurança do Trabalho",
    };
  }

  // 4. Specific Ergonomist Profile (CREFITO)
  const isErgonomist = profTypeUpper === "CREFITO" || categoryLower.includes("ergonom");

  if (isErgonomist) {
    return {
      allowedRoles: ["ergonomista"],
      isFullAccess: false,
      userTitle: "Ergonomista Ocupacional",
    };
  }

  // Perfis sem atribuição não recebem privilégios de gestão.
  return {
    allowedRoles: [],
    isFullAccess: false,
    userTitle: "Perfil sem agente atribuído",
  };
}
