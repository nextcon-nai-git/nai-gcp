import { z } from "zod";
import { isValidCpf } from "./cpf";
import { isValidCnpj } from "./cnpj";
import {
  ESOCIAL_TP_ASO,
  ESOCIAL_RES_ASO,
  ESOCIAL_IND_RESULT,
  ESOCIAL_PROCEDURES,
  ESOCIAL_RISK_AGENTS,
  esocialTableOptions,
  isEsocialTableCode,
  type EsocialTableCode,
} from "./esocial-codes";

/** Client-safe inputs. These local checks do not certify RET, RFB, medical content or receipt. */
export const ESOCIAL_LAYOUT = "S-1.3-20261026" as const;
export const ESOCIAL_EVENT_TYPES = ["S2210", "S2220", "S2240", "S2221", "S2230", "S3000"] as const;
export type EsocialEventType = (typeof ESOCIAL_EVENT_TYPES)[number];
export const EsocialEventTypeSchema = z.enum(ESOCIAL_EVENT_TYPES);
export const ESOCIAL_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
const uf = z.enum(ESOCIAL_UFS);
const numberChoice = <const T extends readonly number[]>(values: T) =>
  z
    .number()
    .int()
    .refine((v) => values.includes(v), "Selecione um código oficial válido.")
    .transform((v) => v as T[number]);
const text = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
      "Texto contém caracteres de controle."
    );
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());
const yesNo = z.enum(["S", "N"]);
export const EsocialDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inexistente.");
const hour = z
  .string()
  .transform((v) => v.replace(":", ""))
  .pipe(z.string().regex(/^(?:[01]\d|2[0-3])[0-5]\d$/));
const duration = z
  .string()
  .transform((v) => v.replace(":", ""))
  .pipe(z.string().regex(/^\d{2}[0-5]\d$/));
export const EsocialReceiptSchema = z
  .string()
  .regex(/^1\.\d\.\d{19}$/, "Informe o recibo completo do evento, não o protocolo do lote.");
export function normalizeEsocialRegistration(value: string): string {
  return value.replace(/[.\-/\s]/g, "").toUpperCase();
}
export function isValidEsocialRegistration(type: string | number, value: string): boolean {
  if (!/^[A-Za-z0-9.\-/\s]+$/.test(value)) return false;
  const nr = normalizeEsocialRegistration(value);
  if (String(type) === "2") return /^\d{11}$/.test(nr) && isValidCpf(nr);
  // An eight-character CNPJ base has no check digits: server must match S-1000/client registry.
  return (
    String(type) === "1" && ((/^[A-Z0-9]{8}$/.test(nr) && !/^0+$/.test(nr)) || isValidCnpj(nr))
  );
}
export const EsocialCpfSchema = z
  .string()
  .trim()
  .regex(/^[\d.\-\s]+$/)
  .transform(normalizeEsocialRegistration)
  .refine((v) => /^\d{11}$/.test(v) && isValidCpf(v), "CPF inválido.");
export const EsocialCnpjSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9.\-/\s]+$/)
  .transform(normalizeEsocialRegistration)
  .refine(isValidCnpj, "CNPJ inválido (inclusive dígitos verificadores).");
export const EsocialEmployerSchema = z
  .object({
    tpInsc: numberChoice([1, 2]),
    nrInsc: text(30).transform(normalizeEsocialRegistration),
  })
  .strict()
  .superRefine((v, c) => {
    if (!isValidEsocialRegistration(v.tpInsc, v.nrInsc))
      c.addIssue({
        code: "custom",
        path: ["nrInsc"],
        message: "Inscrição do empregador inválida. Informe conforme S-1000.",
      });
  });
const tableCode = (table: EsocialTableCode) =>
  text(20).refine(
    (v) => isEsocialTableCode(table, v),
    `Código ausente da tabela ${table} vigente.`
  );
const category = z
  .number()
  .int()
  .refine((v) => isEsocialTableCode("01", String(v)), "Categoria ausente da tabela 01.");
export const EsocialWorkerSchema = z
  .object({
    cpfTrab: EsocialCpfSchema,
    matricula: optional(text(30)),
    codCateg: optional(category),
  })
  .strict()
  .superRefine((v, c) => {
    if (Boolean(v.matricula) === (v.codCateg !== undefined))
      c.addIssue({
        code: "custom",
        path: ["matricula"],
        message: "Informe matrícula ou categoria de TSVE sem matrícula, conforme o RET.",
      });
  });
const metadata = z
  .object({
    tpAmb: numberChoice([1, 2]).default(2),
    indRetif: numberChoice([1, 2]).default(1),
    nrRecibo: optional(EsocialReceiptSchema),
  })
  .strict()
  .default({});
const context = z
  .object({
    workerAbroad: z.boolean().optional(),
    pcmsoCoordinatorExists: z.boolean().optional(),
    workerCategory: category.optional(),
    celetista: z.boolean().optional(),
  })
  .strict()
  .optional();
const common = {
  id: optional(z.string().regex(/^ID[12][A-Z0-9]{12}\d{21}$/)),
  ideEvento: metadata,
  ideEmpregador: EsocialEmployerSchema,
  context,
};
const physician = z
  .object({ nmMed: text(70, 2), nrCrm: optional(text(10)), ufCrm: optional(uf) })
  .strict();
const coordinator = z
  .object({ nmMed: text(70, 2), nrCrm: text(10), ufCrm: uf, cpfResp: optional(EsocialCpfSchema) })
  .strict();
const observationCodes = new Set([
  "0583",
  "0998",
  "0999",
  "1128",
  "1230",
  "1992",
  "1993",
  "1994",
  "1995",
  "1996",
  "1997",
  "1998",
  "1999",
  "9999",
]);
export const EsocialExamSchema = z
  .object({
    dtExm: EsocialDaySchema,
    procRealizado: tableCode("27"),
    obsProc: optional(text(999)),
    ordExame: optional(numberChoice([1, 2])),
    indResult: optional(numberChoice([1, 2, 3, 4])),
  })
  .strict()
  .superRefine((v, c) => {
    if (observationCodes.has(v.procRealizado) && !v.obsProc)
      c.addIssue({
        code: "custom",
        path: ["obsProc"],
        message: "Este procedimento exige observação.",
      });
    if (v.procRealizado === "0281" && !v.ordExame)
      c.addIssue({
        code: "custom",
        path: ["ordExame"],
        message: "Audiometria exige ordem do exame.",
      });
  });
export const EsocialAsoSchema = z
  .object({
    dtAso: EsocialDaySchema,
    tpAso: numberChoice([0, 1, 2, 3, 4, 9]),
    resAso: optional(numberChoice([1, 2])),
    exames: z.array(EsocialExamSchema).min(1).max(99),
    medico: physician,
    medicoResp: coordinator.optional(),
    resultDisclosureAuthorized: z.boolean().optional(),
  })
  .strict();
const s2220 = z
  .object({
    ...common,
    eventType: z.literal("S2220"),
    ideVinculo: EsocialWorkerSchema,
    aso: EsocialAsoSchema,
  })
  .strict();

const locationRegistration = z
  .object({
    tpInsc: numberChoice([1, 3, 4]),
    nrInsc: text(30).transform(normalizeEsocialRegistration),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.tpInsc === 1 ? !isValidCnpj(v.nrInsc) : !/^\d{12}$/.test(v.nrInsc))
      c.addIssue({
        code: "custom",
        path: ["nrInsc"],
        message: "Informe CNPJ válido ou inscrição de 12 posições compatível com o tipo.",
      });
  });
const localAccident = z
  .object({
    tpLocal: numberChoice([1, 2, 3, 4, 5, 6, 9]),
    dscLocal: optional(text(255)),
    tpLograd: optional(tableCode("20")),
    dscLograd: text(100),
    nrLograd: text(10),
    complemento: optional(text(30)),
    bairro: optional(text(90)),
    cep: optional(z.string().regex(/^\d{8}$/)),
    codMunic: optional(z.string().regex(/^\d{7}$/)),
    uf: optional(uf),
    pais: optional(tableCode("06")),
    codPostal: optional(text(12, 4)),
    ideLocalAcid: locationRegistration.optional(),
  })
  .strict();
const cat = z
  .object({
    dtAcid: EsocialDaySchema,
    tpAcid: numberChoice([1, 2, 3]),
    hrAcid: optional(hour),
    hrsTrabAntesAcid: optional(duration),
    tpCat: numberChoice([1, 2, 3]),
    indCatObito: yesNo,
    dtObito: optional(EsocialDaySchema),
    indComunPolicia: yesNo,
    codSitGeradora: tableCode("15"),
    iniciatCAT: numberChoice([1, 2, 3]),
    obsCAT: optional(text(999)),
    ultDiaTrab: optional(EsocialDaySchema),
    houveAfast: optional(yesNo),
    localAcidente: localAccident,
    parteAtingida: z
      .object({ codParteAting: tableCode("13"), lateralidade: numberChoice([0, 1, 2, 3]) })
      .strict(),
    agenteCausador: z
      .object({
        codAgntCausador: text(9).refine(
          (v) => isEsocialTableCode("14", v) || isEsocialTableCode("15", v),
          "Agente ausente das tabelas 14/15."
        ),
      })
      .strict(),
    atestado: z
      .object({
        dtAtendimento: EsocialDaySchema,
        hrAtendimento: hour,
        indInternacao: yesNo,
        durTrat: z.number().int().min(0).max(9999),
        indAfast: yesNo,
        dscLesao: tableCode("17"),
        dscCompLesao: optional(text(200)),
        diagProvavel: optional(text(100)),
        codCID: z.string().regex(/^[A-Z][0-9][A-Z0-9]{1,2}$/),
        observacao: optional(text(999)),
        emitente: z
          .object({
            nmEmit: text(70, 2),
            ideOC: numberChoice([1, 2, 3]),
            nrOC: text(14),
            ufOC: optional(uf),
          })
          .strict(),
      })
      .strict(),
    catOrigem: z.object({ nrRecCatOrig: EsocialReceiptSchema }).strict().optional(),
  })
  .strict();
const s2210 = z
  .object({ ...common, eventType: z.literal("S2210"), ideVinculo: EsocialWorkerSchema, cat })
  .strict();

const epiComplement = z
  .object({
    medProtecao: yesNo,
    condFuncto: yesNo,
    usoInint: yesNo,
    przValid: yesNo,
    periodicTroca: yesNo,
    higienizacao: yesNo,
  })
  .strict();
const epcEpi = z
  .object({
    utilizEPC: numberChoice([0, 1, 2]),
    eficEpc: optional(yesNo),
    utilizEPI: numberChoice([0, 1, 2]),
    eficEpi: optional(yesNo),
    epi: z
      .array(z.object({ docAval: text(255) }).strict())
      .min(1)
      .max(50)
      .optional(),
    epiCompl: epiComplement.optional(),
  })
  .strict();
const decimal = z
  .string()
  .regex(/^\d{1,6}(?:\.\d{1,4})?$/, "Use número decimal com ponto, até quatro casas.");
const riskAgent = z
  .object({
    codAgNoc: tableCode("24"),
    dscAgNoc: optional(text(100)),
    tpAval: optional(numberChoice([1, 2])),
    intConc: optional(decimal),
    limTol: optional(decimal),
    unMed: optional(z.number().int().min(1).max(30)),
    tecMedicao: optional(text(40)),
    nrProcJud: optional(z.string().regex(/^(?:\d{17}|\d{20}|\d{21})$/)),
    epcEpi: epcEpi.optional(),
  })
  .strict();
const infoExpRisco = z
  .object({
    dtIniCondicao: EsocialDaySchema,
    dtFimCondicao: optional(EsocialDaySchema),
    infoAmb: z
      .array(
        z
          .object({
            localAmb: numberChoice([1, 2]),
            dscSetor: text(100),
            tpInsc: numberChoice([1, 3, 4]),
            nrInsc: text(30).transform(normalizeEsocialRegistration),
          })
          .strict()
      )
      .min(1)
      .max(9),
    infoAtiv: z.object({ dscAtivDes: text(999) }).strict(),
    agNoc: z.array(riskAgent).min(1).max(999),
    respReg: z
      .array(
        z
          .object({
            cpfResp: EsocialCpfSchema,
            ideOC: optional(numberChoice([1, 4, 9])),
            dscOC: optional(text(20)),
            nrOC: optional(text(14)),
            ufOC: optional(uf),
          })
          .strict()
      )
      .min(1)
      .max(99),
    obs: z
      .object({ obsCompl: text(999) })
      .strict()
      .optional(),
  })
  .strict();
const s2240 = z
  .object({
    ...common,
    eventType: z.literal("S2240"),
    ideVinculo: EsocialWorkerSchema,
    infoExpRisco,
  })
  .strict();
const s2221 = z
  .object({
    ...common,
    eventType: z.literal("S2221"),
    ideVinculo: z.object({ cpfTrab: EsocialCpfSchema, matricula: text(30) }).strict(),
    toxicologico: z
      .object({
        dtExame: EsocialDaySchema,
        cnpjLab: EsocialCnpjSchema,
        codSeqExame: z.string().regex(/^[A-Za-z]{2}\d{9}$/),
        nmMed: text(70, 2),
        nrCRM: optional(text(10)),
        ufCRM: optional(uf),
      })
      .strict(),
  })
  .strict();
const iniAfastamento = z
  .object({
    dtIniAfast: EsocialDaySchema,
    codMotAfast: tableCode("18"),
    infoMesmoMtv: optional(yesNo),
    tpAcidTransito: optional(numberChoice([1, 2, 3])),
    observacao: optional(text(999)),
    perAquis: z
      .object({ dtInicio: EsocialDaySchema, dtFim: optional(EsocialDaySchema) })
      .strict()
      .optional(),
    infoCessao: z
      .object({ cnpjCess: EsocialCnpjSchema, infOnus: numberChoice([1, 2, 3]) })
      .strict()
      .optional(),
    infoMandSind: z
      .object({ cnpjSind: EsocialCnpjSchema, infOnusRemun: numberChoice([1, 2, 3]) })
      .strict()
      .optional(),
    infoMandElet: z
      .object({ cnpjMandElet: EsocialCnpjSchema, indRemunCargo: optional(yesNo) })
      .strict()
      .optional(),
  })
  .strict();
const s2230 = z
  .object({
    ...common,
    eventType: z.literal("S2230"),
    ideVinculo: EsocialWorkerSchema,
    infoAfastamento: z
      .object({
        iniAfastamento: iniAfastamento.optional(),
        infoRetif: z
          .object({
            origRetif: numberChoice([1, 2, 3]),
            tpProc: optional(numberChoice([1, 2, 3])),
            nrProc: optional(z.string().regex(/^\d{10,21}$/)),
          })
          .strict()
          .optional(),
        fimAfastamento: z.object({ dtTermAfast: EsocialDaySchema }).strict().optional(),
      })
      .strict(),
  })
  .strict();
const s3000 = z
  .object({
    ...common,
    eventType: z.literal("S3000"),
    ideVinculo: z.object({ cpfTrab: EsocialCpfSchema }).strict(),
    infoExclusao: z
      .object({
        tpEvento: z.enum(["S-2210", "S-2220", "S-2240", "S-2221", "S-2230"]),
        nrRecEvt: EsocialReceiptSchema,
      })
      .strict(),
  })
  .strict();
const discriminated = z.discriminatedUnion("eventType", [s2210, s2220, s2240, s2221, s2230, s3000]);
type EventData = z.infer<typeof discriminated>;
const todayBrazil = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const plusDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
function validateEvent(data: EventData, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const exclusive = (
    required: boolean,
    present: boolean,
    path: (string | number)[],
    label: string
  ) => {
    if (required !== present)
      issue(path, required ? `Informe ${label}.` : `${label} não se aplica a esta opção.`);
  };
  const today = todayBrazil();
  const { indRetif, nrRecibo } = data.ideEvento;
  if (data.eventType === "S3000") {
    if (indRetif !== 1 || nrRecibo)
      issue(["ideEvento"], "Exclusão não admite retificação; informe o recibo do evento excluído.");
  } else
    exclusive(
      indRetif === 2,
      !!nrRecibo,
      ["ideEvento", "nrRecibo"],
      "recibo do evento a retificar"
    );
  if (
    data.id &&
    !data.id.startsWith(
      `ID${data.ideEmpregador.tpInsc}${data.ideEmpregador.nrInsc.padEnd(14, "0")}`
    )
  )
    issue(["id"], "Identificador não corresponde à inscrição do empregador.");
  const seen = (values: string[], path: (string | number)[]) => {
    if (new Set(values).size !== values.length) issue(path, "Há itens duplicados neste grupo.");
  };
  if (data.eventType === "S2220") {
    const a = data.aso;
    if (a.dtAso > today) issue(["aso", "dtAso"], "O ASO precisa ter sido emitido.");
    a.exames.forEach((e, i) => {
      if (e.dtExm > a.dtAso) issue(["aso", "exames", i, "dtExm"], "Exame posterior ao ASO.");
      if (e.indResult !== undefined && a.resultDisclosureAuthorized !== true)
        issue(
          ["aso", "exames", i, "indResult"],
          "A indicação de resultado exige autorização expressa do trabalhador."
        );
    });
    seen(
      a.exames.map((e) => `${e.dtExm}|${e.procRealizado}`),
      ["aso", "exames"]
    );
    if (data.context?.workerAbroad !== true && (!a.medico.nrCrm || !a.medico.ufCrm))
      issue(
        ["aso", "medico"],
        "Informe CRM e UF; a exceção exige endereço do trabalhador no exterior no RET."
      );
    if (Boolean(a.medico.nrCrm) !== Boolean(a.medico.ufCrm))
      issue(["aso", "medico"], "Informe CRM e UF em conjunto.");
    if (data.context?.pcmsoCoordinatorExists === true && !a.medicoResp)
      issue(["aso", "medicoResp"], "Informe o responsável/coordenador do PCMSO.");
  }
  if (data.eventType === "S2221") {
    const t = data.toxicologico;
    if (t.dtExame > today)
      issue(["toxicologico", "dtExame"], "O exame precisa ter sido realizado.");
    if (data.context?.workerAbroad !== true && (!t.nrCRM || !t.ufCRM))
      issue(
        ["toxicologico"],
        "Informe CRM e UF do médico, salvo endereço do trabalhador no exterior no RET."
      );
    if (Boolean(t.nrCRM) !== Boolean(t.ufCRM))
      issue(["toxicologico"], "Informe CRM e UF em conjunto.");
  }
  if (data.eventType === "S2210") {
    const c = data.cat,
      loc = c.localAcidente,
      at = c.atestado;
    if (c.dtAcid > today) issue(["cat", "dtAcid"], "Acidente não pode ter data futura.");
    if (c.tpAcid === 2 && (c.hrAcid || c.hrsTrabAntesAcid))
      issue(
        ["cat", "hrAcid"],
        "Doença profissional não informa hora nem horas trabalhadas antes do acidente."
      );
    if ((c.tpAcid === 1 || (c.tpAcid === 3 && c.dtAcid >= "2022-01-26")) && !c.hrAcid)
      issue(["cat", "hrAcid"], "Informe a hora do acidente.");
    if ((c.tpAcid === 1 || (c.tpAcid === 3 && c.dtAcid >= "2022-07-20")) && !c.hrsTrabAntesAcid)
      issue(["cat", "hrsTrabAntesAcid"], "Informe as horas trabalhadas antes do acidente.");
    if ((c.tpCat === 3 && c.indCatObito !== "S") || (c.tpCat === 2 && c.indCatObito !== "N"))
      issue(["cat", "indCatObito"], "Óbito incompatível com o tipo de CAT.");
    exclusive(c.indCatObito === "S", !!c.dtObito, ["cat", "dtObito"], "data do óbito");
    if (c.dtObito && (c.dtObito < c.dtAcid || c.dtObito > today))
      issue(["cat", "dtObito"], "Data de óbito fora do período do acidente até hoje.");
    if (c.dtAcid >= "2023-01-16" && (!c.ultDiaTrab || !c.houveAfast))
      issue(["cat", "ultDiaTrab"], "Informe último dia trabalhado e se houve afastamento.");
    if (c.ultDiaTrab && c.ultDiaTrab > today)
      issue(["cat", "ultDiaTrab"], "Último dia trabalhado não pode ser futuro.");
    if ([1, 3, 5].includes(loc.tpLocal) && !loc.cep)
      issue(["cat", "localAcidente", "cep"], "Informe o CEP do local.");
    if ([1, 3, 4, 5].includes(loc.tpLocal) && (!loc.codMunic || !loc.uf))
      issue(["cat", "localAcidente"], "Informe município IBGE e UF do local.");
    if (loc.tpLocal === 2 && (loc.cep || loc.codMunic || loc.uf))
      issue(
        ["cat", "localAcidente"],
        "Local no exterior não informa CEP, município IBGE ou UF brasileira."
      );
    exclusive(loc.tpLocal === 2, !!loc.pais, ["cat", "localAcidente", "pais"], "país");
    exclusive(
      loc.tpLocal === 2,
      !!loc.codPostal,
      ["cat", "localAcidente", "codPostal"],
      "código postal estrangeiro"
    );
    if (
      ((data.ideEmpregador.tpInsc === 1 && [1, 3].includes(loc.tpLocal)) ||
        (String(data.context?.workerCategory || "").startsWith("2") && c.dtAcid >= "2023-01-16")) &&
      !loc.ideLocalAcid
    )
      issue(
        ["cat", "localAcidente", "ideLocalAcid"],
        "Identifique a inscrição do estabelecimento/local do acidente."
      );
    if (
      c.dtAcid >= "2024-01-22" &&
      c.tpAcid !== 2 &&
      !isEsocialTableCode("14", c.agenteCausador.codAgntCausador)
    )
      issue(["cat", "agenteCausador"], "Acidente típico/trajeto exige agente da tabela 14.");
    if (at.dtAtendimento < c.dtAcid || at.dtAtendimento > today)
      issue(
        ["cat", "atestado", "dtAtendimento"],
        "Atendimento deve ocorrer entre o acidente e hoje."
      );
    if (c.indCatObito === "S" && at.indAfast !== "N")
      issue(
        ["cat", "atestado", "indAfast"],
        "CAT com óbito deve informar N no afastamento do atestado."
      );
    if ([1, 2].includes(at.emitente.ideOC) && !at.emitente.ufOC)
      issue(["cat", "atestado", "emitente", "ufOC"], "Informe UF do CRM/CRO.");
    exclusive(c.tpCat !== 1, !!c.catOrigem, ["cat", "catOrigem"], "recibo da CAT de origem");
  }
  if (data.eventType === "S2240") {
    const r = data.infoExpRisco;
    if (r.dtIniCondicao > plusDays(today, 30))
      issue(
        ["infoExpRisco", "dtIniCondicao"],
        "Início de condição pode ser no máximo 30 dias futuro."
      );
    if (r.dtFimCondicao && r.dtFimCondicao < r.dtIniCondicao)
      issue(["infoExpRisco", "dtFimCondicao"], "Término anterior ao início.");
    const avulso = String(
      data.context?.workerCategory ||
        ("codCateg" in data.ideVinculo && data.ideVinculo.codCateg) ||
        ""
    ).startsWith("2");
    if (r.infoAmb.length > 1 && !avulso)
      issue(
        ["infoExpRisco", "infoAmb"],
        "Mais de um ambiente exige categoria de trabalhador avulso confirmada no RET."
      );
    if (avulso && r.dtIniCondicao >= "2023-01-16" && !r.dtFimCondicao)
      issue(["infoExpRisco", "dtFimCondicao"], "Trabalhador avulso exige data final de condição.");
    if (r.dtFimCondicao && !avulso)
      issue(["infoExpRisco", "dtFimCondicao"], "Data final é exclusiva do trabalhador avulso.");
    r.infoAmb.forEach((a, i) => {
      if (!locationRegistration.safeParse({ tpInsc: a.tpInsc, nrInsc: a.nrInsc }).success)
        issue(["infoExpRisco", "infoAmb", i, "nrInsc"], "Inscrição do ambiente inválida.");
    });
    seen(
      r.infoAmb.map((a) => `${a.tpInsc}|${a.nrInsc}`),
      ["infoExpRisco", "infoAmb"]
    );
    seen(
      r.agNoc.map((a) => `${a.codAgNoc}|${a.dscAgNoc || ""}`),
      ["infoExpRisco", "agNoc"]
    );
    seen(
      r.respReg.map((a) => a.cpfResp),
      ["infoExpRisco", "respReg"]
    );
    const absence = r.agNoc.some((a) => a.codAgNoc === "09.01.001");
    if (absence && r.agNoc.length !== 1)
      issue(
        ["infoExpRisco", "agNoc"],
        "Ausência de agente nocivo não pode coexistir com exposição."
      );
    const describe = new Set([
      "01.01.001",
      "01.02.001",
      "01.03.001",
      "01.04.001",
      "01.05.001",
      "01.06.001",
      "01.07.001",
      "01.08.001",
      "01.09.001",
      "01.10.001",
      "01.12.001",
      "01.13.001",
      "01.14.001",
      "01.15.001",
      "01.16.001",
      "01.17.001",
      "01.18.001",
      "05.01.001",
    ]);
    r.agNoc.forEach((a, i) => {
      const p = ["infoExpRisco", "agNoc", i];
      if (describe.has(a.codAgNoc) && !a.dscAgNoc)
        issue([...p, "dscAgNoc"], "Descreva o agente indicado.");
      if (a.codAgNoc === "09.01.001" && r.dtIniCondicao >= "2024-04-22" && a.dscAgNoc)
        issue([...p, "dscAgNoc"], "Ausência de exposição não admite descrição de agente.");
      exclusive(
        a.codAgNoc !== "09.01.001",
        a.tpAval !== undefined,
        [...p, "tpAval"],
        "tipo de avaliação"
      );
      exclusive(a.codAgNoc !== "09.01.001", !!a.epcEpi, [...p, "epcEpi"], "informações de EPC/EPI");
      for (const key of ["intConc", "unMed", "tecMedicao"] as const)
        exclusive(a.tpAval === 1, a[key] !== undefined, [...p, key], key);
      exclusive(
        a.tpAval === 1 && ["01.18.001", "02.01.014"].includes(a.codAgNoc),
        a.limTol !== undefined,
        [...p, "limTol"],
        "limite de tolerância"
      );
      if (r.dtIniCondicao >= "2024-01-22")
        exclusive(
          a.codAgNoc === "05.01.001",
          !!a.nrProcJud,
          [...p, "nrProcJud"],
          "processo administrativo/judicial"
        );
      if (a.epcEpi) {
        const e = a.epcEpi;
        exclusive(e.utilizEPC === 2, !!e.eficEpc, [...p, "epcEpi", "eficEpc"], "eficácia do EPC");
        exclusive(e.utilizEPI === 2, !!e.eficEpi, [...p, "epcEpi", "eficEpi"], "eficácia do EPI");
        exclusive(
          e.utilizEPI === 2,
          !!e.epi?.length,
          [...p, "epcEpi", "epi"],
          "documentos dos EPIs"
        );
        exclusive(
          e.utilizEPI === 2,
          !!e.epiCompl,
          [...p, "epcEpi", "epiCompl"],
          "requisitos de utilização do EPI"
        );
        if (e.epi)
          seen(
            e.epi.map((v) => v.docAval),
            [...p, "epcEpi", "epi"]
          );
      }
    });
    r.respReg.forEach((r, i) => {
      const p = ["infoExpRisco", "respReg", i];
      if (!absence && (!r.ideOC || !r.nrOC || !r.ufOC))
        issue(p, "Exposição exige conselho, inscrição e UF do responsável.");
      exclusive(r.ideOC === 9, !!r.dscOC, [...p, "dscOC"], "descrição do conselho");
    });
  }
  if (data.eventType === "S2230") {
    const a = data.infoAfastamento,
      start = a.iniAfastamento,
      finish = a.fimAfastamento;
    if (!start && !finish)
      issue(["infoAfastamento"], "Informe início e/ou término do afastamento.");
    if (start) {
      if (!isEsocialTableCode("18", start.codMotAfast, start.dtIniAfast))
        issue(
          ["infoAfastamento", "iniAfastamento", "codMotAfast"],
          "Motivo não vigente na data informada ou não implantado neste pacote."
        );
      const allowance = start.codMotAfast === "15" ? 60 : start.codMotAfast === "18" ? 120 : 0;
      if (start.dtIniAfast > plusDays(today, allowance))
        issue(
          ["infoAfastamento", "iniAfastamento", "dtIniAfast"],
          "Início excede a antecipação permitida para o motivo."
        );
      if (
        !["01", "03"].includes(start.codMotAfast) &&
        (start.tpAcidTransito || (start.dtIniAfast >= "2026-10-26" && start.infoMesmoMtv))
      )
        issue(
          ["infoAfastamento", "iniAfastamento"],
          "Mesmo motivo e acidente de trânsito são restritos aos motivos 01/03."
        );
      if (start.codMotAfast === "21" && !start.observacao)
        issue(["infoAfastamento", "iniAfastamento", "observacao"], "Este motivo exige observação.");
      if (start.codMotAfast !== "15" && start.perAquis)
        issue(
          ["infoAfastamento", "iniAfastamento", "perAquis"],
          "Período aquisitivo é exclusivo de férias/recesso."
        );
      if (
        start.codMotAfast === "15" &&
        data.context?.celetista === true &&
        start.dtIniAfast >= "2021-07-19" &&
        !start.perAquis
      )
        issue(
          ["infoAfastamento", "iniAfastamento", "perAquis"],
          "Informe período aquisitivo das férias do celetista."
        );
      if (start.perAquis?.dtFim && start.perAquis.dtFim <= start.perAquis.dtInicio)
        issue(
          ["infoAfastamento", "iniAfastamento", "perAquis", "dtFim"],
          "Término aquisitivo deve ser posterior ao início."
        );
      exclusive(
        start.codMotAfast === "14",
        !!start.infoCessao,
        ["infoAfastamento", "iniAfastamento", "infoCessao"],
        "informações da cessão"
      );
      exclusive(
        start.codMotAfast === "24",
        !!start.infoMandSind,
        ["infoAfastamento", "iniAfastamento", "infoMandSind"],
        "mandato sindical"
      );
      if (start.codMotAfast !== "22" && start.infoMandElet)
        issue(
          ["infoAfastamento", "iniAfastamento", "infoMandElet"],
          "Mandato eletivo é exclusivo do motivo 22."
        );
    }
    if (start && finish && finish.dtTermAfast < start.dtIniAfast)
      issue(
        ["infoAfastamento", "fimAfastamento", "dtTermAfast"],
        "Término anterior ao início do afastamento."
      );
    if (finish?.dtTermAfast === "9999-12-31")
      issue(
        ["infoAfastamento", "fimAfastamento", "dtTermAfast"],
        "Informe a data real do término."
      );
    if (a.infoRetif) {
      if (indRetif !== 2 || !start)
        issue(
          ["infoAfastamento", "infoRetif"],
          "Informações de retificação exigem evento retificador e início do afastamento."
        );
      if ([2, 3].includes(a.infoRetif.origRetif) && (!a.infoRetif.tpProc || !a.infoRetif.nrProc))
        issue(["infoAfastamento", "infoRetif"], "Informe tipo e número do processo/benefício.");
      const lengths = { 1: [17, 21], 2: [20], 3: [10] };
      if (
        a.infoRetif.tpProc &&
        a.infoRetif.nrProc &&
        !lengths[a.infoRetif.tpProc].includes(a.infoRetif.nrProc.length)
      )
        issue(
          ["infoAfastamento", "infoRetif", "nrProc"],
          "Comprimento incompatível com o tipo de processo/benefício."
        );
    }
  }
}
export const EsocialEventInputSchema = discriminated.superRefine(validateEvent);
export type EsocialEventInput = z.infer<typeof EsocialEventInputSchema>;
export type EsocialS2220Input = Extract<EsocialEventInput, { eventType: "S2220" }>;

export interface EsocialFormField {
  name: string;
  label: string;
  type:
    "text" | "textarea" | "date" | "time" | "number" | "select" | "checkbox" | "group" | "array";
  required?: boolean;
  help?: string;
  options?: readonly { value: string | number; label: string }[];
  fields?: readonly EsocialFormField[];
  minItems?: number;
  maxItems?: number;
  defaultValue?: unknown;
  showWhen?: { field: string; values: readonly (string | number | boolean)[] };
}
export interface EsocialEventForm {
  title: string;
  description: string;
  sections: readonly { title: string; fields: readonly EsocialFormField[] }[];
}
const field = (
  name: string,
  label: string,
  type: EsocialFormField["type"] = "text",
  extra: Partial<EsocialFormField> = {}
): EsocialFormField => ({ name, label, type, ...extra });
const select = (
  name: string,
  label: string,
  options: readonly { value: string | number; label: string }[],
  required = true
) => field(name, label, "select", { options, required });
const group = (name: string, label: string, fields: EsocialFormField[], required = true) =>
  field(name, label, "group", { fields, required });
const array = (
  name: string,
  label: string,
  fields: EsocialFormField[],
  maxItems: number,
  required = true
) => field(name, label, "array", { fields, required, minItems: required ? 1 : 0, maxItems });
const numbers = (...entries: [number, string][]) =>
  entries.map(([value, label]) => ({ value, label }));
const sn = [
  { value: "S", label: "Sim" },
  { value: "N", label: "Não" },
];
const ufs = ESOCIAL_UFS.map((value) => ({ value, label: value }));
const physicianFields = [
  field("nmMed", "Nome do médico", "text", { required: true }),
  field("nrCrm", "CRM"),
  select("ufCrm", "UF do CRM", ufs, false),
];
const baseSections = [
  {
    title: "Evento e empregador",
    fields: [
      select(
        "ideEvento.tpAmb",
        "Ambiente",
        numbers([2, "Produção restrita — testes"], [1, "Produção — sujeito à liberação"])
      ),
      select("ideEvento.indRetif", "Operação", numbers([1, "Evento original"], [2, "Retificação"])),
      field("ideEvento.nrRecibo", "Recibo do evento a retificar", "text", {
        showWhen: { field: "ideEvento.indRetif", values: [2] },
      }),
      select(
        "ideEmpregador.tpInsc",
        "Tipo de inscrição do empregador",
        numbers([1, "CNPJ"], [2, "CPF"])
      ),
      field("ideEmpregador.nrInsc", "Inscrição conforme S-1000", "text", {
        required: true,
        help: "CNPJ base (8 posições), CNPJ completo nos casos previstos, ou CPF. Deve corresponder ao cadastro autorizado.",
      }),
    ],
  },
  {
    title: "Trabalhador e vínculo",
    fields: [
      field("ideVinculo.cpfTrab", "CPF do trabalhador", "text", { required: true }),
      field("ideVinculo.matricula", "Matrícula no eSocial", "text", {
        help: "Use a matrícula do RET, não o ID interno do NAI.",
      }),
      select(
        "ideVinculo.codCateg",
        "Categoria de TSVE sem matrícula",
        esocialTableOptions("01").map((v) => ({ ...v, value: Number(v.value) })),
        false
      ),
    ],
  },
];
const asoFields: EsocialFormField[] = [
  field("aso.dtAso", "Data de emissão do ASO", "date", { required: true }),
  select("aso.tpAso", "Tipo de exame ocupacional", ESOCIAL_TP_ASO),
  select("aso.resAso", "Resultado do ASO (opcional)", ESOCIAL_RES_ASO, false),
  field(
    "aso.resultDisclosureAuthorized",
    "Há autorização expressa do trabalhador para indicação dos resultados dos exames",
    "checkbox"
  ),
  array(
    "aso.exames",
    "Avaliação clínica e exames do ASO",
    [
      field("dtExm", "Data do exame", "date", { required: true }),
      select("procRealizado", "Procedimento — Tabela 27", ESOCIAL_PROCEDURES),
      field("obsProc", "Observação do procedimento", "textarea"),
      select(
        "ordExame",
        "Ordem (obrigatória na audiometria)",
        numbers([1, "Inicial"], [2, "Sequencial"]),
        false
      ),
      select(
        "indResult",
        "Indicação do resultado — somente com autorização",
        ESOCIAL_IND_RESULT,
        false
      ),
    ],
    99
  ),
  group("aso.medico", "Médico emitente", physicianFields),
  group(
    "aso.medicoResp",
    "Médico responsável pelo PCMSO",
    [...physicianFields, field("cpfResp", "CPF do responsável (opcional)")],
    false
  ),
  field(
    "context.workerAbroad",
    "Endereço do trabalhador no exterior confirmado no RET",
    "checkbox"
  ),
  field(
    "context.pcmsoCoordinatorExists",
    "Existe médico responsável/coordenador pelo PCMSO",
    "checkbox"
  ),
];
const riskUnits = [
  { value: 1, label: "dose diária de ruído" },
  { value: 2, label: "decibel linear (dB (linear))" },
  { value: 3, label: "decibel (C) (dB(C))" },
  { value: 4, label: "decibel (A) (dB(A))" },
  { value: 5, label: "metro por segundo ao quadrado (m/s^^2^^)" },
  { value: 6, label: "metro por segundo elevado a 1,75 (m/s^^1,75^^)" },
  { value: 7, label: "parte de vapor ou gás por milhão de partes de ar contaminado (ppm)" },
  { value: 8, label: "miligrama por metro cúbico de ar (mg/m^^3^^)" },
  { value: 9, label: "fibra por centímetro cúbico (f/cm^^3^^)" },
  { value: 10, label: "grau Celsius (ºC)" },
  { value: 11, label: "metro por segundo (m/s)" },
  { value: 12, label: "porcentual" },
  { value: 13, label: "lux (lx)" },
  { value: 14, label: "unidade formadora de colônias por metro cúbico (ufc/m^^3^^)" },
  { value: 15, label: "dose diária" },
  { value: 16, label: "dose mensal" },
  { value: 17, label: "dose trimestral" },
  { value: 18, label: "dose anual" },
  { value: 19, label: "watt por metro quadrado (W/m^^2^^)" },
  { value: 20, label: "ampère por metro (A/m)" },
  { value: 21, label: "militesla (mT)" },
  { value: 22, label: "microtesla (μT)" },
  { value: 23, label: "miliampère (mA)" },
  { value: 24, label: "quilovolt por metro (kV/m)" },
  { value: 25, label: "volt por metro (V/m)" },
  { value: 26, label: "joule por metro quadrado (J/m^^2^^)" },
  { value: 27, label: "milijoule por centímetro quadrado (mJ/cm^^2^^)" },
  { value: 28, label: "milisievert (mSv)" },
  { value: 29, label: "milhão de partículas por decímetro cúbico (mppdc)" },
  { value: 30, label: "umidade relativa do ar (UR (%))" },
];

const catSections: EsocialEventForm["sections"] = [
  {
    title: "Acidente e CAT",
    fields: [
      field("cat.dtAcid", "Data do acidente/doença", "date", { required: true }),
      select(
        "cat.tpAcid",
        "Tipo de acidente",
        numbers([1, "Típico"], [2, "Doença profissional"], [3, "Trajeto"])
      ),
      field("cat.hrAcid", "Hora do acidente", "time"),
      field("cat.hrsTrabAntesAcid", "Horas trabalhadas antes do acidente (HHMM)", "text", {
        help: "Duração, até 99 horas. Não se aplica à doença profissional.",
      }),
      select(
        "cat.tpCat",
        "Tipo de CAT",
        numbers([1, "Inicial"], [2, "Reabertura"], [3, "Comunicação de óbito"])
      ),
      select("cat.indCatObito", "Houve óbito?", sn),
      field("cat.dtObito", "Data do óbito", "date", {
        showWhen: { field: "cat.indCatObito", values: ["S"] },
      }),
      select("cat.indComunPolicia", "Houve comunicação à polícia?", sn),
      select("cat.codSitGeradora", "Situação geradora — Tabela 15", esocialTableOptions("15")),
      select(
        "cat.iniciatCAT",
        "Iniciativa da CAT",
        numbers(
          [1, "Empregador"],
          [2, "Determinação judicial"],
          [3, "Determinação de órgão fiscalizador"]
        )
      ),
      field("cat.obsCAT", "Observações da CAT", "textarea"),
      field("cat.ultDiaTrab", "Último dia trabalhado", "date"),
      select("cat.houveAfast", "Houve afastamento?", sn, false),
      group(
        "cat.catOrigem",
        "CAT de origem — reabertura/óbito",
        [field("nrRecCatOrig", "Recibo da CAT de origem", "text", { required: true })],
        false
      ),
      select(
        "context.workerCategory",
        "Categoria do vínculo confirmada no RET (quando necessária)",
        esocialTableOptions("01").map((v) => ({ ...v, value: Number(v.value) })),
        false
      ),
    ],
  },
  {
    title: "Local do acidente",
    fields: [
      group("cat.localAcidente", "Endereço e identificação", [
        select(
          "tpLocal",
          "Tipo do local",
          numbers(
            [1, "Estabelecimento do empregador no Brasil"],
            [2, "Estabelecimento do empregador no exterior"],
            [3, "Estabelecimento de terceiros"],
            [4, "Via pública"],
            [5, "Área rural"],
            [6, "Embarcação"],
            [9, "Outros"]
          )
        ),
        field("dscLocal", "Descrição do local", "textarea"),
        select("tpLograd", "Tipo de logradouro — Tabela 20", esocialTableOptions("20"), false),
        field("dscLograd", "Logradouro", "text", { required: true }),
        field("nrLograd", "Número", "text", { required: true }),
        field("complemento", "Complemento"),
        field("bairro", "Bairro"),
        field("cep", "CEP (8 dígitos)"),
        field("codMunic", "Código IBGE do município (7 dígitos)"),
        select("uf", "UF", ufs, false),
        select("pais", "País — somente local no exterior", esocialTableOptions("06"), false),
        field("codPostal", "Código postal no exterior"),
        group(
          "ideLocalAcid",
          "Inscrição do estabelecimento/local",
          [
            select("tpInsc", "Tipo de inscrição", numbers([1, "CNPJ"], [3, "CAEPF"], [4, "CNO"])),
            field("nrInsc", "Inscrição completa", "text", { required: true }),
          ],
          false
        ),
      ]),
    ],
  },
  {
    title: "Lesão e atendimento",
    fields: [
      group("cat.parteAtingida", "Parte do corpo atingida", [
        select("codParteAting", "Parte atingida — Tabela 13", esocialTableOptions("13")),
        select(
          "lateralidade",
          "Lateralidade",
          numbers([0, "Não aplicável"], [1, "Esquerda"], [2, "Direita"], [3, "Ambas"])
        ),
      ]),
      group("cat.agenteCausador", "Agente causador", [
        select("codAgntCausador", "Agente — Tabelas 14/15", [
          ...esocialTableOptions("14"),
          ...esocialTableOptions("15"),
        ]),
      ]),
      group("cat.atestado", "Atestado médico", [
        field("dtAtendimento", "Data do atendimento", "date", { required: true }),
        field("hrAtendimento", "Hora do atendimento", "time", { required: true }),
        select("indInternacao", "Houve internação?", sn),
        field("durTrat", "Duração estimada do tratamento (dias)", "number", { required: true }),
        select("indAfast", "Deverá afastar-se durante o tratamento?", sn),
        select("dscLesao", "Natureza da lesão — Tabela 17", esocialTableOptions("17")),
        field("dscCompLesao", "Descrição complementar da lesão", "textarea"),
        field("diagProvavel", "Diagnóstico provável", "textarea"),
        field("codCID", "CID informado pelo emitente (sem ponto)", "text", { required: true }),
        field("observacao", "Observações do atestado", "textarea"),
        group("emitente", "Profissional emitente", [
          field("nmEmit", "Nome", "text", { required: true }),
          select(
            "ideOC",
            "Conselho",
            numbers([1, "CRM"], [2, "CRO"], [3, "Registro do Ministério da Saúde"])
          ),
          field("nrOC", "Número de inscrição", "text", { required: true }),
          select("ufOC", "UF do conselho", ufs, false),
        ]),
      ]),
    ],
  },
];
const riskSections: EsocialEventForm["sections"] = [
  {
    title: "Condições ambientais e exposição",
    fields: [
      field("infoExpRisco.dtIniCondicao", "Início da condição", "date", { required: true }),
      field("infoExpRisco.dtFimCondicao", "Fim da condição — trabalhador avulso", "date"),
      select(
        "context.workerCategory",
        "Categoria do vínculo confirmada no RET (obrigatória para avulso)",
        esocialTableOptions("01").map((v) => ({ ...v, value: Number(v.value) })),
        false
      ),
      array(
        "infoExpRisco.infoAmb",
        "Ambientes de trabalho",
        [
          select(
            "localAmb",
            "Local",
            numbers([1, "Estabelecimento do empregador"], [2, "Estabelecimento de terceiros"])
          ),
          field("dscSetor", "Setor", "text", { required: true }),
          select("tpInsc", "Tipo de inscrição", numbers([1, "CNPJ"], [3, "CAEPF"], [4, "CNO"])),
          field("nrInsc", "Inscrição completa", "text", { required: true }),
        ],
        9
      ),
      group("infoExpRisco.infoAtiv", "Atividades", [
        field("dscAtivDes", "Descrição das atividades desempenhadas", "textarea", {
          required: true,
        }),
      ]),
      array(
        "infoExpRisco.agNoc",
        "Agentes nocivos — Tabela 24",
        [
          select("codAgNoc", "Agente nocivo", ESOCIAL_RISK_AGENTS),
          field("dscAgNoc", "Descrição do agente (quando exigida)", "textarea"),
          select(
            "tpAval",
            "Avaliação — não preencher na ausência de exposição",
            numbers([1, "Quantitativa"], [2, "Qualitativa"]),
            false
          ),
          field("intConc", "Intensidade/concentração (decimal com ponto)"),
          field("limTol", "Limite de tolerância (quando exigido)"),
          select("unMed", "Unidade de medida", riskUnits, false),
          field("tecMedicao", "Técnica de medição"),
          field("nrProcJud", "Processo administrativo/judicial do agente 05.01.001"),
          group(
            "epcEpi",
            "EPC/EPI — obrigatório quando há agente nocivo",
            [
              select(
                "utilizEPC",
                "Utilização de EPC",
                numbers([0, "Não se aplica"], [1, "Não utilizado"], [2, "Utilizado"])
              ),
              select("eficEpc", "EPC eficaz? (se utilizado)", sn, false),
              select(
                "utilizEPI",
                "Utilização de EPI",
                numbers([0, "Não se aplica"], [1, "Não utilizado"], [2, "Utilizado"])
              ),
              select("eficEpi", "EPI eficaz? (se utilizado)", sn, false),
              array(
                "epi",
                "Documentos de avaliação dos EPIs (se utilizados)",
                [field("docAval", "CA ou documento de avaliação", "text", { required: true })],
                50,
                false
              ),
              group(
                "epiCompl",
                "Requisitos de utilização do EPI (se utilizado)",
                [
                  select(
                    "medProtecao",
                    "Medidas de proteção coletiva/administrativa consideradas?",
                    sn
                  ),
                  select("condFuncto", "Condições de funcionamento e uso observadas?", sn),
                  select("usoInint", "Uso ininterrupto observado?", sn),
                  select("przValid", "Prazo de validade observado?", sn),
                  select("periodicTroca", "Periodicidade de troca observada?", sn),
                  select("higienizacao", "Higienização observada?", sn),
                ],
                false
              ),
            ],
            false
          ),
        ],
        999
      ),
      array(
        "infoExpRisco.respReg",
        "Responsáveis pelos registros ambientais",
        [
          field("cpfResp", "CPF", "text", { required: true }),
          select("ideOC", "Conselho", numbers([1, "CRM"], [4, "CREA"], [9, "Outro"]), false),
          field("dscOC", "Descrição de outro conselho"),
          field("nrOC", "Número de inscrição"),
          select("ufOC", "UF do conselho", ufs, false),
        ],
        99
      ),
      group(
        "infoExpRisco.obs",
        "Observações complementares",
        [field("obsCompl", "Observações", "textarea", { required: true })],
        false
      ),
    ],
  },
];
const absenceSections: EsocialEventForm["sections"] = [
  {
    title: "Afastamento",
    fields: [
      field("context.celetista", "Vínculo celetista confirmado no RET", "checkbox"),
      group(
        "infoAfastamento.iniAfastamento",
        "Início do afastamento (preencher início e/ou término)",
        [
          field("dtIniAfast", "Data de início", "date", { required: true }),
          select("codMotAfast", "Motivo — Tabela 18 vigente", esocialTableOptions("18")),
          select("infoMesmoMtv", "Mesmo motivo de afastamento anterior (01/03)?", sn, false),
          select(
            "tpAcidTransito",
            "Acidente de trânsito (01/03)",
            numbers([1, "Atropelamento"], [2, "Colisão"], [3, "Outros"]),
            false
          ),
          field("observacao", "Observação", "textarea"),
          group(
            "perAquis",
            "Período aquisitivo — férias/recesso",
            [
              field("dtInicio", "Início do período", "date", { required: true }),
              field("dtFim", "Fim do período", "date"),
            ],
            false
          ),
          group(
            "infoCessao",
            "Cessão/exercício em outro órgão — motivo 14",
            [
              field("cnpjCess", "CNPJ do cessionário", "text", { required: true }),
              select(
                "infOnus",
                "Responsável pelo ônus",
                numbers([1, "Cedente"], [2, "Cessionário"], [3, "Cedente e cessionário"])
              ),
            ],
            false
          ),
          group(
            "infoMandSind",
            "Mandato sindical — motivo 24",
            [
              field("cnpjSind", "CNPJ do sindicato", "text", { required: true }),
              select(
                "infOnusRemun",
                "Responsável pela remuneração",
                numbers([1, "Empregador"], [2, "Sindicato"], [3, "Empregador e sindicato"])
              ),
            ],
            false
          ),
          group(
            "infoMandElet",
            "Mandato eletivo — motivo 22",
            [
              field("cnpjMandElet", "CNPJ do órgão", "text", { required: true }),
              select("indRemunCargo", "Optou pela remuneração do cargo efetivo?", sn, false),
            ],
            false
          ),
        ],
        false
      ),
      group(
        "infoAfastamento.fimAfastamento",
        "Término do afastamento",
        [field("dtTermAfast", "Data de término", "date", { required: true })],
        false
      ),
      group(
        "infoAfastamento.infoRetif",
        "Origem da retificação (quando aplicável)",
        [
          select(
            "origRetif",
            "Origem",
            numbers([1, "Empregador"], [2, "Revisão administrativa"], [3, "Determinação judicial"])
          ),
          select(
            "tpProc",
            "Tipo de processo/benefício",
            numbers([1, "Administrativo"], [2, "Judicial"], [3, "Número do benefício"]),
            false
          ),
          field("nrProc", "Número do processo/benefício"),
        ],
        false
      ),
    ],
  },
];
export const ESOCIAL_EVENT_FORMS: Record<EsocialEventType, EsocialEventForm> = {
  S2220: {
    title: "S-2220 · Monitoramento da saúde",
    description:
      "Transcreva os dados conferidos do ASO e dos exames. O PDF não é transmitido ao eSocial.",
    sections: [...baseSections, { title: "ASO revisado", fields: asoFields }],
  },
  S2210: {
    title: "S-2210 · Comunicação de acidente",
    description:
      "CAT com dados revisados do acidente e atendimento médico. Reabertura/óbito exigem a CAT de origem.",
    sections: [...baseSections, ...catSections],
  },
  S2240: {
    title: "S-2240 · Exposição a agentes nocivos",
    description:
      "Use a documentação ambiental revisada por responsável habilitado. Ausência de exposição deve ser declarada explicitamente pelo código oficial.",
    sections: [...baseSections, ...riskSections],
  },
  S2221: {
    title: "S-2221 · Exame toxicológico",
    description:
      "Motorista profissional empregado. A representação deve autorizar o perfil Exame Toxicológico, distinto do Grupo SST.",
    sections: [
      baseSections[0],
      {
        title: "Trabalhador e vínculo",
        fields: [
          field("ideVinculo.cpfTrab", "CPF do trabalhador", "text", { required: true }),
          field("ideVinculo.matricula", "Matrícula no RET", "text", { required: true }),
        ],
      },
      {
        title: "Exame e médico",
        fields: [
          field("toxicologico.dtExame", "Data do exame", "date", { required: true }),
          field("toxicologico.cnpjLab", "CNPJ do laboratório", "text", { required: true }),
          field(
            "toxicologico.codSeqExame",
            "Código sequencial do exame (duas letras e nove dígitos)",
            "text",
            { required: true }
          ),
          field("toxicologico.nmMed", "Nome do médico", "text", { required: true }),
          field("toxicologico.nrCRM", "CRM"),
          select("toxicologico.ufCRM", "UF do CRM", ufs, false),
          field(
            "context.workerAbroad",
            "Endereço do trabalhador no exterior confirmado no RET",
            "checkbox"
          ),
        ],
      },
    ],
  },
  S2230: {
    title: "S-2230 · Afastamento temporário",
    description:
      "Informe início e/ou término e a documentação correspondente ao motivo. A situação do vínculo e sobreposição de períodos dependem do RET.",
    sections: [...baseSections, ...absenceSections],
  },
  S3000: {
    title: "S-3000 · Exclusão de evento",
    description:
      "Referencia um evento aceito e seu recibo. Use a ação Excluir no evento original; a exclusão depende de revisão e permissão.",
    sections: [
      {
        title: "Evento e empregador",
        fields: baseSections[0].fields.filter(
          (f) => !["ideEvento.indRetif", "ideEvento.nrRecibo"].includes(f.name)
        ),
      },
      {
        title: "Evento de origem",
        fields: [
          field("ideVinculo.cpfTrab", "CPF do trabalhador do evento original", "text", {
            required: true,
          }),
          select(
            "infoExclusao.tpEvento",
            "Tipo do evento a excluir",
            ["S-2210", "S-2220", "S-2240", "S-2221", "S-2230"].map((value) => ({
              value,
              label: value,
            }))
          ),
          field("infoExclusao.nrRecEvt", "Recibo de entrega do evento a excluir", "text", {
            required: true,
          }),
        ],
      },
    ],
  },
};
export function createEsocialEventDefaults(eventType: EsocialEventType): Record<string, unknown> {
  const base = {
    eventType,
    ideEvento: { tpAmb: 2, indRetif: 1 },
    ideEmpregador: { tpInsc: 1, nrInsc: "" },
    ideVinculo: { cpfTrab: "" },
  };
  if (eventType === "S2220")
    return {
      ...base,
      aso: {
        dtAso: "",
        exames: [{ dtExm: "", procRealizado: "" }],
        medico: { nmMed: "", nrCrm: "", ufCrm: "" },
      },
    };
  if (eventType === "S2210")
    return {
      ...base,
      cat: { localAcidente: {}, parteAtingida: {}, agenteCausador: {}, atestado: { emitente: {} } },
    };
  if (eventType === "S2240")
    return { ...base, infoExpRisco: { infoAmb: [{}], infoAtiv: {}, agNoc: [{}], respReg: [{}] } };
  if (eventType === "S2221") return { ...base, toxicologico: {} };
  if (eventType === "S2230") return { ...base, infoAfastamento: { iniAfastamento: {} } };
  return { ...base, infoExclusao: {} };
}
