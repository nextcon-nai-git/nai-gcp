export type DadosPaciente = Record<string, unknown>;

export const CLINICAL_LINE_CODES = [
  "saude_mental",
  "diabetes",
  "hipertensao",
  "climaterio",
  "cirurgia",
  "prep_pep",
  "obesidade",
  "neoplasias",
  "idoso",
  "gestacao_risco",
  "gestacao",
  "puerperio",
  "puericultura",
  "reumatologia",
] as const;
export type ClinicalLineCode = (typeof CLINICAL_LINE_CODES)[number];

export interface ResultadoLinha {
  /** A reported value or arithmetic result, never a clinical interpretation. */
  escore: string;
  /** Compatibility field: a review notice, not a generated clinical conduct. */
  conduta: string;
  inputValidity: "VALID" | "INCOMPLETE_OR_INVALID";
  clinicallyValidated: false;
  reviewRequired: true;
  reportedData: DadosPaciente;
}

const numeric = (value: unknown, min = 0, max = Infinity): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const answers = (value: unknown, size: number): value is number[] =>
  Array.isArray(value) &&
  value.length === size &&
  Array.from(value).every((item) => Number.isInteger(item) && numeric(item, 0, 3));

export abstract class LinhaDeCuidado {
  constructor(
    public nome: string,
    public readonly campos: readonly string[]
  ) {}

  protected summarize(dados: DadosPaciente, escore?: string): ResultadoLinha {
    return {
      escore: escore ?? "Não avaliado",
      conduta:
        escore === undefined
          ? "Dados ausentes ou inválidos para este resumo. Os valores informados foram preservados para revisão profissional. Nenhuma avaliação clínica foi realizada."
          : "Resumo dos dados informados, sem avaliação clínica. A interpretação e a definição de conduta dependem de revisão por profissional habilitado.",
      inputValidity: escore === undefined ? "INCOMPLETE_OR_INVALID" : "VALID",
      clinicallyValidated: false,
      reviewRequired: true,
      reportedData: Object.fromEntries(
        [...this.campos, "relato"]
          .filter((campo) => Object.prototype.hasOwnProperty.call(dados, campo))
          .map((campo) => [campo, dados[campo]])
      ),
    };
  }

  abstract avaliar(dados: DadosPaciente): ResultadoLinha;
}

export class SaudeMental extends LinhaDeCuidado {
  constructor() {
    super("Questionários informados (PHQ-9 e GAD-7)", ["phq9", "gad7"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!answers(dados.phq9, 9) || !answers(dados.gad7, 7)) return this.summarize(dados);
    const phq9 = dados.phq9.reduce((a, b) => a + b, 0);
    const gad7 = dados.gad7.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(phq9) || !Number.isFinite(gad7)) return this.summarize(dados);
    return this.summarize(dados, `PHQ-9: ${phq9} | GAD-7: ${gad7}`);
  }
}

export class Diabetes extends LinhaDeCuidado {
  constructor() {
    super("Glicemia e hemoglobina glicada informadas", ["glicemia_jejum", "hba1c"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.glicemia_jejum, Number.MIN_VALUE) || !numeric(dados.hba1c, Number.MIN_VALUE))
      return this.summarize(dados);
    return this.summarize(
      dados,
      `Glicemia informada: ${dados.glicemia_jejum} mg/dL | HbA1c informada: ${dados.hba1c}%`
    );
  }
}

export class Hipertensao extends LinhaDeCuidado {
  constructor() {
    super("Pressão arterial informada", ["pas", "pad"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.pas, Number.MIN_VALUE) || !numeric(dados.pad, Number.MIN_VALUE))
      return this.summarize(dados);
    return this.summarize(dados, `PA informada: ${dados.pas}x${dados.pad} mmHg`);
  }
}

export class Obesidade extends LinhaDeCuidado {
  constructor() {
    super("Medidas informadas e cálculo do IMC", ["peso", "altura"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.peso, Number.MIN_VALUE) || !numeric(dados.altura, Number.MIN_VALUE))
      return this.summarize(dados);
    const heightSquared = dados.altura * dados.altura;
    if (!numeric(heightSquared, Number.MIN_VALUE)) return this.summarize(dados);
    const imc = dados.peso / heightSquared;
    if (!numeric(imc, Number.MIN_VALUE)) return this.summarize(dados);
    const rounded = Math.round(imc * 10) / 10;
    if (!numeric(rounded, Number.MIN_VALUE)) return this.summarize(dados);
    return this.summarize(dados, `IMC ${rounded} (calculado com peso e altura informados)`);
  }
}

export class Neoplasias extends LinhaDeCuidado {
  constructor() {
    super("Dados demográficos informados", ["idade", "sexo"]);
  }
  avaliar(dados: DadosPaciente) {
    if (
      !Number.isInteger(dados.idade) ||
      !numeric(dados.idade, 0, 130) ||
      (dados.sexo !== "F" && dados.sexo !== "M")
    )
      return this.summarize(dados);
    return this.summarize(dados, `Idade informada: ${dados.idade} | Sexo informado: ${dados.sexo}`);
  }
}

export class EnvelhecimentoAtivo extends LinhaDeCuidado {
  constructor() {
    super("Índice de Katz informado", ["katz_score"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.katz_score, 0, 6) || !Number.isInteger(dados.katz_score))
      return this.summarize(dados);
    return this.summarize(dados, `Katz informado: ${dados.katz_score}/6`);
  }
}

export class GestacaoAltoRisco extends LinhaDeCuidado {
  constructor() {
    super("Fatores gestacionais informados", ["fatores_risco_gestacional"]);
  }
  avaliar(dados: DadosPaciente) {
    if (
      !Array.isArray(dados.fatores_risco_gestacional) ||
      !Array.from(dados.fatores_risco_gestacional).every(
        (value: unknown) => typeof value === "string" && value.trim()
      )
    )
      return this.summarize(dados);
    const fatores = dados.fatores_risco_gestacional;
    return this.summarize(
      dados,
      fatores.length > 0
        ? `Fatores gestacionais informados: ${fatores.join("; ")}`
        : "Fatores gestacionais informados: lista vazia (sem classificação de risco)"
    );
  }
}

export class Gestacao extends LinhaDeCuidado {
  constructor() {
    super("Idade gestacional informada", ["idade_gestacional_semanas"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.idade_gestacional_semanas, Number.MIN_VALUE, 45))
      return this.summarize(dados);
    return this.summarize(dados, `IG informada: ${dados.idade_gestacional_semanas} semanas`);
  }
}

export class Reumatologia extends LinhaDeCuidado {
  constructor() {
    super("Escore DAS28 informado", ["das28_score"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.das28_score)) return this.summarize(dados);
    return this.summarize(dados, `DAS28 informado: ${dados.das28_score}`);
  }
}

export class PrePosOperatorio extends LinhaDeCuidado {
  constructor() {
    super("Classificação ASA informada", ["asa_score"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!Number.isInteger(dados.asa_score) || !numeric(dados.asa_score, 1, 6))
      return this.summarize(dados);
    return this.summarize(dados, `ASA informado: ${dados.asa_score}`);
  }
}

export class PrEP_PEP extends LinhaDeCuidado {
  constructor() {
    super("Informações declaradas de exposição ao HIV", ["exposicao_72h", "risco_continuo"]);
  }
  avaliar(dados: DadosPaciente) {
    if (typeof dados.exposicao_72h !== "boolean" || typeof dados.risco_continuo !== "boolean")
      return this.summarize(dados);
    return this.summarize(
      dados,
      `Exposição nas últimas 72h informada: ${dados.exposicao_72h ? "sim" : "não"} | Risco contínuo informado: ${dados.risco_continuo ? "sim" : "não"}`
    );
  }
}

export class Puerperio extends LinhaDeCuidado {
  constructor() {
    super("Escore EPDS informado", ["epds_score"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.epds_score, 0, 30) || !Number.isInteger(dados.epds_score))
      return this.summarize(dados);
    return this.summarize(dados, `EPDS: ${dados.epds_score}`);
  }
}

export class Puericultura extends LinhaDeCuidado {
  constructor() {
    super("Percentil de peso informado", ["percentil_peso"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.percentil_peso, 0, 100)) return this.summarize(dados);
    return this.summarize(dados, `Percentil de peso informado: ${dados.percentil_peso}`);
  }
}

export class Climaterio extends LinhaDeCuidado {
  constructor() {
    super("Escore MRS informado", ["mrs_escore"]);
  }
  avaliar(dados: DadosPaciente) {
    if (!numeric(dados.mrs_escore, 0, 44) || !Number.isInteger(dados.mrs_escore))
      return this.summarize(dados);
    return this.summarize(dados, `MRS informado: ${dados.mrs_escore}`);
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

  /** Summarize the supplied fields for review. No clinical decision is performed. */
  avaliarPaciente(paciente: DadosPaciente) {
    if (!paciente || typeof paciente !== "object" || Array.isArray(paciente))
      throw new Error("Informe um objeto JSON com os dados a conferir.");
    if (
      !Array.isArray(paciente.linhas_ativadas) ||
      !Array.from(paciente.linhas_ativadas).every(
        (code: unknown) =>
          typeof code === "string" &&
          Object.prototype.hasOwnProperty.call(this.linhas_disponiveis, code)
      )
    )
      throw new Error("Informe linhas_ativadas como uma lista de códigos de resumo conhecidos.");

    return [...new Set(paciente.linhas_ativadas as ClinicalLineCode[])].map((codigo) => {
      const linha = this.linhas_disponiveis[codigo];
      return { linha: linha.nome, codigo, ...linha.avaliar(paciente) };
    });
  }
}

export const clinicalEngine = new SistemaSaudeIntegrado();
