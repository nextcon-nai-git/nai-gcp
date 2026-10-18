import { BaseFirestoreRepository } from "../firestore/base-repository";
import { Employee } from "@/types/schema";

export interface EmployeeRecord extends Employee {
  id: string;
}

export class EmployeeRepository extends BaseFirestoreRepository<EmployeeRecord> {
  constructor() {
    super("employees");
  }

  async listByCompany(companyId: string): Promise<EmployeeRecord[]> {
    this.requireCompanyId(companyId);
    return this.list({ companyId });
  }

  async findByCpf(companyId: string, cpf: string): Promise<EmployeeRecord | null> {
    this.requireCompanyId(companyId);
    if (typeof cpf !== "string" || !cpf.trim())
      throw new Error("Informe o CPF para consultar o colaborador.");
    const records = await this.list({ companyId, cpf });
    if (records.length > 1)
      throw new Error(
        "Há mais de um colaborador com este CPF na empresa. Confira os cadastros antes de selecionar."
      );
    return records.length > 0 ? records[0] : null;
  }
}

export const employeeRepository = new EmployeeRepository();
