/**
 * NEXTCON PLATFORM - REPOSITÓRIO DE TEMPLATES NRs 2026
 * Mapeamento das 38 Normas Regulamentadoras para injeção rápida no Kanban.
 */

import { TaskType, Priority } from "@/types/schema";

export interface NrTemplate {
  id: string;
  nr: string;
  title: string;
  category: TaskType;
  priority: Priority;
  description: string;
  checklist: string[];
}

export const NR_TEMPLATES: NrTemplate[] = [
  // NR-01: GERENCIAMENTO DE RISCOS
  {
    id: "nr01_pgr_update",
    nr: "NR-01",
    title: "Atualização Anual do PGR",
    category: "pgr",
    priority: "high",
    description:
      "Revisão do Inventário de Riscos e Plano de Ação conforme nova estrutura organizacional.",
    checklist: [
      "Identificar novos perigos por GHE",
      "Reavaliar matriz de risco (P x S)",
      "Validar medidas de controle existentes",
      "Assinar documento via NAI Digital",
    ],
  },
  // NR-07: PCMSO
  {
    id: "nr07_pcmso_relatorio",
    nr: "NR-07",
    title: "Emissão de Relatório Analítico PCMSO",
    category: "pcmso",
    priority: "medium",
    description: "Gerar relatório anual consolidando estatísticas de exames e agravos à saúde.",
    checklist: [
      "Cruzar dados de ASOs realizados",
      "Identificar incidência de CID por setor",
      "Validar cronograma de exames complementares",
    ],
  },
  // NR-12: MÁQUINAS E EQUIPAMENTOS
  {
    id: "nr12_apreciacao_risco",
    nr: "NR-12",
    title: "Apreciação de Risco em Máquinas",
    category: "ltcat",
    priority: "critical",
    description: "Análise técnica de proteções e sistemas de segurança em máquinas operatrizes.",
    checklist: [
      "Inspecionar botões de emergência",
      "Validar enclausuramento de partes móveis",
      "Emitir ART de adequação técnica",
    ],
  },
  // NR-35: TRABALHO EM ALTURA
  {
    id: "nr35_treinamento_equipe",
    nr: "NR-35",
    title: "Capacitação NR-35 (Altura)",
    category: "treinamento",
    priority: "high",
    description: "Treinamento teórico e prático para colaboradores expostos a risco de queda.",
    checklist: [
      "Validar ASOs (Apto para Altura)",
      "Realizar simulado de resgate",
      "Emitir certificados digitais",
    ],
  },
  // eSOCIAL: GESTÃO BUROCRÁTICA
  {
    id: "esocial_s2240_audit",
    nr: "eSocial",
    title: "Auditoria de Eventos S-2240",
    category: "esocial",
    priority: "critical",
    description: "Sincronização de riscos do PGR com a carga tributária do eSocial.",
    checklist: [
      "Validar códigos Tabela 24",
      "Conferir CAs de EPIs vinculados",
      "Transmitir eventos pendentes",
    ],
  },
];
