/**
 * CASSI Portal Automation & TISS Billing Engine
 * Baseado no Manual de Digitação de Guias no Portal CASSI - Gerência de Contas Médicas (GCM)
 */

export interface CassiProcedureItem {
  id: string;
  code: string;
  description: string;
  isPackage: boolean;
  date: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  reductionFactor?: number;
  participationDegree?: string;
  doctorName?: string;
  doctorCouncil?: string;
  doctorCbo?: string;
}

export interface CassiExpenseItem {
  id: string;
  expenseType: string;
  expenseTerm: string;
  tableCode: string;
  quantity: number;
  unitOfMeasure: string;
  unitValue: number;
  totalValue: number;
  anvisaRegister?: string;
  manufacturerRef?: string;
}

export interface CassiAttachmentItem {
  id: string;
  docType: "Laudo Médico" | "Nota Fiscal" | "Relatório de Atividades" | "Prescrição" | "Outro";
  fileName: string;
  fileSize: string;
  description: string;
  fileUrl?: string;
}

export interface CassiGuideData {
  id: string;
  guideType: "SP_SADT" | "INTERNACAO" | "HONORARIOS";
  authorizationNumber: string;
  authorizationDate?: string;
  passwordValidity?: string;
  providerGuideNumber: string;
  mainGuideNumber?: string;
  internmentGuideNumber?: string;

  // Beneficiário
  beneficiaryCardNumber: string;
  beneficiaryCardValidity: string;
  beneficiaryName: string;
  beneficiaryCns: string;
  isNewbornCare: boolean;

  // Contratado Executante
  operatorCode: string; // CNPJ ou Código na Operadora (34665-9 é Registro ANS CASSI)
  cnesCode: string;
  contractedName: string;

  // Atendimento
  attendanceType: string; // Ex: "01 - Consulta", "04 - Exames", "07 - Pequena Cirurgia"
  accidentIndication: string; // "0 - Não acidente", "1 - Trabalho", "2 - Trânsito"
  consultationType: string; // "1 - Primeira Consulta", "2 - Retorno", "3 - Pré-Natal"
  careCharacter: "1" | "2"; // 1 - Eletivo, 2 - Urgência/Emergência
  attendanceEndReason: string;

  // Solicitante / Executante
  requesterName: string;
  requesterCouncilType: string; // CRM, CREFITO, CRP, COREN
  requesterCouncilNumber: string;
  requesterCouncilUf: string;
  requesterCbo: string;

  // Diagnósticos (CID-10)
  primaryCid: string;
  secondaryCid?: string;
  thirdCid?: string;
  fourthCid?: string;

  // Procedimentos e Despesas
  procedures: CassiProcedureItem[];
  otherExpenses: CassiExpenseItem[];
  attachments: CassiAttachmentItem[];

  // Metadados
  status: "PENDENTE_DIGITACAO" | "PENDENTE_TRANSMISSAO" | "TRANSMITIDO" | "GLOSADO";
  createdAt: string;
  transmissionDeadline?: string; // 10 dias corridos
  totalGuideValue: number;
}

export const CASSI_COMMON_PROCEDURES = [
  {
    code: "10101012",
    description: "Consulta em consultório (no horário normal ou preestabelecido)",
    defaultPrice: 120.0,
  },
  {
    code: "10101020",
    description: "Consulta em pronto-socorro / atendimento imediato",
    defaultPrice: 150.0,
  },
  {
    code: "20103476",
    description: "Atendimento fisioterapêutico nas disfunções osteomioarticulares",
    defaultPrice: 85.0,
  },
  {
    code: "20103484",
    description: "Atendimento fisioterapêutico nas alterações respiratórias",
    defaultPrice: 85.0,
  },
  {
    code: "20103492",
    description: "Atendimento fisioterapêutico com reeducação postural e biomecânica",
    defaultPrice: 110.0,
  },
  {
    code: "20104197",
    description: "Sessão de psicoterapia individual / consulta psicológica",
    defaultPrice: 130.0,
  },
  {
    code: "20104200",
    description: "Avaliação psicológica e perfil comportamental ocupacional",
    defaultPrice: 200.0,
  },
  {
    code: "40301633",
    description: "Hemograma completo com contagem de plaquetas",
    defaultPrice: 25.0,
  },
  { code: "40302044", description: "Glicemia de jejum", defaultPrice: 12.0 },
  {
    code: "40302192",
    description: "Perfil lipídico (Colesterol Total, HDL, LDL, Triglicerídeos)",
    defaultPrice: 48.0,
  },
  {
    code: "40101010",
    description: "ECG convencional de 12 derivações com laudo",
    defaultPrice: 45.0,
  },
  { code: "40808033", description: "Radiografia de tórax (PA e Perfil)", defaultPrice: 70.0 },
  {
    code: "40808122",
    description: "Espirometria / Prova de função pulmonar completa",
    defaultPrice: 110.0,
  },
  {
    code: "40103137",
    description: "Audiometria tonal limiar e vocal com laudo",
    defaultPrice: 60.0,
  },
  {
    code: "40103234",
    description: "Acuidade visual / Teste de visão ocupacional",
    defaultPrice: 35.0,
  },
];

/**
 * Gera um Bookmarklet / Script de Automação (RPA) JavaScript para ser colado
 * no console do Portal CASSI ou executado via Tampermonkey/Bookmarklet.
 */
export function generateCassiRpaScript(guide: CassiGuideData): string {
  const guideJson = JSON.stringify(guide, null, 2);

  return `/**
 * AUTOMATIZADOR DE DIGITAÇÃO NO PORTAL CASSI - NEXTCON NAI
 * Executar no console (F12) da aba do Portal CASSI logado em "Gestão de Documentos Eletrônicos"
 */
(function() {
  let preenchidos=0;

  const guideData = ${guideJson};

  function setFieldValue(selectorOrName, value) {
    if (value === undefined || value === null) return false;
    let el = document.querySelector(selectorOrName) || 
             document.querySelector('[name="' + selectorOrName + '"]') ||
             document.querySelector('[id*="' + selectorOrName + '"]');
    if (el) {
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      preenchidos++;
      return true;
    }
    return false;
  }

  function setSelectOption(selectorOrName, valueTextOrVal) {
    let el = document.querySelector(selectorOrName) || 
             document.querySelector('[name="' + selectorOrName + '"]') ||
             document.querySelector('[id*="' + selectorOrName + '"]');
    if (el && el.tagName === 'SELECT') {
      for (let opt of el.options) {
        if (opt.value === valueTextOrVal || opt.text.includes(valueTextOrVal)) {
          el.value = opt.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          console.debug("[NAI RPA] Opção selecionada", { selector: selectorOrName });
          return true;
        }
      }
    }
    return false;
  }

  // 1. Identificar se estamos na tela de Seleção de Tipo de Guia
  if (document.body.innerText.includes("Formulário para Seleção do Tipo de Guia") || document.querySelector('[name*="tipoGuia"]')) {
    setFieldValue("numeroAutorizacao", guideData.authorizationNumber);
    setSelectOption("tipoGuia", guideData.guideType === "SP_SADT" ? "SP/SADT" : guideData.guideType === "INTERNACAO" ? "Internação" : "Honorários");
    console.debug("[NAI RPA] Guia inicializada");
    return;
  }

  // 2. Preenchimento de Dados Gerais da Guia SP/SADT / Internação
  // Dados da Guia
  setFieldValue("numeroGuiaPrestador", guideData.providerGuideNumber);
  setFieldValue("numeroAutorizacao", guideData.authorizationNumber);
  if (guideData.passwordValidity) setFieldValue("validadeSenha", guideData.passwordValidity);
  if (guideData.authorizationDate) setFieldValue("dataAutorizacao", guideData.authorizationDate);

  // Beneficiário
  setFieldValue("numeroCarteira", guideData.beneficiaryCardNumber);
  setFieldValue("validadeCarteira", guideData.beneficiaryCardValidity);
  setFieldValue("nomeBeneficiario", guideData.beneficiaryName);
  setFieldValue("cartaoNacionalSaude", guideData.beneficiaryCns);
  
  // Contratado Executante
  setFieldValue("codigoOperadora", guideData.operatorCode);
  setFieldValue("codigoCnes", guideData.cnesCode);
  setFieldValue("nomeContratado", guideData.contractedName);

  // Atendimento
  setSelectOption("caraterAtendimento", guideData.careCharacter === "1" ? "Eletivo" : "Urgência");
  setSelectOption("tipoAtendimento", guideData.attendanceType);
  setSelectOption("tipoConsulta", guideData.consultationType);
  setSelectOption("indicacaoAcidente", guideData.accidentIndication);

  // Solicitante / Executante
  setFieldValue("nomeProfissional", guideData.requesterName);
  setFieldValue("numeroConselho", guideData.requesterCouncilNumber);
  setSelectOption("conselhoProfissional", guideData.requesterCouncilType);
  setSelectOption("ufConselho", guideData.requesterCouncilUf);
  setFieldValue("codigoCbo", guideData.requesterCbo);

  // Diagnósticos
  setFieldValue("diagnosticoPrincipal", guideData.primaryCid);
  if (guideData.secondaryCid) setFieldValue("diagnosticoSecundario", guideData.secondaryCid);

  alert("Campos preenchidos: " + preenchidos + ". Confira os dados no portal antes de prosseguir.");
})();`;
}
