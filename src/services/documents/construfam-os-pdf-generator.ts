import { jsPDF } from "jspdf";
import { WorkOrderConstrufamData, WorkOrderEmployeeInfo } from "@/types/work-order";

/**
 * Cria os dados pré-carregados da Ordem de Serviço NR-01 com base estrita no PGR da CONSTRUFAM
 */
export function getDefaultConstrufamOsData(
  employeeOverrides?: Partial<WorkOrderEmployeeInfo>
): WorkOrderConstrufamData {
  return {
    id: `OS-NR01-CFM-${Date.now().toString().slice(-6)}`,
    numeroControle: `OS-CFM-2026/089`,
    versaoPgr: "PGR Revisão 03 (Vigência 2026-2028)",
    vigenciaPgr: "17/06/2026 a 16/06/2028",
    empresa: {
      razaoSocial: "CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA",
      nomeFantasia: "CONSTRUFAM ENGENHARIA",
      cnpj: "81.707.465/0001-89",
      cnae: "7119-7/01 - Serviços de cartografia, topografia e geodésia",
      grauRisco: 1,
      endereco: "Rua Tenente Djalma Dutra, 915 - Centro",
      cidadeUf: "São José dos Pinhais/PR - CEP: 83.005-360",
      contratante:
        "COMPANHIA HIDRO ELÉTRICA DO SÃO FRANCISCO (CHESF) / STATKRAFT ENERGIAS RENOVÁVEIS S/A",
      unidadeOperacional: "Bacia do Rio Piranhas-Açu / PCH São João / PCH Fruteiras",
    },
    colaborador: {
      nome: employeeOverrides?.nome || "João Carlos da Silva",
      cpf: employeeOverrides?.cpf || "000.000.000-00",
      matricula: employeeOverrides?.matricula || "CFM-0412",
      cargo: employeeOverrides?.cargo || "HIDROMETRISTA",
      setor: "HIDROMETRIA E OPERAÇÕES DE CAMPO",
      ghe: "GES 02 - HIDROMETRIA (TRABALHO EMBARCADO)",
      dataAdmissao: employeeOverrides?.dataAdmissao || "15/01/2024",
      dataEmissaoOs: employeeOverrides?.dataEmissaoOs || new Date().toLocaleDateString("pt-BR"),
      numeroColeteSalvaVidas: employeeOverrides?.numeroColeteSalvaVidas || "CV-NAI-084",
      registroArrais: employeeOverrides?.registroArrais || "381P2021004562 (Capitania dos Portos)",
    },
    descricaoAtividades: [
      "Planejamento, reconhecimento e acesso aos locais de trabalho ao longo da calha de rios e reservatórios de usinas hidrelétricas.",
      "Transporte de barco com motor de popa, baterias e equipamentos para a margem do rio e lançamento seguro da embarcação.",
      "Operação embarcada para medição de vazão e levantamento topohidrográfico/batimétrico com molinete hidrométrico e ADCP acústico.",
      "Instalação e estaiamento de cabo de aço transversal ao leito do rio para sustentação dos equipamentos de medição.",
      "Manutenção preventiva e corretiva de Estações de Coleta de Dados (PCDs), sensores hidrostáticos, réguas linimétricas e painéis solares.",
      "Substituição de baterias e desobstrução de sensores, com escavações manuais pontuais e roçada no entorno das estações.",
      "Coleta de amostras de água e sedimentos fluviais para análise laboratorial e preenchimento de boletins hidrométricos.",
      "Reabastecimento eventual de motor de popa e equipamentos a combustão (gasolina/óleo) e guarda organizada dos materiais.",
    ],
    riscosIdentificados: [
      {
        fatorRisco: "Afogamento (Trabalho Embarcado / Rios)",
        grupo: "Acidente",
        severidade: "Crítica",
        probabilidade: "Pouco Provável",
        nivelRisco: "Risco Alto (PR2)",
        fontes: "Navegação em rios com correnteza, embarque/desembarque e travessias.",
        possiveisDanos: "Asfixia por imersão, parada cardiorrespiratória e óbito.",
        medidasPrevenconais:
          "Uso ininterrupto de Colete Salva-Vidas homologado pela Marinha; embarcação conduzida apenas por Arrais habilitado; inspeção prévia de estanqueidade; suspensão imediata sob chuva intensa ou correnteza atípica.",
      },
      {
        fatorRisco: "Queda em Altura (Superior a 1,80m - NR-35)",
        grupo: "Acidente",
        severidade: "Considerável",
        probabilidade: "Pouco Provável",
        nivelRisco: "Risco Moderado (PR3)",
        fontes: "Manutenção nas colunas superiores de PCDs e estruturas de réguas.",
        possiveisDanos: "Fraturas, traumatismo craniano, politraumatismo.",
        medidasPrevenconais:
          "Uso obrigatório de Cinto Tipo Paraquedista com Talabarte Duplo em Y ancorado em ponto resistente; capacete com jugular; treinamento válido de NR-35.",
      },
      {
        fatorRisco: "Cortes, Lacerações e Rompimento de Cabo (NR-12)",
        grupo: "Acidente",
        severidade: "Considerável",
        probabilidade: "Pouco Provável",
        nivelRisco: "Risco Moderado (PR3)",
        fontes:
          "Tensionamento de cabo de aço transversal ao rio e ferramentas rotativas (roçadeira/esmerilhadeira).",
        possiveisDanos: "Cortes profundos, amputações, contusões por chicoteamento de cabo.",
        medidasPrevenconais:
          "Isolamento da linha de tiro do cabo; uso de luvas de vaqueta/mista; protetor facial e óculos; capacete com jugular; treinamento em NR-12.",
      },
      {
        fatorRisco: "Picada de Animais Peçonhentos (Biológico)",
        grupo: "Biológico",
        severidade: "Mediana",
        probabilidade: "Pouco Provável",
        nivelRisco: "Risco Tolerável (PR4)",
        fontes: "Atividades em matas ciliares, margens de rios e áreas de vegetação densa.",
        possiveisDanos: "Envenenamento, reações anafiláticas, necrose local, infecções.",
        medidasPrevenconais:
          "Uso obrigatório de botinas de segurança com perneiras de couro/segurança; uso de repelente; inspeção visual prévia de troncos e pedras antes do manuseio.",
      },
      {
        fatorRisco: "Intempéries / Radiação Solar e Descargas Atmosféricas",
        grupo: "Físico",
        severidade: "Mediana",
        probabilidade: "Provável",
        nivelRisco: "Risco Tolerável (PR4)",
        fontes: "Trabalho contínuo a céu aberto e exposição solar sobre lâmina d'água.",
        possiveisDanos:
          "Insolação, desidratação, queimaduras de 1º/2º grau, risco fatal por raio em meio aquático.",
        medidasPrevenconais:
          "Protetor solar FPS 50+; vestimenta manga longa com proteção UV; óculos escuros com filtro UV; interrupção obrigatória das atividades fluviais ao primeiro trovão/relâmpago.",
      },
      {
        fatorRisco: "Hidrocarbonetos e Solventes (NR-20)",
        grupo: "Químico",
        severidade: "Mediana",
        probabilidade: "Improvável",
        nivelRisco: "Risco Tolerável (PR4)",
        fontes: "Reabastecimento de motor de popa (gasolina/óleo) e limpeza com acetato de etila.",
        possiveisDanos: "Dermatite de contato, irritação das vias respiratórias e olhos.",
        medidasPrevenconais:
          "Luvas nitrílicas; máscara respiratória PFF2; óculos de segurança; proibição absoluta de fumar ou produzir fagulhas durante o manuseio de combustíveis.",
      },
      {
        fatorRisco: "Levantamento Manual de Cargas Pesadas (> 23 kg)",
        grupo: "Ergonômico",
        severidade: "Mediana",
        probabilidade: "Pouco Provável",
        nivelRisco: "Risco Tolerável (PR4)",
        fontes: "Transporte de motor de popa, baterias de ciclo profundo e barco até a margem.",
        possiveisDanos: "Lombalgia aguda, hérnia de disco, fadiga muscular acentuada.",
        medidasPrevenconais:
          "Movimentação em dupla ou grupo para qualquer peso superior a 23 kg; aproximação da carga ao tronco; cinto ergonômico; pausas ergonômicas.",
      },
    ],
    episObrigatorios: [
      {
        equipamento: "Colete Salva-Vidas Classe V (Homologado Marinha do Brasil / DPC)",
        ca: "Norma DPC / Portaria Marinha",
        obrigatoriedade: "100% do tempo embarcado e em margens de rio",
        finalidade: "Prevenção contra afogamento com flutuação positiva imediata da cabeça.",
      },
      {
        equipamento: "Capacete de Segurança com Jugular de 3 Pontos",
        ca: "CA: 31.469",
        obrigatoriedade: "Embarcação, montagem de cabo e área de PCDs",
        finalidade: "Proteção craniana contra impactos de cabos, hélice, galhos e quedas.",
      },
      {
        equipamento: "Botina de Segurança de Couro com Biqueira e Solado Antiderrapante",
        ca: "CA: 26.511",
        obrigatoriedade: "Trabalhos terrestres e embarque/desembarque",
        finalidade: "Proteção contra quedas de materiais pesados e escorregões em pedras úmidas.",
      },
      {
        equipamento: "Bota de Borracha / PVC de Cano Longo Impermeável",
        ca: "CA: 37.456",
        obrigatoriedade: "Entrada em lâmina d'água e áreas alagadas",
        finalidade: "Proteção dos membros inferiores contra umidade contínua e animais aquáticos.",
      },
      {
        equipamento: "Perneira de Segurança de Raspa / Couro",
        ca: "CA: 14.882",
        obrigatoriedade: "Deslocamentos em matas, margens e áreas com vegetação",
        finalidade: "Proteção contra ataques e picadas de serpentes e insetos peçonhentos.",
      },
      {
        equipamento: "Cinto de Segurança Tipo Paraquedista com Talabarte Duplo em Y",
        ca: "CA: 35.890",
        obrigatoriedade: "Trabalhos em altura superiores a 1,80m (NR-35)",
        finalidade: "Retenção de quedas com absorvedor de energia durante manutenção em PCDs.",
      },
      {
        equipamento: "Óculos de Segurança com Filtro UV (Cinza / Fume / Incolor)",
        ca: "CA: 19.982",
        obrigatoriedade: "Uso permanente em campo e embarcação",
        finalidade: "Proteção contra radiação solar refletida na água e projeção de partículas.",
      },
      {
        equipamento: "Luvas de Proteção Mecânica (Vaqueta) e Luvas Nitrílicas",
        ca: "CA: 25.213 / CA: 38.100",
        obrigatoriedade: "Manejo de cabo de aço e reabastecimento de combustível",
        finalidade: "Proteção contra abrasão de cabos e contato dérmico com hidrocarbonetos.",
      },
      {
        equipamento: "Protetor Solar Facial e Corporal FPS 50+",
        ca: "Anvisa Grau II",
        obrigatoriedade: "Aplicação a cada 3 horas durante jornada a céu aberto",
        finalidade: "Prevenção contra eritemas, queimaduras solares e envelhecimento precoce.",
      },
    ],
    regrasOuroEmbarcado: [
      {
        titulo: "1. COLETE SALVA-VIDAS É INEGOCIÁVEL",
        descricao:
          "Nenhum colaborador tem permissão para adentrar o barco, balsa ou área de atracação sem estar com o colete salva-vidas ajustado, afivelado e com todas as presilhas travadas.",
      },
      {
        titulo: "2. HABILITAÇÃO NÁUTICA OBRIGATÓRIA",
        descricao:
          "A embarcação só pode ser acionada e pilotada por quem possuir Carteira de Arrais-Amador ou credencial marítima emitida pela Autoridade Marítima (Capitania dos Portos).",
      },
      {
        titulo: "3. CHECK-LIST PRÉ-OPERACIONAL DO BARCO",
        descricao:
          "Antes de colocar a embarcação na água, verificar: bujão de escoamento vedado, combustível suficiente (com reserva de 30%), remo de emergência, cabo de amarração, boia circular e âncora.",
      },
      {
        titulo: "4. RESPEITO À CAPACIDADE DE CARGA E PASSAGEIROS",
        descricao:
          "Nunca ultrapassar a lotação máxima estipulada na placa do fabricante e da Capitania. O peso de pessoas e equipamentos deve ser distribuído de forma simétrica no casco.",
      },
      {
        titulo: "5. CLIMA ADVERSO = PARADA IMEDIATA",
        descricao:
          "É terminantemente proibido permanecer na água sob tempestades, relâmpagos, vento forte ou enchentes repentinas. O barco deve ser retirado para margem segura ao menor sinal de trovoada.",
      },
      {
        titulo: "6. LINHA DE TIRO DO CABO DE AÇO TRANSVERSAL",
        descricao:
          "Durante a travessia e tensionamento do cabo de aço no rio, nenhum trabalhador deve posicionar-se sobre a linha de tração. Rádios comunicadores devem ser mantidos ligados.",
      },
    ],
    proibicoesExpressas: [
      "Operar ou permanecer embarcado sem o colete salva-vidas devidamente travado e ajustado ao corpo.",
      "Ingerir bebidas alcoólicas, substâncias psicoativas ou medicamentos que provoquem sonolência antes ou durante o trabalho.",
      "Navegar em velocidade incompatível com a segurança do rio ou realizar manobras bruscas desnecessárias.",
      "Pular na água para nadar, banhar-se ou realizar brincadeiras durante a jornada de trabalho.",
      "Fumar ou utilizar fontes de ignição nas proximidades de tanques de combustível do motor de popa ou gerador.",
      "Realizar manutenção em altura em PCDs sem estar 100% ancorado pelo talabarte do cinto paraquedista.",
      "Deslocar-se na mata ciliar e pedras sem o uso das perneiras de proteção contra animais peçonhentos.",
      "Permanecer com o motor ligado no momento de embarque, desembarque ou resgate de pessoa na água (risco severo da hélice).",
    ],
    procedimentoHomemAoMar: [
      "1. GRITO DE ALERTA: Quem avistar a queda deve bradar em voz alta: 'HOMEM AO MAR POR BOMBORDO / BORESTE!'.",
      "2. PARADA DO MOTOR: O piloto deve desengrenar imediatamente o motor para neutralizar a hélice e evitar cortes no acidentado.",
      "3. LANÇAMENTO DA BOIA: Arremessar de imediato a boia circular ou colete flutuante com cabo próximo à vítima.",
      "4. VIGILÂNCIA VISUAL FIXA: Um tripulante deve manter o dedo apontado e olhar fixo no náufrago sem desviar a atenção.",
      "5. APROXIMAÇÃO SEGURA: Aproximar a embarcação pelo bordo de sotavento (contra a correnteza) em baixíssima rotação.",
      "6. RESGATE E EMBARQUE: Recolher a vítima com o motor desligado, verificar sinais vitais e iniciar primeiro socorro/aquecimento.",
    ],
    direitosDeveresClt: {
      artigo157:
        "Cabe ao empregador cumprir e fazer cumprir as normas de segurança e medicina do trabalho, instruindo os empregados quanto às precauções a tomar.",
      artigo158:
        "Constitui ato faltoso do empregado a recusa injustificada: a) à observância das instruções expedidas pelo empregador através de Ordem de Serviço; b) ao uso dos equipamentos de proteção individual fornecidos pela empresa (passível de demissão por justa causa).",
      item141Nr01:
        "Cabe ao empregado cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho, inclusive as ordens de serviço expedidas pelo empregador.",
      item143DireitoRecusa:
        "O trabalhador poderá interromper suas atividades e exercer o DIREITO DE RECUSA sempre que constatar uma situação de trabalho que envolva risco grave e iminente para sua vida ou saúde (ex: colete danificado, motor de popa falhando na correnteza, início de tempestade de raios).",
    },
    responsavelSst: {
      nome: "Pablo Ricardo Ribeiro de Macedo Nogueira",
      cargo: "Engenheiro de Segurança do Trabalho",
      registroProfissional: "CREA/PR 124.982/D",
    },
  };
}

/**
 * Motor de renderização de PDF oficial A4 via jsPDF
 */
export function generateConstrufamOsPdf(data: WorkOrderConstrufamData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const printableWidth = pageWidth - marginX * 2; // 182mm
  let cursorY = 16;

  // Helper para verificar quebra de página
  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight > pageHeight - 18) {
      doc.addPage();
      cursorY = 18;
      renderRunningHeader();
    }
  };

  // Cabeçalho institucional nas páginas subsequentes
  const renderRunningHeader = () => {
    doc.setFillColor(0, 31, 63); // #001F3F
    doc.rect(marginX, 10, printableWidth, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(
      "CONSTRUFAM ENGENHARIA LTDA | ORDEM DE SERVIÇO NR-01 - TRABALHO EMBARCADO",
      marginX + 3,
      13.5
    );
    doc.setTextColor(0, 0, 0);
  };

  // ==========================================
  // PÁGINA 1: CABEÇALHO & DADOS CADASTRAIS
  // ==========================================

  // Barra Superior Principal
  doc.setFillColor(0, 31, 63);
  doc.rect(marginX, cursorY, printableWidth, 14, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    "ORDEM DE SERVIÇO DE SEGURANÇA E SAÚDE NO TRABALHO",
    marginX + printableWidth / 2,
    cursorY + 5.5,
    { align: "center" }
  );
  doc.setFontSize(8.5);
  doc.setTextColor(251, 191, 36); // Amber
  doc.text(
    "NR-01 (ITEM 1.4.1) | ART. 157 DA CLT | DIRETRIZES DE TRABALHO EMBARCADO (PGR CHESF/STATKRAFT)",
    marginX + printableWidth / 2,
    cursorY + 10.5,
    { align: "center" }
  );

  cursorY += 17;

  // Bloco de Identificação da Empresa
  doc.setDrawColor(200, 205, 215);
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, cursorY, printableWidth, 23, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 31, 63);
  doc.text("1. IDENTIFICAÇÃO DO EMPREGADOR / CONTRATANTE", marginX + 3, cursorY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Razão Social: ${data.empresa.razaoSocial}`, marginX + 3, cursorY + 9);
  doc.text(
    `CNPJ: ${data.empresa.cnpj} | CNAE: ${data.empresa.cnae} | Grau de Risco: ${data.empresa.grauRisco}`,
    marginX + 3,
    cursorY + 13
  );
  doc.text(
    `Endereço Sede: ${data.empresa.endereco} - ${data.empresa.cidadeUf}`,
    marginX + 3,
    cursorY + 17
  );
  doc.text(`Contratante / Operação: ${data.empresa.contratante}`, marginX + 3, cursorY + 21);

  cursorY += 25;

  // Bloco de Identificação do Colaborador
  doc.setFillColor(240, 249, 255);
  doc.rect(marginX, cursorY, printableWidth, 26, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199);
  doc.text("2. DADOS DO COLABORADOR & ATRIBUIÇÃO OPERACIONAL", marginX + 3, cursorY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Nome Completo: ${data.colaborador.nome}`, marginX + 3, cursorY + 9.5);
  doc.text(`CPF: ${data.colaborador.cpf}`, marginX + 115, cursorY + 9.5);
  doc.text(`Cargo / Função: ${data.colaborador.cargo}`, marginX + 3, cursorY + 14);
  doc.text(`Matrícula: ${data.colaborador.matricula || "N/A"}`, marginX + 115, cursorY + 14);
  doc.text(`Setor / GHE: ${data.colaborador.ghe}`, marginX + 3, cursorY + 18.5);
  doc.text(`Data Admissão: ${data.colaborador.dataAdmissao}`, marginX + 115, cursorY + 18.5);
  doc.text(
    `Nº Colete Salva-Vidas: ${data.colaborador.numeroColeteSalvaVidas || "Designado a bordo"}`,
    marginX + 3,
    cursorY + 23
  );
  doc.text(
    `Reg. Arrais / Habilitação: ${data.colaborador.registroArrais || "Não aplicável (Tripulante)"}`,
    marginX + 115,
    cursorY + 23
  );

  cursorY += 28;

  // Bloco 3: Descrição das Atividades Operacionais
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 31, 63);
  doc.text("3. DESCRIÇÃO DAS ATIVIDADES OPERACIONAIS E TRABALHO EMBARCADO", marginX, cursorY);
  cursorY += 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  data.descricaoAtividades.forEach((item) => {
    ensureSpace(6);
    const splitLines = doc.splitTextToSize(`• ${item}`, printableWidth - 4);
    doc.text(splitLines, marginX + 2, cursorY);
    cursorY += splitLines.length * 3.3 + 1;
  });

  cursorY += 2;

  // Bloco 4: Matriz de Riscos Ocupacionais (PGR)
  ensureSpace(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 31, 63);
  doc.text("4. IDENTIFICAÇÃO DE PERIGOS E MATRIZ DE RISCOS (PGR REVISÃO 03)", marginX, cursorY);
  cursorY += 3;

  data.riscosIdentificados.forEach((risco) => {
    ensureSpace(16);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(
      risco.grupo === "Acidente" ? 254 : 255,
      risco.grupo === "Acidente" ? 242 : 255,
      risco.grupo === "Acidente" ? 242 : 255
    );
    doc.rect(marginX, cursorY, printableWidth, 14, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(
      risco.grupo === "Acidente" ? 185 : 30,
      risco.grupo === "Acidente" ? 28 : 58,
      risco.grupo === "Acidente" ? 28 : 138
    );
    doc.text(`[${risco.grupo.toUpperCase()}] ${risco.fatorRisco}`, marginX + 2, cursorY + 3.8);

    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Classificação PGR: ${risco.nivelRisco} (Severidade: ${risco.severidade} | Probabilidade: ${risco.probabilidade})`,
      marginX + 105,
      cursorY + 3.8
    );

    doc.setFont("helvetica", "normal");
    doc.text(`Fontes / Causas: ${risco.fontes}`, marginX + 2, cursorY + 7.2);
    doc.text(`Danos à Saúde: ${risco.possiveisDanos}`, marginX + 2, cursorY + 10.2);

    const splitPrev = doc.splitTextToSize(
      `Medidas Preventivas: ${risco.medidasPrevenconais}`,
      printableWidth - 4
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(splitPrev, marginX + 2, cursorY + 13.2);

    cursorY += 15.5;
  });

  cursorY += 2;

  // ==========================================
  // PÁGINA 2: EPIs, REGRAS DE OURO E HOMEM AO MAR
  // ==========================================
  ensureSpace(45);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 31, 63);
  doc.text(
    "5. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs) & SALVATAGEM OBRIGATÓRIOS",
    marginX,
    cursorY
  );
  cursorY += 3;

  data.episObrigatorios.forEach((epi) => {
    ensureSpace(7.5);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, cursorY, printableWidth, 6.8, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0, 31, 63);
    doc.text(`• ${epi.equipamento}`, marginX + 2, cursorY + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`C.A.: ${epi.ca}`, marginX + 115, cursorY + 3);
    doc.text(`Uso: ${epi.obrigatoriedade}`, marginX + 2, cursorY + 5.8);

    cursorY += 7.8;
  });

  cursorY += 3;

  // REGRAS DE OURO DO TRABALHO EMBARCADO
  ensureSpace(35);
  doc.setFillColor(254, 243, 199); // Amber soft
  doc.rect(marginX, cursorY, printableWidth, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9);
  doc.text("6. REGRAS DE OURO DA CONSTRUFAM PARA TRABALHO EMBARCADO", marginX + 3, cursorY + 4.2);
  cursorY += 8;

  data.regrasOuroEmbarcado.forEach((regra) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(0, 31, 63);
    doc.text(regra.titulo, marginX + 2, cursorY);
    cursorY += 3.2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    const splitRegra = doc.splitTextToSize(regra.descricao, printableWidth - 4);
    doc.text(splitRegra, marginX + 2, cursorY);
    cursorY += splitRegra.length * 3 + 1.5;
  });

  cursorY += 2;

  // PROIBIÇÕES EXPRESSAS
  ensureSpace(28);
  doc.setFillColor(254, 226, 226); // Red soft
  doc.rect(marginX, cursorY, printableWidth, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(185, 28, 28);
  doc.text("7. PROIBIÇÕES EXPRESSAS (ATOS INSEGUROS GRAVES)", marginX + 3, cursorY + 4.2);
  cursorY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(153, 27, 27);
  data.proibicoesExpressas.forEach((proib) => {
    ensureSpace(5);
    const splitProib = doc.splitTextToSize(`[ X ] ${proib}`, printableWidth - 4);
    doc.text(splitProib, marginX + 2, cursorY);
    cursorY += splitProib.length * 3 + 1;
  });

  cursorY += 3;

  // PROCEDIMENTO HOMEM AO MAR
  ensureSpace(30);
  doc.setFillColor(224, 242, 254); // Sky soft
  doc.rect(marginX, cursorY, printableWidth, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(3, 105, 161);
  doc.text(
    "8. PROCEDIMENTO DE EMERGÊNCIA — HOMEM AO MAR (NORMAM / NR-01)",
    marginX + 3,
    cursorY + 4.2
  );
  cursorY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(12, 74, 110);
  data.procedimentoHomemAoMar.forEach((passo) => {
    ensureSpace(5);
    const splitPasso = doc.splitTextToSize(passo, printableWidth - 4);
    doc.text(splitPasso, marginX + 2, cursorY);
    cursorY += splitPasso.length * 3 + 1;
  });

  cursorY += 4;

  // ==========================================
  // DISPOSIÇÕES CLT & TERMO DE ASSINATURA
  // ==========================================
  ensureSpace(55);

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, cursorY, printableWidth, 20, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 31, 63);
  doc.text(
    "9. DISPOSIÇÕES LEGAIS (CLT ARTIGOS 157 E 158 / NR-01 SUBITEM 1.4.3 - DIREITO DE RECUSA)",
    marginX + 3,
    cursorY + 4.2
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(71, 85, 105);
  const textArt158 = doc.splitTextToSize(
    `• ${data.direitosDeveresClt.artigo158}`,
    printableWidth - 6
  );
  doc.text(textArt158, marginX + 3, cursorY + 8);
  const textRecusa = doc.splitTextToSize(
    `• ${data.direitosDeveresClt.item143DireitoRecusa}`,
    printableWidth - 6
  );
  doc.text(textRecusa, marginX + 3, cursorY + 14);

  cursorY += 24;

  // DECLARAÇÃO E ASSINATURAS
  ensureSpace(38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("TERMO DE CIÊNCIA E COMPROMISSO DO COLABORADOR:", marginX, cursorY);
  cursorY += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const termoTexto = `Declaro que recebi da CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA a presente Ordem de Serviço de NR-01 referente às atividades operacionais e embarcadas da bacia hidrográfica/usina hidrelétrica, tendo sido plenamente orientado(a) e treinado(a) quanto aos riscos de afogamento, queda e acidentes, medidas preventivas e uso obrigatório de EPIs (especialmente colete salva-vidas). Comprometo-me a cumprir fielmente estas instruções sob as penas do Art. 158 da CLT.`;
  const splitTermo = doc.splitTextToSize(termoTexto, printableWidth);
  doc.text(splitTermo, marginX, cursorY);
  cursorY += splitTermo.length * 3 + 7;

  // Linhas de Assinatura
  const colW = printableWidth / 2 - 5;

  // Assinatura Colaborador
  doc.setDrawColor(100, 116, 139);
  doc.line(marginX, cursorY + 8, marginX + colW, cursorY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.colaborador.nome, marginX + colW / 2, cursorY + 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    `CPF: ${data.colaborador.cpf} | ${data.colaborador.cargo}`,
    marginX + colW / 2,
    cursorY + 15,
    { align: "center" }
  );
  doc.text(`Data: _____/_____/2026`, marginX + colW / 2, cursorY + 18, { align: "center" });

  // Assinatura Responsável SST
  const col2X = marginX + colW + 10;
  doc.line(col2X, cursorY + 8, col2X + colW, cursorY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(data.responsavelSst.nome, col2X + colW / 2, cursorY + 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    `${data.responsavelSst.cargo} - ${data.responsavelSst.registroProfissional}`,
    col2X + colW / 2,
    cursorY + 15,
    { align: "center" }
  );
  doc.text(`CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA`, col2X + colW / 2, cursorY + 18, {
    align: "center",
  });

  // ==========================================
  // RODAPÉ E NUMERAÇÃO DE TODAS AS PÁGINAS
  // ==========================================
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Nextcon NAI Intelligence © 2026 | Construfam Engenharia Ltda (CNPJ: ${data.empresa.cnpj}) | Controle: ${data.numeroControle}`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: "right",
    });
  }

  return doc;
}

/**
 * Dispara o download imediato do arquivo PDF no navegador
 */
export function downloadConstrufamOsPdf(data: WorkOrderConstrufamData): void {
  const doc = generateConstrufamOsPdf(data);
  const cleanName = data.colaborador.nome.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `OS_NR01_CONSTRUFAM_EMBARCADO_${cleanName}.pdf`;
  doc.save(fileName);
}

/**
 * Gera mensagem formatada para envio da via digital por WhatsApp
 */
export function getWhatsAppOsDispatchMessage(data: WorkOrderConstrufamData): string {
  return encodeURIComponent(
    `*CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA*
*ORDEM DE SERVIÇO DE SST — NR-01 (ITEM 1.4.1)*

Prezado(a) *${data.colaborador.nome}* (${data.colaborador.cargo}),

Conforme os Artigos 157 e 158 da CLT e a Norma Regulamentadora NR-01, comunicamos a emissão da sua *Ordem de Serviço de Trabalho Embarcado e Hidrometria* (PGR CHESF / STATKRAFT).

⚠️ *REGRAS CRÍTICAS DE SEGURANÇA:*
1. *Colete Salva-Vidas (Classe V/Marinha):* Uso 100% obrigatório a bordo do barco e nas margens de rio.
2. *Habilitação Náutica:* Embarcação conduzida exclusivamente por profissional com Carteira de Arrais-Amador.
3. *Intempéries:* Parada imediata das atividades na água ao menor sinal de chuva forte, vento ou descargas atmosféricas.
4. *EPIs em Campo:* Botina com perneira (animais peçonhentos), óculos UV, protetor solar e capacete com jugular.

📄 A via oficial em PDF completa com as diretrizes e termo de ciência foi emitida e registrada no sistema NAI Intelligence sob o número *${data.numeroControle}*.`
  );
}
