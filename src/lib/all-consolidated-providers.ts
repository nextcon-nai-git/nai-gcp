import { REAL_PROVIDERS } from "@/lib/real-data";

export interface ConsolidatedProvider {
  id: string;
  name: string;
  displayName?: string;
  companyName?: string;
  cnpj: string;
  profession: string;
  councilNumber?: string;
  type:
    | "CLINIC"
    | "LAB"
    | "DOCTOR"
    | "HOSPITAL"
    | "NURSE"
    | "ENGINEER"
    | "TECH_NURSE"
    | "ACCOUNTANT"
    | "CONSULTANCY";
  specialty: string;
  cep?: string;
  city: string;
  state: string;
  address?: string;
  email?: string;
  phone?: string;
  active: boolean;
  rating?: number;
  contractUrl?: string;
  photoUrl?: string;
  councilCardUrl?: string;
  servedCompanies?: string[];
  category?: string;
  legacyId?: string;
  nfseData?: any;
  boletoData?: any;
  financialHistory?: any;
}

const RAW_CLINICS = [
  {
    id: "clinic_working",
    name: "CLÍNICA WORKING MEDICINA DO TRABALHO",
    companyName: "CLINICA WORKING MEDICINA E SEGURANCA DO TRABALHO LTDA",
    cnpj: "06.910.982/0001-35",
    profession: "Clínica Credenciada",
    type: "CLINIC" as const,
    specialty: "Medicina Ocupacional & ASOs",
    city: "Curitiba",
    state: "PR",
    address: "Rua Marechal Deodoro, 51, Conj. 1505 / Galeria Ritz",
    email: "comercial@workingmedicina.com.br",
    phone: "(41) 3223-4577",
    active: true,
    rating: 5,
    category: "Clínica Credenciada / Medicina Ocupacional",
  },
  {
    id: "clinic_guaramed",
    name: "GUARAMED MEDICINA OCUPACIONAL",
    companyName: "GUARAMED CLINICA MEDICA LTDA",
    cnpj: "31.002.857/0001-74",
    profession: "Clínica Credenciada",
    type: "CLINIC" as const,
    specialty: "Exames Ocupacionais Litoral",
    city: "Guaratuba",
    state: "PR",
    address: "Rua Guilherme Pequeno, 271, Quadra 0375",
    email: "contato@guaramed.com.br",
    phone: "(41) 3442-1200",
    active: true,
    rating: 5,
    category: "Clínica Credenciada / Exames Ocupacionais",
  },
  {
    id: "clinic_viaseg",
    name: "VIASEG ASSESSORIA OCUPACIONAL",
    companyName: "VIASEG MEDICINA E SEGURANCA OCUPACIONAL LTDA",
    cnpj: "24.891.123/0001-45",
    profession: "Empresa Credenciada",
    type: "CLINIC" as const,
    specialty: "Engenharia e Medicina SST",
    city: "Curitiba",
    state: "PR",
    address: "Atendimento Região Metropolitana",
    email: "contato@viasegsaude.com.br",
    active: true,
    rating: 5,
    category: "Empresa Credenciada / Engenharia e Medicina SST",
  },
  {
    id: "clinic_iamed",
    name: "IAMED SERVIÇOS MÉDICOS LTDA",
    companyName: "IAMED SERVICOS MEDICOS LTDA",
    cnpj: "32.100.450/0001-88",
    profession: "Clínica Credenciada",
    type: "CLINIC" as const,
    specialty: "Atendimentos Ocupacionais",
    city: "Curitiba",
    state: "PR",
    address: "Atendimento Geral Curitiba",
    email: "contato@iamed.com.br",
    active: true,
    rating: 5,
    category: "Clínica Credenciada / Serviços Médicos",
  },
  {
    id: "clinic_boa_saude",
    name: "BOA SAÚDE FISIOTERAPIA & ERGONOMIA",
    companyName: "BOA SAUDE FISIOTERAPIA LTDA",
    cnpj: "28.450.120/0001-90",
    profession: "Empresa Credenciada",
    type: "CLINIC" as const,
    specialty: "Ergonomia, AEP & Fisioterapia do Trabalho",
    city: "Curitiba",
    state: "PR",
    address: "Atendimento Geral Curitiba",
    email: "contato@boasaudefisio.com.br",
    active: true,
    rating: 5,
    category: "Empresa Credenciada / Ergonomia e Fisioterapia",
  },
  {
    id: "clinic_bruzamolin",
    name: "BRUZAMOLIN SERVIÇOS MÉDICOS",
    companyName: "BRUZAMOLIN SERVICOS MEDICOS LTDA",
    cnpj: "02.878.085/0001-90",
    profession: "Médico do Trabalho",
    type: "DOCTOR" as const,
    specialty: "Perícias & ASOs Ocupacionais",
    city: "Curitiba",
    state: "PR",
    address: "Curitiba e Região Metropolitana",
    email: "",
    active: true,
    rating: 5,
    category: "Clínica Credenciada / Médicos do Trabalho",
  },
];

export function getConsolidatedProviders(): ConsolidatedProvider[] {
  const providersMap = new Map<string, ConsolidatedProvider>();

  // 2. Add REAL_PROVIDERS
  for (const item of REAL_PROVIDERS) {
    const id = item.id;
    providersMap.set(id, {
      ...item,
      id,
      name: item.name,
      displayName: item.name,
      companyName: item.name,
      cnpj: item.cnpj,
      profession: item.profession || "Especialista SST",
      councilNumber: item.councilNumber,
      type: (item.type as any) || "DOCTOR",
      specialty: item.specialty,
      city: item.city || "Curitiba",
      state: item.state || "PR",
      email: item.email,
      phone: item.phone,
      active: item.active,
      rating: item.rating || 5,
      servedCompanies: item.servedCompanies || [],
    } as any);
  }

  // 4. Add RAW_CLINICS
  for (const item of RAW_CLINICS) {
    providersMap.set(item.id, {
      ...item,
      displayName: item.name,
    });
  }

  return Array.from(providersMap.values());
}
