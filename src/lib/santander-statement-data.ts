export interface SantanderStatementSummary {
  companyName: string;
  cnpj: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  period: string;
  asOfDate: string;
  checkingBalance: number;
  blockedBalance: number;
  iofAccrued: number;
  investmentContaMax: number;
  totalCheckingPlusInvest: number;
  creditLimit: number;
  totalAvailableWithLimit: number;
  totalCredits: number;
  totalDebits: number;
  netResult: number;
}

export interface SantanderTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  formattedDate: string; // DD/MM/YYYY
  description: string;
  beneficiary: string;
  category:
    | "CLÍNICA CREDENCIADA"
    | "EQUIPE NXC"
    | "PRESTADOR SST"
    | "SOFTWARE & SISTEMAS"
    | "TRIBUTOS & IMPOSTOS"
    | "TARIFAS BANCÁRIAS"
    | "FATURAMENTO & RECEITAS"
    | "OUTROS";
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceAfter: number;
  reconciledWith: string;
  documentNumber?: string;
}

export const SANTANDER_STATEMENT_SUMMARY: SantanderStatementSummary = {
  companyName: "NXC SST EMPRESARIAL LTDA",
  cnpj: "44.337.647/0001-89",
  bankName: "Banco Santander (Brasil) S.A. (033)",
  agency: "",
  accountNumber: "",
  period: "20/05/2026 a 18/08/2026",
  asOfDate: "18/08/2026 as 07h32",
  checkingBalance: 0,
  blockedBalance: 0,
  iofAccrued: 0,
  investmentContaMax: 0,
  totalCheckingPlusInvest: 0,
  creditLimit: 0,
  totalAvailableWithLimit: 0,
  totalCredits: 0,
  totalDebits: 0,
  netResult: 0,
};

export const SANTANDER_CONCILIATED_TRANSACTIONS: SantanderTransaction[] = [];
