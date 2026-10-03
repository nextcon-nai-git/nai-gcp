export interface ClinicalData {
  phq9?: number[];
  gad7?: number[];
  glicemia_jejum?: number;
  hba1c?: number;
  pas?: number;
  pad?: number;
  mrs_escore?: number;
  asa_score?: number;
  exposicao_72h?: boolean;
  risco_continuo?: boolean;
  peso?: number; // kg
  altura?: number; // metros
  idade?: number;
  sexo?: "M" | "F";
  katz_score?: number;
  fatores_risco_gestacional?: string[];
  idade_gestacional_semanas?: number;
  epds_score?: number;
  percentil_peso?: number;
  das28_score?: number;
}

export interface CareLineResult {
  id: string;
  title: string;
  iconType: string;
  escore: string;
  conduta: string;
}

// 1. Saúde Mental (PHQ-9 e GAD-7)
export function evaluateSaudeMental(dados: ClinicalData): CareLineResult | null {
  if (!dados.phq9 && !dados.gad7) return null;

  const phq9Sum = (dados.phq9 || []).reduce((a, b) => a + b, 0);
  const gad7Sum = (dados.gad7 || []).reduce((a, b) => a + b, 0);

  const conduta: string[] = [];
  if (phq9Sum >= 10)
    conduta.push(`PHQ-9 (${phq9Sum}): Depressão moderada/grave. Considerar TCC/Farmacoterapia.`);
  else conduta.push(`PHQ-9 (${phq9Sum}): Rastreio negativo ou leve para depressão.`);

  if (gad7Sum >= 10) conduta.push(`GAD-7 (${gad7Sum}): Ansiedade moderada/grave. Avaliar TAG.`);
  else conduta.push(`GAD-7 (${gad7Sum}): Rastreio negativo ou leve para ansiedade.`);

  return {
    id: "saude-mental",
    title: "Saúde Mental",
    iconType: "Brain",
    escore: `PHQ-9: ${phq9Sum} | GAD-7: ${gad7Sum}`,
    conduta: conduta.join(" "),
  };
}

// 2. Diabetes Mellitus
export function evaluateDiabetes(dados: ClinicalData): CareLineResult | null {
  if (!dados.glicemia_jejum && !dados.hba1c) return null;
  const glicemia = dados.glicemia_jejum || 90;
  const hba1c = dados.hba1c || 5.0;

  let conduta = "";
  if (glicemia >= 126 || hba1c >= 6.5) {
    conduta = "Diabetes. Iniciar MEV e Metformina. Rastrear pé diabético e retinopatia.";
  } else if ((glicemia >= 100 && glicemia < 126) || (hba1c >= 5.7 && hba1c <= 6.4)) {
    conduta = "Pré-diabetes. Intervenção intensiva em Estilo de Vida (MEV).";
  } else {
    conduta = "Rastreio negativo. Repetir em 3 anos (ou anual se risco).";
  }

  return {
    id: "diabetes",
    title: "Diabetes Mellitus",
    iconType: "Activity",
    escore: `Glicemia: ${glicemia} mg/dL | HbA1c: ${hba1c}%`,
    conduta,
  };
}

// 3. Hipertensão Arterial Sistêmica
export function evaluateHipertensao(dados: ClinicalData): CareLineResult | null {
  if (!dados.pas && !dados.pad) return null;
  const pas = dados.pas || 120;
  const pad = dados.pad || 80;

  let conduta = "";
  if (pas >= 140 || pad >= 90) {
    conduta = "Hipertensão. Iniciar monoterapia (BCC, BRA, IECA). ECG anual.";
  } else if (pas >= 130 || pad >= 85) {
    conduta = "Pré-hipertensão. MEV rigoroso. Retorno 3-6 meses.";
  } else {
    conduta = "PA Normal. Reavaliação anual.";
  }

  return {
    id: "hipertensao",
    title: "Hipertensão",
    iconType: "HeartPulse",
    escore: `${pas}x${pad} mmHg`,
    conduta,
  };
}

// 4. Climatério / Menopausa
export function evaluateClimaterio(dados: ClinicalData): CareLineResult | null {
  if (dados.mrs_escore === undefined) return null;
  const mrs = dados.mrs_escore;

  let conduta = "";
  if (mrs >= 17)
    conduta =
      "Sintomas severos. Avaliar indicação de Terapia Hormonal (TH) se não houver contraindicação.";
  else if (mrs >= 9) conduta = "Sintomas moderados. Manejo sintomático, fitoterápicos ou TH.";
  else conduta = "Sintomas leves. Orientações sobre saúde óssea e cardiovascular.";

  return {
    id: "climaterio",
    title: "Climatério / Menopausa",
    iconType: "Thermometer",
    escore: `MRS: ${mrs}`,
    conduta,
  };
}

// 5. Risco Cirúrgico (ASA)
export function evaluatePrePosOperatorio(dados: ClinicalData): CareLineResult | null {
  if (dados.asa_score === undefined) return null;
  const asa = dados.asa_score;
  const protocolos: Record<number, string> = {
    1: "ASA I: Paciente saudável. Risco cirúrgico normal.",
    2: "ASA II: Doença sistêmica leve (ex: HAS controlada). Proceder com cirurgia.",
    3: "ASA III: Doença sistêmica grave. Necessita otimização pré-operatória.",
    4: "ASA IV: Doença sistêmica grave que ameaça a vida. Alto risco. UTI pós-op provável.",
  };

  return {
    id: "risco-cirurgico",
    title: "Risco Cirúrgico (ASA)",
    iconType: "ClipboardList",
    escore: `ASA ${asa}`,
    conduta: protocolos[asa] || "Avaliação não categorizada.",
  };
}

// 6. Profilaxia HIV (PrEP/PEP)
export function evaluatePrEP_PEP(dados: ClinicalData): CareLineResult | null {
  if (dados.exposicao_72h === undefined && dados.risco_continuo === undefined) return null;

  let escore = "";
  let conduta = "";
  if (dados.exposicao_72h) {
    escore = "Emergência PEP";
    conduta = "PEP (Tenofovir+Lamivudina+Dolutegravir) por 28 dias.";
  } else if (dados.risco_continuo) {
    escore = "Elegível PrEP";
    conduta = "Solicitar TR HIV, Cr, Sífilis. Iniciar PrEP.";
  } else {
    escore = "Baixo Risco";
    conduta = "Aconselhamento padrão e oferta de preservativos.";
  }

  return {
    id: "prep-pep",
    title: "Profilaxia HIV",
    iconType: "ShieldCheck",
    escore,
    conduta,
  };
}

// 7. Obesidade
export function evaluateObesidade(dados: ClinicalData): CareLineResult | null {
  if (!dados.peso || !dados.altura) return null;
  let imc = dados.peso / (dados.altura * dados.altura);
  imc = Math.round(imc * 10) / 10;

  let conduta = "";
  if (imc >= 35) conduta = "Obesidade II/III. Avaliar Cirurgia Bariátrica ou análogos de GLP-1.";
  else if (imc >= 30) conduta = "Obesidade I. Nutrição, MEV e considerar farmacoterapia.";
  else if (imc >= 25) conduta = "Sobrepeso. Prevenção e dieta.";
  else conduta = "Peso Adequado.";

  return {
    id: "obesidade",
    title: "Obesidade",
    iconType: "Scale",
    escore: `IMC ${imc}`,
    conduta,
  };
}

// 8. Rastreamento Oncológico
export function evaluateNeoplasias(dados: ClinicalData): CareLineResult | null {
  if (!dados.idade || !dados.sexo) return null;
  const { idade, sexo } = dados;
  const conduta: string[] = [];

  if (sexo === "F" && idade >= 50 && idade <= 69)
    conduta.push("Mamografia de rastreio bienal (MS).");
  if (sexo === "F" && idade >= 25 && idade <= 64)
    conduta.push("Preventivo (Papanicolaou) a cada 3 anos.");
  if (sexo === "M" && idade >= 50)
    conduta.push("Rastreio de câncer de próstata (Toque/PSA) a discutir.");
  if (idade >= 45) conduta.push("Pesquisa de Sangue Oculto/Colonoscopia (Câncer Colorretal).");

  if (conduta.length === 0)
    conduta.push("Sem indicação de rastreio oncológico para faixa etária no momento.");

  return {
    id: "neoplasias",
    title: "Rastreamento Oncológico",
    iconType: "Search",
    escore: `Idade: ${idade}, Sexo: ${sexo}`,
    conduta: conduta.join(" "),
  };
}

// 9. Saúde do Idoso
export function evaluateEnvelhecimentoAtivo(dados: ClinicalData): CareLineResult | null {
  if (dados.katz_score === undefined) return null;
  const katz = dados.katz_score;

  let conduta = "";
  if (katz === 6) conduta = "Independente. Promover atividade física e socialização.";
  else if (katz >= 3) conduta = "Dependência moderada. Acionar fisioterapia e suporte familiar.";
  else conduta = "Dependência severa. Necessidade de cuidador. Prevenção de úlceras e quedas.";

  return {
    id: "saude-idoso",
    title: "Saúde do Idoso",
    iconType: "UserPlus",
    escore: `Katz: ${katz}/6`,
    conduta,
  };
}

// 10. Gestação de Alto Risco
export function evaluateGestacaoAltoRisco(dados: ClinicalData): CareLineResult | null {
  if (!dados.fatores_risco_gestacional) return null;
  const fatores = dados.fatores_risco_gestacional;

  if (fatores.length > 0) {
    return {
      id: "gestacao-alto-risco",
      title: "Gestação de Alto Risco",
      iconType: "AlertTriangle",
      escore: "Alto Risco",
      conduta: `Encaminhar pré-natal especializado. Fatores: ${fatores.join(", ")}.`,
    };
  }

  return {
    id: "gestacao-alto-risco",
    title: "Gestação de Alto Risco",
    iconType: "Baby",
    escore: "Baixo Risco",
    conduta: "Pré-natal habitual na Atenção Primária.",
  };
}

// 11. Pré-Natal Básico
export function evaluateGestacao(dados: ClinicalData): CareLineResult | null {
  if (dados.idade_gestacional_semanas === undefined) return null;
  const ig = dados.idade_gestacional_semanas;

  let conduta = "";
  if (ig < 14)
    conduta =
      "1º Trimestre: Prescrever Ácido Fólico. Solicitar Sorologias, Tipagem Sanguínea, USG Obstétrica.";
  else if (ig < 28)
    conduta = "2º Trimestre: USG Morfológica. TOTG 75g (rastreio diabetes gestacional).";
  else
    conduta = "3º Trimestre: Repetir sorologias, pesquisa de Estreptococo B, preparar para parto.";

  return {
    id: "pre-natal",
    title: "Pré-Natal Básico",
    iconType: "Baby",
    escore: `IG: ${ig} semanas`,
    conduta,
  };
}

// 12. Puerpério
export function evaluatePuerperio(dados: ClinicalData): CareLineResult | null {
  if (dados.epds_score === undefined) return null;
  const epds = dados.epds_score;

  let conduta = "";
  if (epds >= 12) conduta = "Risco de Depressão Pós-Parto. Intervenção em saúde mental.";
  else
    conduta =
      "Apoio ao aleitamento materno. Avaliação de cicatriz/sangramento. Planejamento familiar.";

  return {
    id: "puerperio",
    title: "Puerpério",
    iconType: "User",
    escore: `EPDS: ${epds}`,
    conduta,
  };
}

// 13. Puericultura
export function evaluatePuericultura(dados: ClinicalData): CareLineResult | null {
  if (dados.percentil_peso === undefined) return null;
  const percentil = dados.percentil_peso;

  let conduta = "";
  if (percentil < 3)
    conduta = "Baixo peso. Investigar causas nutricionais/orgânicas. Revisar PNI (vacinas).";
  else if (percentil > 97)
    conduta = "Risco de obesidade infantil. Educação alimentar. Revisar PNI.";
  else conduta = "Desenvolvimento adequado. Seguir calendário de consultas e vacinação (PNI).";

  return {
    id: "puericultura",
    title: "Puericultura",
    iconType: "Baby",
    escore: `Percentil: ${percentil}`,
    conduta,
  };
}

// 14. Reumatologia
export function evaluateReumatologia(dados: ClinicalData): CareLineResult | null {
  if (dados.das28_score === undefined) return null;
  const das28 = dados.das28_score;

  let conduta = "";
  if (das28 > 5.1) conduta = "Atividade de doença ALTA. Ajustar DMARDs ou iniciar imunobiológico.";
  else if (das28 >= 3.2) conduta = "Atividade MODERADA. Avaliar adesão e ajuste terapêutico.";
  else if (das28 >= 2.6) conduta = "Atividade BAIXA. Manter tratamento.";
  else conduta = "Remissão clínica. Manter monitoramento.";

  return {
    id: "reumatologia",
    title: "Reumatologia",
    iconType: "Bone",
    escore: `DAS28: ${das28}`,
    conduta,
  };
}

export function evaluateAllCareLines(dados: ClinicalData): CareLineResult[] {
  const results = [
    evaluateSaudeMental(dados),
    evaluateDiabetes(dados),
    evaluateHipertensao(dados),
    evaluateClimaterio(dados),
    evaluatePrePosOperatorio(dados),
    evaluatePrEP_PEP(dados),
    evaluateObesidade(dados),
    evaluateNeoplasias(dados),
    evaluateEnvelhecimentoAtivo(dados),
    evaluateGestacaoAltoRisco(dados),
    evaluateGestacao(dados),
    evaluatePuerperio(dados),
    evaluatePuericultura(dados),
    evaluateReumatologia(dados),
  ];

  return results.filter((r): r is CareLineResult => r !== null);
}
