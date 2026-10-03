/**
 * NEXTCON PLATFORM - CÉREBRO NORMATIVO 2026
 * Base de dados técnica avançada para Auditorias de Campo.
 * Foco: Risco de Vida, Saúde Mental e Conformidade eSocial.
 */

export type CriticalityLevel = "critical" | "high" | "medium" | "low";

export interface ChecklistItem {
  id: string;
  category: string;
  question: string;
  legal_ref: string;
  legal_text?: string;
  criticality: CriticalityLevel;
  help_text: string;
}

export interface NRChecklist {
  nr: string;
  title: string;
  items: ChecklistItem[];
}

export const NR_CHECKLISTS: Record<string, NRChecklist> = {
  nr01: {
    nr: "NR-01",
    title: "Gerenciamento de Riscos Ocupacionais (GRO/PGR)",
    items: [
      {
        id: "1.1",
        category: "Eficácia do PGR",
        question: "A implementação do PGR é monitorada e sua eficácia é avaliada periodicamente?",
        legal_ref: "1.5.5.1.1",
        legal_text:
          "A organização deve adotar as medidas necessárias para eliminar, reduzir ou controlar os riscos ocupacionais.",
        criticality: "high",
        help_text:
          "Verificar evidências de reuniões de análise crítica do plano de ação e eficácia das medidas.",
      },
      {
        id: "1.2",
        category: "Avaliação de Riscos",
        question:
          "A avaliação de riscos está atualizada considerando mudanças nos processos ou novas tecnologias?",
        legal_ref: "1.5.4.4.6",
        legal_text:
          "A avaliação de riscos deve ser revista a cada dois anos ou quando houver mudanças nas condições de trabalho.",
        criticality: "high",
        help_text: "Checar se houve mudança de layout ou maquinário sem atualização do inventário.",
      },
      {
        id: "1.3",
        category: "Saúde Mental",
        question:
          "O Inventário de Riscos identifica perigos psicossociais e organizacionais (estresse, sobrecarga, burnout)?",
        legal_ref: "1.5.3.2.1",
        legal_text:
          "A etapa de identificação de perigos deve incluir a análise dos fatores psicossociais e organizacionais.",
        criticality: "critical",
        help_text: "Auditar evidências de avaliações de clima ou protocolos de gestão de estresse.",
      },
      {
        id: "1.4",
        category: "Violência e Assédio",
        question:
          "A empresa possui canal de denúncia anônimo e treinamento anual contra assédio moral e sexual?",
        legal_ref: "Lei 14.457/22",
        legal_text:
          "As organizações devem incluir regras de conduta sobre assédio sexual e outras formas de violência nas normas internas.",
        criticality: "critical",
        help_text: "Item obrigatório para CIPA e PGR. Verificar código de ética.",
      },
    ],
  },
  nr07: {
    nr: "NR-07",
    title: "Programa de Controle Médico de Saúde Ocupacional (PCMSO)",
    items: [
      {
        id: "7.1",
        category: "Exames Ocupacionais",
        question:
          "Todos os exames (Admissionais, Periódicos, Mudança de Risco, Retorno e Demissionais) estão em dia?",
        legal_ref: "7.5.6",
        legal_text:
          "O PCMSO deve incluir a realização obrigatória dos exames médicos ocupacionais.",
        criticality: "critical",
        help_text: "Cruzar a lista de funcionários ativos com o cronograma de exames do PCMSO.",
      },
      {
        id: "7.2",
        category: "Conformidade PGR/PCMSO",
        question: "O PCMSO está em plena conformidade com os riscos identificados no PGR?",
        legal_ref: "7.3.1",
        legal_text:
          "O PCMSO deve ser elaborado considerando os riscos ocupacionais identificados e classificados pelo PGR.",
        criticality: "high",
        help_text: "Se o PGR aponta ruído, o PCMSO deve prever audiometria obrigatória.",
      },
    ],
  },
  nr09: {
    nr: "NR-09",
    title: "Avaliação e Controle de Exposições Ocupacionais",
    items: [
      {
        id: "9.1",
        category: "Monitoramento Ambiental",
        question:
          "As avaliações quantitativas de agentes físicos, químicos e biológicos foram realizadas e documentadas?",
        legal_ref: "9.4.1",
        legal_text:
          "A organização deve realizar a avaliação quantitativa das exposições ocupacionais aos agentes físicos, químicos e biológicos.",
        criticality: "high",
        help_text:
          "Verificar laudos de dosimetria de ruído, medições de calor ou particulados químicos.",
      },
      {
        id: "9.2",
        category: "Limites de Tolerância",
        question:
          "As exposições identificadas respeitam os limites de tolerância estabelecidos pela NR-15?",
        legal_ref: "9.4.2",
        legal_text:
          "A avaliação quantitativa deve ser utilizada para comprovar o controle ou a inexistência de riscos.",
        criticality: "critical",
        help_text:
          "Identificar se há extrapolação de limites sem o devido uso de proteção ou controle de engenharia.",
      },
      {
        id: "9.3",
        category: "Uso de EPI",
        question:
          "Os EPIs selecionados são eficazes para os agentes nocivos identificados e seu uso é fiscalizado?",
        legal_ref: "9.5.1",
        legal_text:
          "As medidas de prevenção devem incluir o uso de equipamento de proteção individual - EPI.",
        criticality: "high",
        help_text: "Verificar ficha de entrega de EPI e validade do Certificado de Aprovação (CA).",
      },
    ],
  },
  nr10: {
    nr: "NR-10",
    title: "Segurança em Instalações Elétricas",
    items: [
      {
        id: "10.1",
        category: "Prontuário",
        question:
          "O Prontuário das Instalações Elétricas (PIE) está atualizado para cargas acima de 75kW?",
        legal_ref: "10.2.4",
        legal_text:
          "Os estabelecimentos com carga instalada superior a 75 kW devem manter o Prontuário de Instalações Elétricas.",
        criticality: "high",
        help_text: "Deve conter diagramas unifilares atualizados.",
      },
      {
        id: "10.2",
        category: "Proteção",
        question:
          "As partes vivas das instalações possuem isolamento ou barreiras para impedir contato acidental?",
        legal_ref: "10.2.8.2",
        legal_text:
          "Devem ser adotadas medidas de proteção coletiva para prevenir o risco de choque elétrico.",
        criticality: "critical",
        help_text: "Verificar quadros elétricos abertos ou fiação exposta.",
      },
    ],
  },
  nr35: {
    nr: "NR-35",
    title: "Trabalho em Altura",
    items: [
      {
        id: "35.1",
        category: "Planejamento",
        question: "A Análise de Risco (AR) foi emitida antes do início da atividade em altura?",
        legal_ref: "35.4.5.1",
        legal_text: "Todo trabalho em altura deve ser precedido de Análise de Risco.",
        criticality: "critical",
        help_text: "A AR deve ser específica para o local e assinada por todos.",
      },
    ],
  },
};

export const getGenericChecklist = (nr: string, title: string): NRChecklist => ({
  nr,
  title,
  items: [
    {
      id: "g1",
      category: "Documentação Geral",
      question: "A documentação técnica exigida por esta norma está disponível para fiscalização?",
      legal_ref: "Geral",
      criticality: "low",
      help_text: "Verifique a organização de pastas físicas ou digitais.",
    },
  ],
});
