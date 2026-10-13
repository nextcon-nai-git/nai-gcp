"use client";

import type { Company, ActionResult } from "@/types/schema";

export interface SeniorSyncOptions {
  company: Company;
  module: "payroll" | "employees" | "clinical";
}

/**
 * The Senior transport is not implemented. Keep legacy callers fail-closed until
 * credential validation and provider responses are implemented on the server.
 */
export class SeniorErpService {
  static async validateConnection(_config: {
    tenant: string;
    appKey: string;
    appSecret: string;
  }): Promise<ActionResult> {
    void _config;
    return {
      sucesso: false,
      mensagem: "Integração Senior indisponível. As credenciais não foram validadas.",
    };
  }

  static async syncEmployees(_companyId: string): Promise<ActionResult> {
    void _companyId;
    return {
      sucesso: false,
      mensagem: "Integração Senior indisponível. Nenhum cadastro de funcionário foi sincronizado.",
    };
  }

  static async fetchPayrollRubrics(
    _companyId: string,
    _competencia: string
  ): Promise<ActionResult> {
    void _companyId;
    void _competencia;
    return {
      sucesso: false,
      mensagem:
        "Integração Senior indisponível. Rubricas e encargos da folha não foram consultados.",
    };
  }
}
