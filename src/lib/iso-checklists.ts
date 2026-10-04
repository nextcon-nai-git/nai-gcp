/**
 * NEXTCON PLATFORM - CÉREBRO DE AUDITORIA ISO PROFISSIONAL 2026
 * Definição exaustiva de requisitos baseada nas cláusulas 4 a 10 das normas ISO.
 * Versão Expandida v4.0 - ISO 27001 SGSI Integral
 */

export interface IsoChecklistItem {
  id: string;
  clause: string;
  requirement: string;
  helpText: string;
}

export interface IsoChecklist {
  id: string;
  title: string;
  items: IsoChecklistItem[];
}

export const ISO_CHECKLISTS: Record<string, IsoChecklist> = {
  "ISO 9001:2015": {
    id: "iso9001",
    title: "Sistema de Gestão da Qualidade (SGQ)",
    items: [
      {
        id: "9001-4.1",
        clause: "Contexto",
        requirement:
          "A organização determinou questões externas e internas pertinentes ao seu propósito?",
        helpText: "Verificar análise SWOT ou PESTEL atualizada.",
      },
      {
        id: "9001-5.1.1",
        clause: "Liderança",
        requirement: "A alta direção demonstra liderança e comprometimento com o SGQ?",
        helpText: "Verificar envolvimento em reuniões e eficácia do sistema.",
      },
      {
        id: "9001-6.1.1",
        clause: "Riscos e Oportunidades",
        requirement: "A organização determinou riscos e oportunidades para assegurar resultados?",
        helpText: "Avaliar matriz de riscos do negócio.",
      },
      {
        id: "9001-10.3",
        clause: "Melhoria Contínua",
        requirement:
          "A organização melhora continuamente a adequação, suficiência e eficácia do SGQ?",
        helpText: "Verificar evidências de Kaizen ou projetos de melhoria.",
      },
    ],
  },
  "ISO 14001:2015": {
    id: "iso14001",
    title: "Sistema de Gestão Ambiental (SGA)",
    items: [
      {
        id: "14001-6.1.2",
        clause: "Aspectos Ambientais",
        requirement: "Aspectos ambientais foram determinados sob uma perspectiva de ciclo de vida?",
        helpText: "Auditar Matriz AIA (Aspectos e Impactos Ambientais).",
      },
      {
        id: "14001-8.2",
        clause: "Emergência",
        requirement:
          "Processos para responder a situações de emergência ambiental foram estabelecidos?",
        helpText: "Verificar PAE e simulados.",
      },
    ],
  },
  "ISO 45001:2018": {
    id: "iso45001",
    title: "Saúde e Segurança Ocupacional (SSO)",
    items: [
      {
        id: "45001-5.4",
        clause: "Consulta e Participação",
        requirement: "Existem processos eficazes para consulta e participação de trabalhadores?",
        helpText: "Auditar atas de CIPA e canais de sugestões.",
      },
      {
        id: "45001-8.1.2",
        clause: "Hierarquia de Controles",
        requirement: "Eliminação e substituição são priorizadas sobre o uso de EPI?",
        helpText: "Auditar eficácia do plano de ação do PGR.",
      },
    ],
  },
  "ISO 27001:2022": {
    id: "iso27001",
    title: "Segurança da Informação (SGSI)",
    items: [
      {
        id: "27001-4.3",
        clause: "Escopo",
        requirement: "O escopo do SGSI está definido considerando os limites e aplicabilidade?",
        helpText: "Verificar se o processamento de dados Multi-tenant está no escopo.",
      },
      {
        id: "27001-5.2",
        clause: "Política",
        requirement: "Existe uma política de segurança da informação estabelecida e comunicada?",
        helpText: "Verificar política de senhas e uso de ativos.",
      },
      {
        id: "27001-6.1.2",
        clause: "Avaliação de Risco",
        requirement: "O processo de avaliação de riscos de segurança da informação é aplicado?",
        helpText: "Auditar matriz de riscos cibernéticos e vazamento de dados.",
      },
      {
        id: "27001-7.2",
        clause: "Competência",
        requirement:
          "Trabalhadores com acesso a dados sensíveis (PHI) possuem treinamento em segurança?",
        helpText: "Verificar certificados de treinamento em LGPD/ISO 27001.",
      },
      {
        id: "27001-8.1",
        clause: "Operação",
        requirement: "Os processos planejados para segurança da informação são controlados?",
        helpText: "Verificar logs de acesso e firewall de aplicação.",
      },
      {
        id: "27001-A.5.1",
        clause: "Controles Organizacionais",
        requirement: "Existem políticas para segurança da informação e revisões periódicas?",
        helpText: "Controle A.5.1 da ISO 27002:2022.",
      },
      {
        id: "27001-A.5.15",
        clause: "Controle de Acesso",
        requirement:
          "O acesso a informações e ativos é restrito conforme a política de controle de acesso?",
        helpText: "Verificar RBAC (Role-Based Access Control) no Firestore.",
      },
      {
        id: "27001-A.8.10",
        clause: "Criptografia",
        requirement:
          "Regras para o uso de criptografia para proteção da informação foram estabelecidas?",
        helpText: "Confirmar uso de SSL/TLS e criptografia em repouso do Google Cloud.",
      },
      {
        id: "27001-A.8.16",
        clause: "Monitoramento",
        requirement: "Atividades de usuários e eventos de segurança são registrados e monitorados?",
        helpText: "Auditar coleção 'phi_audit_logs' e 'trilha_auditoria'.",
      },
      {
        id: "27001-9.3",
        clause: "Análise Crítica",
        requirement: "A alta direção revisa o SGSI para garantir eficácia?",
        helpText: "Verificar ata de análise crítica focada em segurança cibernética.",
      },
    ],
  },
};

export const getGenericChecklist = (nr: string, title: string) => ({
  nr,
  title,
  items: [
    {
      id: `${nr}-g1`,
      category: "Documentação Geral",
      question: "A documentação técnica exigida por esta norma está disponível para fiscalização?",
      legal_ref: "Geral",
      criticality: "low",
      help_text: "Verifique a organização de pastas físicas ou digitais.",
    },
  ],
});
