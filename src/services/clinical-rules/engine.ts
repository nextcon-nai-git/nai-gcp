export type DadosPaciente = Record<string, any>;

export interface ResultadoLinha {
  escore: string;
  conduta: string;
}

const incomplete = (): ResultadoLinha => ({
  escore: "Não avaliado",
  conduta:
    "Dados ausentes ou inválidos. Preencha informações reais e encaminhe para avaliação do profissional habilitado.",
});
const numeric = (value: unknown, min = 0, max = Infinity): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const answers = (value: unknown, size: number) =>
  Array.isArray(value) &&
  value.length === size &&
  value.every((item) => Number.isInteger(item) && numeric(item, 0, 3));

export abstract class LinhaDeCuidado {
  nome: string;
  constructor(nome: string) {
    this.nome = nome;
  }
  abstract avaliar(dados: DadosPaciente): ResultadoLinha;
}

export class SaudeMental extends LinhaDeCuidado {
  constructor() {
    super("Saúde Mental (PHQ-9 e GAD-7)");
  }
  avaliar(dados: DadosPaciente) {
    if (!answers(dados.phq9, 9) || !answers(dados.gad7, 7)) return incomplete();
    const phq9 = dados.phq9.reduce((a: number, b: number) => a + b, 0);
    const gad7 = dados.gad7.reduce((a: number, b: number) => a + b, 0);

    const conduta = [];
    if (phq9 >= 10)
      conduta.push(`PHQ-9 (${phq9}): Depressão moderada/grave. Considerar TCC/Farmacoterapia.`);
    else conduta.push(`PHQ-9 (${phq9}): Rastreio negativo ou leve para depressão.`);

    if (gad7 >= 10) conduta.push(`GAD-7 (${gad7}): Ansiedade moderada/grave. Avaliar TAG.`);
    else conduta.push(`GAD-7 (${gad7}): Rastreio negativo ou leve para ansiedade.`);

    return { escore: `PHQ-9: ${phq9} | GAD-7: ${gad7}`, conduta: conduta.join(" ") };
  }
}

export class Diabetes extends LinhaDeCuidado {
  constructor() {
    super("Diabetes Mellitus");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.glicemia_jejum, Number.MIN_VALUE) || !numeric(dados.hba1c, Number.MIN_VALUE))
      return incomplete();
    const glicemia = dados.glicemia_jejum;
    const hba1c = dados.hba1c;
    let conduta = "";

    if (glicemia >= 126 || hba1c >= 6.5)
      conduta = "Diabetes. Iniciar MEV e Metformina. Rastrear pé diabético e retinopatia.";
    else if ((glicemia >= 100 && glicemia < 126) || (hba1c >= 5.7 && hba1c <= 6.4))
      conduta = "Pré-diabetes. Intervenção intensiva em Estilo de Vida (MEV).";
    else conduta = "Rastreio negativo. Repetir em 3 anos (ou anual se risco).";

    return { escore: `Glicemia: ${glicemia} mg/dL | HbA1c: ${hba1c}%`, conduta };
  }
}

export class Hipertensao extends LinhaDeCuidado {
  constructor() {
    super("Hipertensão Arterial Sistêmica");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.pas, Number.MIN_VALUE) || !numeric(dados.pad, Number.MIN_VALUE))
      return incomplete();
    const pas = dados.pas;
    const pad = dados.pad;
    let conduta = "";

    if (pas >= 140 || pad >= 90)
      conduta = "Hipertensão. Iniciar monoterapia (BCC, BRA, IECA). ECG anual.";
    else if (pas >= 130 || pad >= 85) conduta = "Pré-hipertensão. MEV rigoroso. Retorno 3-6 meses.";
    else conduta = "PA Normal. Reavaliação anual.";

    return { escore: `${pas}x${pad} mmHg`, conduta };
  }
}

export class Obesidade extends LinhaDeCuidado {
  constructor() {
    super("Obesidade");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.peso, Number.MIN_VALUE) || !numeric(dados.altura, Number.MIN_VALUE))
      return incomplete();
    let imc = dados.peso / Math.pow(dados.altura, 2);
    imc = Math.round(imc * 10) / 10;
    let conduta = "";

    if (imc >= 35) conduta = "Obesidade II/III. Avaliar Cirurgia Bariátrica ou análogos de GLP-1.";
    else if (imc >= 30) conduta = "Obesidade I. Nutrição, MEV e considerar farmacoterapia.";
    else if (imc >= 25) conduta = "Sobrepeso. Prevenção e dieta.";
    else conduta = "Peso Adequado.";

    return { escore: `IMC ${imc}`, conduta };
  }
}

export class Neoplasias extends LinhaDeCuidado {
  constructor() {
    super("Rastreamento Oncológico");
  }
  avaliar(dados: DadosPaciente) {
    if (
      !Number.isInteger(dados.idade) ||
      !numeric(dados.idade, 0, 130) ||
      !["F", "M"].includes(dados.sexo)
    )
      return incomplete();
    const idade = dados.idade;
    const sexo = dados.sexo;
    const conduta = [];

    if (sexo === "F" && idade >= 50 && idade <= 69)
      conduta.push("Mamografia de rastreio bienal (MS).");
    if (sexo === "F" && idade >= 25 && idade <= 64)
      conduta.push("Preventivo (Papanicolaou) a cada 3 anos.");
    if (sexo === "M" && idade >= 50)
      conduta.push("Rastreio de câncer de próstata (Toque/PSA) a discutir.");
    if (idade >= 45) conduta.push("Pesquisa de Sangue Oculto/Colonoscopia (Câncer Colorretal).");

    if (conduta.length === 0)
      conduta.push("Sem indicação de rastreio oncológico para faixa etária no momento.");

    return { escore: `Idade: ${idade}, Sexo: ${sexo}`, conduta: conduta.join(" ") };
  }
}

export class EnvelhecimentoAtivo extends LinhaDeCuidado {
  constructor() {
    super("Saúde do Idoso");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.katz_score, 0, 6) || !Number.isInteger(dados.katz_score))
      return incomplete();
    const katz = dados.katz_score;
    let conduta = "";

    if (katz === 6) conduta = "Independente. Promover atividade física e socialização.";
    else if (katz >= 3) conduta = "Dependência moderada. Acionar fisioterapia e suporte familiar.";
    else conduta = "Dependência severa. Necessidade de cuidador. Prevenção de úlceras e quedas.";

    return { escore: `Katz: ${katz}/6`, conduta };
  }
}

export class GestacaoAltoRisco extends LinhaDeCuidado {
  constructor() {
    super("Gestação de Alto Risco");
  }
  avaliar(dados: DadosPaciente) {
    if (
      !Array.isArray(dados.fatores_risco_gestacional) ||
      !dados.fatores_risco_gestacional.every(
        (value: unknown) => typeof value === "string" && value.trim()
      )
    )
      return incomplete();
    const fatores = dados.fatores_risco_gestacional;
    if (fatores.length > 0)
      return {
        escore: "Alto Risco",
        conduta: `Encaminhar pré-natal especializado. Fatores: ${fatores.join(", ")}.`,
      };
    return { escore: "Baixo Risco", conduta: "Pré-natal habitual na Atenção Primária." };
  }
}

export class Gestacao extends LinhaDeCuidado {
  constructor() {
    super("Pré-Natal Básico");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.idade_gestacional_semanas, Number.MIN_VALUE, 45)) return incomplete();
    const ig = dados.idade_gestacional_semanas;
    let conduta = "";

    if (ig < 14)
      conduta =
        "1º Trimestre: Prescrever Ácido Fólico. Solicitar Sorologias, Tipagem Sanguínea, USG Obstétrica.";
    else if (ig < 28)
      conduta = "2º Trimestre: USG Morfológica. TOTG 75g (rastreio diabetes gestacional).";
    else
      conduta =
        "3º Trimestre: Repetir sorologias, pesquisa de Estreptococo B, preparar para parto.";

    return { escore: `IG: ${ig} semanas`, conduta };
  }
}

export class Reumatologia extends LinhaDeCuidado {
  constructor() {
    super("Reumatologia (Ex: Artrite Reumatoide)");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.das28_score)) return incomplete();
    const das28 = dados.das28_score;
    let conduta = "";
    if (das28 > 5.1)
      conduta = "Atividade de doença ALTA. Ajustar DMARDs ou iniciar imunobiológico.";
    else if (das28 >= 3.2) conduta = "Atividade MODERADA. Avaliar adesão e ajuste terapêutico.";
    else if (das28 >= 2.6) conduta = "Atividade BAIXA. Manter tratamento.";
    else conduta = "Remissão clínica. Manter monitoramento.";
    return { escore: `DAS28: ${das28}`, conduta };
  }
}

export class PrePosOperatorio extends LinhaDeCuidado {
  constructor() {
    super("Risco Cirúrgico (ASA)");
  }
  avaliar(dados: DadosPaciente) {
    if (!Number.isInteger(dados.asa_score) || !numeric(dados.asa_score, 1, 6)) return incomplete();
    const asa = dados.asa_score;
    const protocolos: Record<number, string> = {
      1: "ASA I: Paciente saudável. Risco cirúrgico normal.",
      2: "ASA II: Doença sistêmica leve (ex: HAS controlada). Proceder com cirurgia.",
      3: "ASA III: Doença sistêmica grave. Necessita otimização pré-operatória.",
      4: "ASA IV: Doença sistêmica grave que ameaça a vida. Alto risco. UTI pós-op provável.",
    };
    return { escore: `ASA ${asa}`, conduta: protocolos[asa] || "Avaliação não categorizada." };
  }
}

export class PrEP_PEP extends LinhaDeCuidado {
  constructor() {
    super("Profilaxia HIV (PrEP/PEP)");
  }
  avaliar(dados: DadosPaciente) {
    if (typeof dados.exposicao_72h !== "boolean" || typeof dados.risco_continuo !== "boolean")
      return incomplete();
    if (dados.exposicao_72h)
      return {
        escore: "Emergência PEP",
        conduta: "PEP (Tenofovir+Lamivudina+Dolutegravir) por 28 dias.",
      };
    else if (dados.risco_continuo)
      return { escore: "Elegível PrEP", conduta: "Solicitar TR HIV, Cr, Sífilis. Iniciar PrEP." };
    else
      return { escore: "Baixo Risco", conduta: "Aconselhamento padrão e oferta de preservativos." };
  }
}

export class Puerperio extends LinhaDeCuidado {
  constructor() {
    super("Puerpério");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.epds_score, 0, 30) || !Number.isInteger(dados.epds_score))
      return incomplete();
    const epds = dados.epds_score;
    if (epds >= 12)
      return {
        escore: `EPDS: ${epds}`,
        conduta: "Risco de Depressão Pós-Parto. Intervenção em saúde mental.",
      };
    else
      return {
        escore: `EPDS: ${epds}`,
        conduta:
          "Apoio ao aleitamento materno. Avaliação de cicatriz/sangramento. Planejamento familiar.",
      };
  }
}

export class Puericultura extends LinhaDeCuidado {
  constructor() {
    super("Puericultura");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.percentil_peso, 0, 100)) return incomplete();
    const percentil = dados.percentil_peso;
    if (percentil < 3)
      return {
        escore: `Percentil: ${percentil}`,
        conduta: "Baixo peso. Investigar causas nutricionais/orgânicas. Revisar PNI (vacinas).",
      };
    else if (percentil > 97)
      return {
        escore: `Percentil: ${percentil}`,
        conduta: "Risco de obesidade infantil. Educação alimentar. Revisar PNI.",
      };
    else
      return {
        escore: `Percentil: ${percentil}`,
        conduta: "Desenvolvimento adequado. Seguir calendário de consultas e vacinação (PNI).",
      };
  }
}

export class Climaterio extends LinhaDeCuidado {
  constructor() {
    super("Climatério / Menopausa");
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.mrs_escore, 0, 44) || !Number.isInteger(dados.mrs_escore))
      return incomplete();
    const mrs = dados.mrs_escore;
    let conduta = "";
    if (mrs >= 17)
      conduta =
        "Sintomas severos. Avaliar indicação de Terapia Hormonal (TH) se não houver contraindicação.";
    else if (mrs >= 9) conduta = "Sintomas moderados. Manejo sintomático, fitoterápicos ou TH.";
    else conduta = "Sintomas leves. Orientações sobre saúde óssea e cardiovascular.";
    return { escore: `MRS: ${mrs}`, conduta };
  }
}

export class SistemaSaudeIntegrado {
  linhas_disponiveis: Record<string, LinhaDeCuidado>;

  constructor() {
    this.linhas_disponiveis = {
      saude_mental: new SaudeMental(),
      diabetes: new Diabetes(),
      hipertensao: new Hipertensao(),
      climaterio: new Climaterio(),
      cirurgia: new PrePosOperatorio(),
      prep_pep: new PrEP_PEP(),
      obesidade: new Obesidade(),
      neoplasias: new Neoplasias(),
      idoso: new EnvelhecimentoAtivo(),
      gestacao_risco: new GestacaoAltoRisco(),
      gestacao: new Gestacao(),
      puerperio: new Puerperio(),
      puericultura: new Puericultura(),
      reumatologia: new Reumatologia(),
    };
  }

  /**
   * Avalia o paciente em todas as linhas ativadas no perfil dele.
   * @returns Array com os resultados de cada linha
   */
  avaliarPaciente(paciente: DadosPaciente) {
    const resultados = [];
    for (const codigo of paciente.linhas_ativadas || []) {
      if (this.linhas_disponiveis[codigo]) {
        const linha = this.linhas_disponiveis[codigo];
        const res = linha.avaliar(paciente);
        resultados.push({
          linha: linha.nome,
          codigo: codigo,
          escore: res.escore,
          conduta: res.conduta,
        });
      }
    }
    return resultados;
  }
}

// Instância global que pode ser exportada
export const clinicalEngine = new SistemaSaudeIntegrado();
