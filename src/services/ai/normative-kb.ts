/**
 * NAI OFFICIAL NORMATIVE KNOWLEDGE BASE (BASE NORMATIVA CONSOLIDADA)
 * Contém o repositório indexado de Normas Regulamentadoras (NRs), CLT e Portarias do MTE.
 */

export interface NormativeSection {
  source: string; // Ex: "NR-35"
  section: string; // Ex: "35.5.1"
  title: string; // Ex: "Sistemas de Proteção contra Quedas (SPQ)"
  text: string; // Texto oficial da norma
  revision: string; // Ex: "Portaria MTP nº 4.218/2022"
  keywords: string[]; // Palavras-chave para retrieval
  riskCategory: string; // Ex: "TRABALHO_ALTURA"
}

export const OFFICIAL_NORMATIVE_KB: NormativeSection[] = [
  // NR-35: Trabalho em Altura
  {
    source: "NR-35",
    section: "35.1.2",
    title: "Campo de Aplicação de Trabalho em Altura",
    text: "Considera-se trabalho em altura toda atividade executada acima de 2,00 m (dois metros) do nível inferior, onde haja risco de queda.",
    revision: "Portaria MTP nº 4.218/2022",
    keywords: ["altura", "2 metros", "queda", "telhado", "andaime", "escada", "nivel inferior"],
    riskCategory: "TRABALHO_ALTURA",
  },
  {
    source: "NR-35",
    section: "35.4.1",
    title: "Planejamento e Organização - Análise de Risco (AR)",
    text: "Todo trabalho em altura deve ser planejado, organizado e executado por trabalhador capacitado e autorizado, precedido de Análise de Risco (AR) e emissão de Permissão de Trabalho (PT).",
    revision: "Portaria MTP nº 4.218/2022",
    keywords: [
      "analise de risco",
      "ar",
      "permissao de trabalho",
      "pt",
      "capacitacao",
      "treinamento",
    ],
    riskCategory: "TRABALHO_ALTURA",
  },
  {
    source: "NR-35",
    section: "35.5.1",
    title: "Sistema de Proteção Contra Quedas (SPQ)",
    text: "É obrigatória a utilização de sistema de proteção contra quedas sempre que não for possível evitar o trabalho em altura, composto por ponto de ancoragem, elemento de ligação e cinturão de segurança tipo paraquedista.",
    revision: "Portaria MTP nº 4.218/2022",
    keywords: [
      "spq",
      "ancoragem",
      "linha de vida",
      "cinturao",
      "paraquedista",
      "talabarte",
      "trava-quedas",
    ],
    riskCategory: "TRABALHO_ALTURA",
  },

  // NR-12: Segurança no Trabalho em Máquinas e Equipamentos
  {
    source: "NR-12",
    section: "12.5.1",
    title: "Sistemas de Segurança e Proteção em Máquinas",
    text: "As zonas de perigo das máquinas e equipamentos devem possuir sistemas de segurança caracterizados por proteções fixas, proteções móveis e dispositivos de segurança interligados que impeçam o acesso às zonas perigosas.",
    revision: "Portaria MTE nº 1.419/2024",
    keywords: [
      "maquina",
      "prensa",
      "esteira",
      "guilhotina",
      "polia",
      "engrenagem",
      "prensagem",
      "esmagamento",
      "protecao fixa",
      "intertravamento",
    ],
    riskCategory: "MAQUINAS_EQUIPAMENTOS",
  },
  {
    source: "NR-12",
    section: "12.6.1",
    title: "Dispositivos de Parada de Emergência",
    text: "As máquinas devem ser equipadas com um ou mais dispositivos de parada de emergência, por meio dos quais possam ser evitadas situações de perigo iminentes ou que já estejam em curso.",
    revision: "Portaria MTE nº 1.419/2024",
    keywords: ["parada de emergencia", "botao de emergencia", "desligamento", "bloqueio mecanico"],
    riskCategory: "MAQUINAS_EQUIPAMENTOS",
  },

  // NR-10: Segurança em Instalações e Serviços em Eletricidade
  {
    source: "NR-10",
    section: "10.2.8.2",
    title: "Desenergização Elétrica e Bloqueio (LOTO)",
    text: "As medidas de proteção coletiva compreendem, prioritariamente, a desenergização elétrica e, na sua impossibilidade, o emprego de tensão de segurança, com procedimentos formais de bloqueio e etiquetagem (LOTO).",
    revision: "Portaria SEPRT nº 915/2019",
    keywords: [
      "eletricidade",
      "choque",
      "desenergizacao",
      "painel",
      "alta tensao",
      "baixa tensao",
      "loto",
      "bloqueio",
      "etiquetagem",
      "disjuntor",
    ],
    riskCategory: "RISCO_ELETRICO",
  },
  {
    source: "NR-10",
    section: "10.7.1",
    title: "Trabalhos em Alta Tensão e Proximidades",
    text: "Os trabalhadores que intervenham em instalações elétricas energizadas com alta tensão devem receber treinamento de segurança específico, portar vestimentas resistentes ao arco elétrico (ATP) e autorização formal da empresa.",
    revision: "Portaria SEPRT nº 915/2019",
    keywords: ["arco eletrico", "alta tensao", "subestacao", "atp", "vestimenta", "queimadura"],
    riskCategory: "RISCO_ELETRICO",
  },

  // NR-33: Segurança e Saúde nos Trabalhos em Espaços Confinados
  {
    source: "NR-33",
    section: "33.3.1",
    title: "Permissão de Entrada e Trabalho (PET) em Espaços Confinados",
    text: "É vedada a entrada em espaço confinado sem a prévia emissão da Permissão de Entrada e Trabalho (PET), avaliação atmosférica contínua e presença obrigatória do Vigia.",
    revision: "Portaria MTP nº 1.690/2022",
    keywords: [
      "espaco confinado",
      "tanque",
      "silo",
      "galeria",
      "pet",
      "vigia",
      "asfixia",
      "gas",
      "oxigenio",
      "explosimetro",
    ],
    riskCategory: "ESPACO_CONFINADO",
  },

  // NR-6: Equipamento de Proteção Individual (EPI)
  {
    source: "NR-6",
    section: "6.5.1",
    title: "Obrigações do Empregador e Certificado de Aprovação (CA)",
    text: "A empresa é obrigada a fornecer aos empregados, gratuitamente, EPI adequado ao risco, em perfeito estado de conservação e funcionamento, dotado de Certificado de Aprovação (CA) válido expedido pelo MTE.",
    revision: "Portaria MTP nº 2.175/2022",
    keywords: [
      "epi",
      "ca",
      "certificado de aprovacao",
      "fornecimento",
      "capacete",
      "luva",
      "oculos",
      "protetor auricular",
      "bota",
    ],
    riskCategory: "EPI_PROTECAO",
  },

  // NR-1: Disposições Gerais e Gerenciamento de Riscos Ocupacionais (PGR / GRO)
  {
    source: "NR-1",
    section: "1.5.5.4.1",
    title: "Análise de Acidentes e Incidentes no PGR",
    text: "A organização deve analisar os acidentes e as doenças relacionadas ao trabalho, documentando o processo no PGR com a identificação das causas raízes e revisão do plano de ação.",
    revision: "Portaria SEPRT nº 6.730/2020",
    keywords: [
      "acidente",
      "incidente",
      "causa raiz",
      "plano de acao",
      "pgr",
      "gro",
      "investigacao",
    ],
    riskCategory: "GESTAO_PGR",
  },
];

/**
 * Motor de Recuperação Normativa (RAG Retrieval)
 * Filtra a base normativa oficial buscando termos, categorias de risco e similaridade.
 */
export function retrieveApplicableNorms(
  description: string,
  riskCategories: string[] = []
): NormativeSection[] {
  const normalizedText = description.toLowerCase();
  const matched = new Map<string, { section: NormativeSection; score: number }>();

  for (const item of OFFICIAL_NORMATIVE_KB) {
    let score = 0;

    // 1. Match por Categoria de Risco
    if (riskCategories.includes(item.riskCategory)) {
      score += 10;
    }

    // 2. Match por Palavras-Chave
    for (const kw of item.keywords) {
      if (normalizedText.includes(kw.toLowerCase())) {
        score += 3;
      }
    }

    // 3. Match no Texto ou Título da Norma
    if (normalizedText.includes(item.source.toLowerCase())) {
      score += 5;
    }

    if (score > 0) {
      const key = `${item.source}-${item.section}`;
      matched.set(key, { section: item, score });
    }
  }

  // Ordena por maior relevância e retorna os top 5 itens mais pertinentes
  return Array.from(matched.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.section);
}
