/**
 * NEXTCON PLATFORM - CATÁLOGO COMERCIAL SST 2026
 * Estrutura de precificação dinâmica para orçamentos automáticos.
 */

export interface SSTService {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  unit: "unidade" | "vida" | "ponto" | "hora";
}

export interface ServiceCategory {
  id: string;
  title: string;
  icon: string;
  services: SSTService[];
}

export const SST_CATALOG: ServiceCategory[] = [
  {
    id: "gestao",
    title: "1. Programas de Gestão",
    icon: "ClipboardCheck",
    services: [
      {
        id: "pgr",
        name: "PGR (NR-01)",
        description: "Programa de Gerenciamento de Riscos",
        basePrice: 850,
        unit: "unidade",
      },
      {
        id: "pcmso",
        name: "PCMSO (NR-07)",
        description: "Controle Médico de Saúde Ocupacional",
        basePrice: 650,
        unit: "unidade",
      },
      {
        id: "pca",
        name: "PCA",
        description: "Conservação Auditiva",
        basePrice: 450,
        unit: "unidade",
      },
      {
        id: "ppr",
        name: "PPR",
        description: "Proteção Respiratória",
        basePrice: 450,
        unit: "unidade",
      },
    ],
  },
  {
    id: "laudos",
    title: "2. Laudos Técnicos",
    icon: "Scale",
    services: [
      {
        id: "ltcat",
        name: "LTCAT",
        description: "Foco Previdenciário (INSS)",
        basePrice: 1200,
        unit: "unidade",
      },
      {
        id: "nr15",
        name: "Laudo de Insalubridade",
        description: "NR-15",
        basePrice: 950,
        unit: "unidade",
      },
      {
        id: "nr16",
        name: "Laudo de Periculosidade",
        description: "NR-16",
        basePrice: 950,
        unit: "unidade",
      },
      {
        id: "aet",
        name: "AET (Ergonomia)",
        description: "Análise Ergonômica Profunda",
        basePrice: 1500,
        unit: "unidade",
      },
      {
        id: "nr12",
        name: "Apreciação NR-12",
        description: "Segurança em Máquinas",
        basePrice: 800,
        unit: "unidade",
      },
    ],
  },
  {
    id: "auditoria_medica",
    title: "3. Auditoria Médica e Regulação",
    icon: "Stethoscope",
    services: [
      {
        id: "cons_med_aut",
        name: "Consultoria Médica de Autorização",
        description: "Análise e parecer médico solicitações autorização",
        basePrice: 150,
        unit: "unidade",
      },
      {
        id: "seg_op_med",
        name: "Segunda Opinião Médica",
        description: "Parecer especializado para apoio ao auditor",
        basePrice: 200,
        unit: "unidade",
      },
      {
        id: "junta_med",
        name: "Junta Médica ou Odontológica (RN 424)",
        description: "Processo para dirimir divergências técnico-assistencial",
        basePrice: 500,
        unit: "unidade",
      },
      {
        id: "cons_tec_retro",
        name: "Consultoria Técnica Retrospectiva",
        description: "Análise de contas médicas e intercâmbio",
        basePrice: 300,
        unit: "unidade",
      },
      {
        id: "par_jud",
        name: "Parecer para Demandas Judiciais",
        description: "Análise baseada em quesitos jurídicos",
        basePrice: 400,
        unit: "unidade",
      },
      {
        id: "cons_opme",
        name: "Consultoria OPME",
        description: "Parecer de enfermagem acerca de OPMEs",
        basePrice: 180,
        unit: "unidade",
      },
    ],
  },
  {
    id: "saude",
    title: "4. Saúde e Medicina Ocupacional",
    icon: "HeartPulse",
    services: [
      {
        id: "aso",
        name: "Emissão de ASO",
        description: "Admissional/Periódico/Demissional",
        basePrice: 45,
        unit: "vida",
      },
      {
        id: "audio",
        name: "Audiometria",
        description: "Exame complementar",
        basePrice: 35,
        unit: "vida",
      },
      {
        id: "lab",
        name: "Exames Laboratoriais",
        description: "Checkup completo",
        basePrice: 85,
        unit: "vida",
      },
    ],
  },
  {
    id: "higiene",
    title: "5. Higiene Ocupacional",
    icon: "Gauge",
    services: [
      {
        id: "ruido",
        name: "Dosimetria de Ruído",
        description: "Medição quantitativa 8h",
        basePrice: 180,
        unit: "ponto",
      },
      {
        id: "calor",
        name: "Avaliação de Calor",
        description: "IBUTG",
        basePrice: 250,
        unit: "ponto",
      },
      {
        id: "quimica",
        name: "Avaliação Química",
        description: "Bomba de Amostragem",
        basePrice: 450,
        unit: "ponto",
      },
    ],
  },
  {
    id: "esocial",
    title: "6. eSocial & Burocracia",
    icon: "Zap",
    services: [
      {
        id: "s2220",
        name: "Envio S-2220",
        description: "Monitoramento de Saúde",
        basePrice: 15,
        unit: "vida",
      },
      {
        id: "s2240",
        name: "Envio S-2240",
        description: "Condições Ambientais",
        basePrice: 15,
        unit: "vida",
      },
      {
        id: "cat",
        name: "Envio S-2210 (CAT)",
        description: "Comunicação de Acidente",
        basePrice: 150,
        unit: "unidade",
      },
    ],
  },
  {
    id: "treinamentos",
    title: "7. Treinamentos (NRs)",
    icon: "GraduationCap",
    services: [
      {
        id: "nr35",
        name: "NR-35 (Altura)",
        description: "Treinamento 8h",
        basePrice: 250,
        unit: "vida",
      },
      {
        id: "nr10",
        name: "NR-10 (Elétrica)",
        description: "Treinamento 40h",
        basePrice: 450,
        unit: "vida",
      },
      {
        id: "cipa",
        name: "CIPA (Designado)",
        description: "Formação obrigatória",
        basePrice: 350,
        unit: "unidade",
      },
    ],
  },
];

export const NEXTCON_DIFFERENTIALS = [
  "Qualidade técnica na emissão de pareceres, respeitando as melhoras práticas vigentes;",
  "Prazos dos serviços em conformidade com os prazos da Operadora definidos pela ANS;",
  "Garantia de impessoalidade no processo;",
  "Parecer técnico de especialistas renomados e atuantes em suas especialidades;",
  "Indicadores de gestão e resultados de desperdício evitado;",
  "Aumento da produtividade e ganho de tempo operacional;",
  "Melhoria na gestão dos recursos através do combate ao desperdício;",
  "Melhora na aplicação de glosas.",
];
