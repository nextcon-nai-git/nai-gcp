/**
 * NEXTCON WHATSAPP BOT & SMART HUMAN ROUTING SYSTEM (2026)
 * Telefone Oficial: (41) 3358-0818
 * Mapeamento de 1 a 9 Agentes de IA com Transbordo Humano Contextualizado.
 */

export interface WhatsappDepartment {
  optionNumber: number;
  id: string;
  name: string;
  description: string;
  aiAgentRole: string;
  aiAgentName: string;
  humanResponsible: {
    name: string;
    role: string;
    email: string;
    directPhone: string;
    whatsappFormatted: string;
  };
  keywords: string[];
  welcomeMessage: string;
  humanHandoffTriggerWords: string[];
}

export const NEXTCON_WHATSAPP_NUMBER = "554133580818";
export const NEXTCON_WHATSAPP_DISPLAY = "(41) 3358-0818";

export const WHATSAPP_DEPARTMENTS: Record<number, WhatsappDepartment> = {
  1: {
    optionNumber: 1,
    id: "comercial",
    name: "Comercial & Novos Contratos SST",
    description:
      "Propostas comerciais, cotação de PGR/PCMSO, terceirização de ambulatório e parcerias.",
    aiAgentRole: "comercial_agent",
    aiAgentName: "IA Comercial NextCon",
    humanResponsible: {
      name: "Pablo",
      role: "Comercial & Novos Negócios",
      email: "pablo@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 101",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "proposta",
      "orcamento",
      "cotação",
      "preco",
      "contratar",
      "comercial",
      "valores",
      "plano",
      "contrato",
    ],
    welcomeMessage:
      "💼 *Comercial NextCon:*\nOlá! Sou o assistente de orçamentos e soluções SST da NextCon. Como posso te ajudar com a gestão de segurança e saúde da sua empresa?",
    humanHandoffTriggerWords: [
      "falar com pablo",
      "pablo",
      "vendedor",
      "humano",
      "atendente",
      "fechar contrato",
    ],
  },
  2: {
    optionNumber: 2,
    id: "agendamento",
    name: "Agendamento de Exames & ASO",
    description:
      "Marcação de exames admissionais, periódicos, demissionais e retorno ao trabalho em clínicas credenciadas.",
    aiAgentRole: "agendamento_agent",
    aiAgentName: "IA Agendamento de Exames",
    humanResponsible: {
      name: "Kelly",
      role: "Atendimento & Agendamentos",
      email: "agendamento@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 102",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "agendar",
      "marcar",
      "exame",
      "admissional",
      "periodico",
      "demissional",
      "aso",
      "clinica",
      "horario",
      "data",
    ],
    welcomeMessage:
      "🩺 *Agendamento de Exames NAI:*\nOlá! Posso localizar a clínica credenciada mais próxima do seu colaborador e verificar horários disponíveis para emissão de ASO. Qual o tipo de exame e cidade desejada?",
    humanHandoffTriggerWords: [
      "falar com kelly",
      "kelly",
      "agendamento humano",
      "atendente",
      "urgencia no exame",
    ],
  },
  3: {
    optionNumber: 3,
    id: "financeiro",
    name: "Financeiro, Faturamento & CASSI",
    description:
      "2ª via de boletos, notas fiscais, faturamento de prestadores, guias TISS e convênios.",
    aiAgentRole: "financeiro_agent",
    aiAgentName: "IA Financeiro & Faturamento",
    humanResponsible: {
      name: "Kelly",
      role: "Financeiro & Faturamento",
      email: "financeiro@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 103",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "boleto",
      "nota fiscal",
      "nf",
      "fatura",
      "financeiro",
      "pagamento",
      "cassi",
      "tiss",
      "cobranca",
      "segunda via",
    ],
    welcomeMessage:
      "💳 *Financeiro & Faturamento NextCon:*\nOlá! Posso auxiliar com a emissão de boletos, status de notas fiscais ou faturamento de guias TISS/CASSI. O que você precisa?",
    humanHandoffTriggerWords: [
      "falar com financeiro",
      "kelly financeiro",
      "comprovante",
      "humano",
      "atendente",
    ],
  },
  4: {
    optionNumber: 4,
    id: "medico_trabalho",
    name: "Médico do Trabalho (PCMSO & ASO)",
    description:
      "Dúvidas sobre aptidão, rol de exames por risco, nexo causal (NTEP/FAP) e coordenação do PCMSO.",
    aiAgentRole: "medico_trabalho",
    aiAgentName: "IA Médico do Trabalho (NAI 3.7)",
    humanResponsible: {
      name: "Dr. Rodrigo",
      role: "Médico do Trabalho & Coordenador PCMSO",
      email: "rodrigo.med@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 104",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "medico",
      "doutor",
      "pcmso",
      "aptidao",
      "inapto",
      "laudo medico",
      "nexo",
      "ntep",
      "cat",
      "rodrigo",
      "exame complementar",
    ],
    welcomeMessage:
      "👨‍⚕️ *Medicina do Trabalho (PCMSO - NR-07):*\nOlá! Sou o assistente de Medicina Ocupacional da NextCon. Posso esclarecer protocolos clínicos do PCMSO, exames obrigatórios por risco e critérios de aptidão. Em que posso ajudar?",
    humanHandoffTriggerWords: [
      "falar com dr rodrigo",
      "dr rodrigo",
      "doutor",
      "medico humano",
      "atendente medico",
    ],
  },
  5: {
    optionNumber: 5,
    id: "ergonomista",
    name: "Ergonomista & NR-17 (AET)",
    description:
      "Avaliação Ergonômica Preliminar (AEP), Análise Ergonômica do Trabalho (AET), biomecânica e prevenção de LER/DORT.",
    aiAgentRole: "ergonomista",
    aiAgentName: "IA Ergonomista & Biomecânica (NAI 3.7)",
    humanResponsible: {
      name: "Henrique",
      role: "Ergonomista Chefe & Fisioterapeuta do Trabalho",
      email: "henrique.ergo@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 105",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "ergonomia",
      "nr17",
      "nr-17",
      "aet",
      "aep",
      "postura",
      "ler",
      "dort",
      "henrique",
      "biomecanica",
      "ginastica laboral",
    ],
    welcomeMessage:
      "🧘‍♂️ *Ergonomia & Biomecânica Ocupacional (NR-17):*\nOlá! Sou o especialista em Ergonomia da NextCon. Posso orientar sobre diagnósticos de postos de trabalho (AEP/AET), adequações de mobiliário e conformidade com a NR-17.",
    humanHandoffTriggerWords: [
      "falar com henrique",
      "henrique",
      "ergonomista humano",
      "avaliador ergonômico",
    ],
  },
  6: {
    optionNumber: 6,
    id: "engenheiro_seguranca",
    name: "Engenheiro de Segurança (PGR & LTCAT)",
    description:
      "Inventário de riscos ocupacionais, PGR (NR-01), LTCAT para eSocial (S-2240), laudos de insalubridade e periculosidade.",
    aiAgentRole: "engenheiro_seguranca",
    aiAgentName: "IA Engenheiro de Segurança (NAI 3.7)",
    humanResponsible: {
      name: "Felipe",
      role: "Engenheiro de Segurança do Trabalho & Responsável Técnico",
      email: "felipe.eng@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 106",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "engenheiro",
      "engenharia",
      "pgr",
      "ltcat",
      "s2240",
      "insalubridade",
      "periculosidade",
      "nr01",
      "nr12",
      "nr35",
      "felipe",
    ],
    welcomeMessage:
      "👷‍♂️ *Engenharia de Segurança & Gestão de Riscos:*\nOlá! Sou o Engenheiro de Segurança da NextCon. Estou pronto para auxiliar na elaboração e auditoria de PGR, LTCAT, laudos técnicos e medidas de controle de engenharia.",
    humanHandoffTriggerWords: [
      "falar com felipe",
      "felipe engenheiro",
      "felipe",
      "engenheiro humano",
      "responsavel tecnico",
    ],
  },
  7: {
    optionNumber: 7,
    id: "tecnico_seguranca",
    name: "Técnico de Segurança (Campo, DDS & EPI)",
    description:
      "Fiscalização de campo, entrega de EPIs, Diálogo Diário de Segurança (DDS), CIPA e permissões de trabalho (PT).",
    aiAgentRole: "tecnico_seguranca",
    aiAgentName: "IA Técnico de Campo (NAI 3.7)",
    humanResponsible: {
      name: "Plantão Técnico SST",
      role: "Equipe de Supervisão de Campo",
      email: "tecnicos@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 107",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "tecnico",
      "campo",
      "epi",
      "dds",
      "cipa",
      "inspecao",
      "obra",
      "fabrica",
      "quase acidente",
      "vistoria",
    ],
    welcomeMessage:
      "👷 *Técnico de Segurança & Operações de Campo:*\nOlá! Sou o Técnico em Segurança do Trabalho. Posso gerar temas de DDS, orientar sobre uso correto de EPIs e procedimentos operacionais seguros.",
    humanHandoffTriggerWords: [
      "falar com tecnico",
      "tecnico de campo",
      "plantao tecnico",
      "humano",
    ],
  },
  8: {
    optionNumber: 8,
    id: "enfermeiro_trabalho",
    name: "Enfermagem do Trabalho & Absenteísmo",
    description:
      "Triagem ambulatorial, gestão de atestados médicos, campanhas de vacinação e controle de absenteísmo.",
    aiAgentRole: "enfermeiro_trabalho",
    aiAgentName: "IA Enfermagem do Trabalho (NAI 3.7)",
    humanResponsible: {
      name: "Enfermagem de Plantão",
      role: "Supervisão Ambulatorial & Enfermagem",
      email: "enfermagem@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 108",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "enfermagem",
      "enfermeiro",
      "atestado",
      "licenca",
      "vacinacao",
      "ambulatorio",
      "primeiros socorros",
      "absenteismo",
    ],
    welcomeMessage:
      "👩‍⚕️ *Enfermagem do Trabalho & Saúde Ambulatorial:*\nOlá! Sou o assistente de Enfermagem Ocupacional. Posso orientar sobre envio de atestados, protocolos de primeiros socorros e rotinas ambulatoriais.",
    humanHandoffTriggerWords: [
      "falar com enfermagem",
      "enfermeira",
      "atendente de saude",
      "humano",
    ],
  },
  9: {
    optionNumber: 9,
    id: "diretoria",
    name: "Diretoria & Ouvidoria Estratégica",
    description:
      "Alinhamentos estratégicos C-Level, grandes contas, ouvidoria executiva e conformidade corporativa.",
    aiAgentRole: "diretoria_agent",
    aiAgentName: "IA Diretoria Executiva NAI",
    humanResponsible: {
      name: "Felipe ou Thiago",
      role: "Diretoria Executiva NextCon Intelligence",
      email: "diretoria@nextcon.com.br",
      directPhone: "(41) 3358-0818 - Ramal 109",
      whatsappFormatted: "554133580818",
    },
    keywords: [
      "diretoria",
      "diretor",
      "thiago",
      "felipe",
      "ouvidoria",
      "estrategico",
      "c level",
      "contrato corporativo",
      "reclamacao",
    ],
    welcomeMessage:
      "🏛️ *Diretoria Executiva NextCon:*\nOlá! Você está no canal direto da Diretoria da NextCon Intelligence. Posso registrar sua solicitação estratégica ou transferir imediatamente para os diretores Felipe ou Thiago.",
    humanHandoffTriggerWords: [
      "falar com felipe",
      "felipe",
      "falar com thiago",
      "thiago",
      "diretor",
      "humano",
      "urgencia diretoria",
    ],
  },
};

/**
 * Gera o Menu Principal de Boas-Vindas do WhatsApp (41 3358-0818)
 */
export function generateWhatsappWelcomeMenu(): string {
  let menu = `👋 *Olá! Bem-vindo à NextCon Intelligence (NAI)* 🚀\n`;
  menu += `Central Oficial: *${NEXTCON_WHATSAPP_DISPLAY}*\n\n`;
  menu += `Por favor, digite o *número de 1 a 9* correspondente ao assunto desejado para falar com nossa IA Especialista ou ser transferido para o responsável:\n\n`;

  for (let i = 1; i <= 9; i++) {
    const dept = WHATSAPP_DEPARTMENTS[i];
    menu += `*${i}* - ${dept.name} _(${dept.humanResponsible.name})_\n`;
  }

  menu += `\n*0* - Falar com a Recepção / Atendimento Geral Humano\n\n`;
  menu += `💡 _Você também pode simplesmente digitar sua dúvida em texto livre que identificamos o setor automaticamente!_`;

  return menu;
}

/**
 * Identifica o departamento correspondente a partir da mensagem do usuário
 */
export function identifyDepartmentFromInput(text: string): WhatsappDepartment | null {
  const trimmed = text.trim().toLowerCase();

  // 1. Verificação por número direto (1 a 9)
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && WHATSAPP_DEPARTMENTS[num]) {
    return WHATSAPP_DEPARTMENTS[num];
  }

  // 2. Verificação por palavras-chave
  for (let i = 1; i <= 9; i++) {
    const dept = WHATSAPP_DEPARTMENTS[i];
    if (dept.keywords.some((kw) => trimmed.includes(kw.toLowerCase()))) {
      return dept;
    }
  }

  return null;
}

/**
 * Verifica se o usuário solicitou transbordo humano explícito
 */
export function isHumanHandoffRequested(text: string, currentDept?: WhatsappDepartment): boolean {
  const trimmed = text.trim().toLowerCase();
  const globalHandoffWords = [
    "humano",
    "atendente",
    "falar com pessoa",
    "pessoa",
    "operador",
    "suporte humano",
    "transferir",
    "0",
  ];

  if (globalHandoffWords.some((w) => trimmed.includes(w))) {
    return true;
  }

  if (
    currentDept &&
    currentDept.humanHandoffTriggerWords.some((w) => trimmed.includes(w.toLowerCase()))
  ) {
    return true;
  }

  return false;
}

/**
 * Gera mensagem formatada para transbordo humano no WhatsApp
 */
export function generateHumanHandoffResponse(
  dept: WhatsappDepartment,
  userPhone: string,
  chatSummary: string
): {
  botMessage: string;
  directWhatsappLink: string;
} {
  const human = dept.humanResponsible;
  const botMessage =
    `🔄 *Transferindo para Atendimento Humano...*\n\n` +
    `Você está sendo conectado com *${human.name}* (${human.role}).\n` +
    `📧 E-mail: ${human.email}\n` +
    `📞 Telefone: ${human.directPhone}\n\n` +
    `⏱️ *Tempo estimado de resposta:* Menos de 5 minutos em horário comercial.\n` +
    `Caso prefira, clique no link direto abaixo para abrir o chat exclusivo com ${human.name}:`;

  const transferMsg = `Olá ${human.name}! Vim através da URA WhatsApp NextCon (${NEXTCON_WHATSAPP_DISPLAY}).\nAssunto: ${dept.name}\nResumo da conversa: ${chatSummary || "Início de atendimento direto"}`;
  const directWhatsappLink = `https://wa.me/${human.whatsappFormatted}?text=${encodeURIComponent(transferMsg)}`;

  return { botMessage, directWhatsappLink };
}
