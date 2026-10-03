/**
 * NEXTCON PLATFORM - BASE DE DADOS REAL 2026
 * Fonte única de verdade para faturamento, contratos, clientes, prestadores e atendimentos.
 * Integração Oficial: COCEL e NATIVA EMPREENDIMENTOS
 */

export const REAL_COMPANIES = [
  {
    id: "COCEL_75",
    name: "COMPANHIA CAMPOLARGUENSE DE ENERGIA - COCEL",
    cnpj: "75.805.895/0001-30",
    active: true,
    risk_degree: 3,
    segment: "ENERGY",
    city: "Campo Largo",
    state: "PR",
    address: "Rua Rui Barbosa, 520",
    lat: -25.4601,
    lng: -49.2312,
  },
  {
    id: "NATIVA_51",
    name: "NATIVA EMPREENDIMENTOS",
    cnpj: "51.633.820/0001-51",
    active: true,
    risk_degree: 3,
    segment: "CONSTRUCTION",
    city: "Guaratuba",
    state: "PR",
    address: "Avenida Dr João Cândido, 755 - Edifício Laguna",
    lat: -25.8821,
    lng: -48.5721,
  },
];

export const REAL_CONTRACTS = [
  {
    id: "CT_COCEL_2026",
    companyId: "COCEL_75",
    companyName: "COCEL - DISTRIBUIÇÃO DE ENERGIA",
    title: "Termo Aditivo: Gestão SST & eSocial",
    value: 12794.07,
    status: "Active",
    annualValue: 153528.84,
    notes: "Ajuste via IPCA 4,4414% - Vigência 24 meses",
  },
];

export const REAL_EMPLOYEES = [
  {
    id: "COL_NATIVA_01",
    name: "CASSIO VINICIUS",
    cpf: "000.000.000-00",
    companyId: "NATIVA_51",
    jobRole: "Engenheiro Civil",
    status: "active",
  },
  {
    id: "COL_COCEL_01",
    name: "RAFAEL ROGISKI (DIRETOR)",
    cpf: "000.000.000-00",
    companyId: "COCEL_75",
    jobRole: "Presidente",
    status: "active",
  },
  {
    id: "COL_COCEL_02",
    name: "OPERADOR DE REDE COCEL",
    cpf: "111.222.333-44",
    companyId: "COCEL_75",
    jobRole: "Eletricista",
    status: "active",
  },
];

export const MOCK_NURSING_ATTENDANCES = [
  {
    id: "NATT_COCEL_01",
    employeeId: "COL_COCEL_02",
    employeeName: "OPERADOR DE REDE COCEL",
    companyId: "COCEL_75",
    complaint: "Avaliação de rotina pós-obra.",
    bp_sys: "120",
    bp_dia: "80",
    heart_rate: "72",
    temperature: "36.5",
    spo2: "99",
    conduct: "work",
    medication: "Nenhuma",
    nurseName: "NAI Medical Assistant",
    coren: "123456-TE/PR",
    createdAt: new Date().toISOString(),
  },
];

export const REAL_HIERARCHICAL_DATA = [
  {
    id_cliente: "COCEL_75",
    nome_fantasia: "COCEL",
    razao_social: "COMPANHIA CAMPOLARGUENSE DE ENERGIA",
    total_vidas: 142,
    colaboradores: [
      {
        id_colaborador: "COL_COCEL_01",
        name: "RAFAEL ROGISKI",
        cpf: "000.000.000-00",
        jobTitle: "DIRETOR",
      },
    ],
  },
  {
    id_cliente: "NATIVA_51",
    nome_fantasia: "NATIVA",
    razao_social: "NATIVA EMPREENDIMENTOS",
    total_vidas: 664,
    colaboradores: [
      {
        id_colaborador: "COL_NATIVA_01",
        name: "CASSIO VINICIUS",
        cpf: "000.000.000-00",
        jobTitle: "ENGENHEIRO",
      },
    ],
  },
];

export const REAL_PROVIDERS = [
  { id: "PROV_01", name: "Laboratório Saúde", lat: -25.4284, lng: -49.2733 },
  { id: "PROV_02", name: "Clínica Ocupacional", lat: -25.4601, lng: -49.2312 },
];

export const REAL_EXAMS_HISTORY = [
  { id: "EXM_01", type: "ASO", date: "2025-01-10", employee: "COL_COCEL_01" },
];

export const DRE_2025_HISTORY = [{ month: "Jan", revenue: 15000, expenses: 5000 }];

export const REAL_TRAININGS = [
  { id: "TRN_01", title: "NR 10 - Básico", hours: 40, students: ["COL_COCEL_02"], completions: 1 },
];

export const REAL_PATIENTS = [
  {
    id: "PAC_MARIA_01",
    name: "Dona Maria",
    cpf: "111.222.333-44",
    clinicalData: {
      idade: 72,
      sexo: "F",
      peso: 82,
      altura: 1.55, // IMC ~ 34.1 (Obesidade I)
      glicemia_jejum: 135,
      hba1c: 7.2, // Diabetes
      pas: 145,
      pad: 92, // HAS
      das28_score: 4.5, // Reumatologia Atividade Moderada
      katz_score: 4, // Dependência moderada
      phq9: [1, 2, 1, 2, 0, 1, 1, 2, 0], // Soma = 10
      asa_score: 3,
    },
  },
  {
    id: "PAC_ANA_02",
    name: "Ana Carolina",
    cpf: "555.666.777-88",
    clinicalData: {
      idade: 28,
      sexo: "F",
      peso: 65,
      altura: 1.68, // IMC ~ 23 (Normal)
      idade_gestacional_semanas: 22, // 2o Tri
      fatores_risco_gestacional: ["Hipertensão Gestacional", "Histórico de Pré-eclâmpsia"], // Alto Risco
      pas: 135,
      pad: 85, // Pré HAS
      gad7: [2, 2, 3, 2, 1, 1, 0], // Soma = 11 (Ansiedade)
    },
  },
];
