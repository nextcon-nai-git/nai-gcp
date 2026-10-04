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
    return this.list({ companyId });
  }

  async findByCpf(companyId: string, cpf: string): Promise<EmployeeRecord | null> {
    const records = await this.list({ companyId, cpf });
    return records.length > 0 ? records[0] : null;
  }
}

export const employeeRepository = new EmployeeRepository();
