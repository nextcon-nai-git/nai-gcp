import { z } from "zod";

/** Event contents follow the official S-1.3 XSD in tests/fixtures/esocial/s-1.3-20260701. */
const xml = (value: string | number) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const digits = z.string().transform((value) => value.replace(/[.\-/\s]/g, ""));
const registration = z.string().transform((value) => value.replace(/[.\-/\s]/g, "").toUpperCase());
const cpf = digits.pipe(z.string().regex(/^\d{11}$/));
const uf = z.enum([
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
]);
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const crm = text(1, 14)
  .transform((value) => value.replace(/\/[A-Z]{2}$/, ""))
  .pipe(text(1, 10));
const physician = z.object({ nmMed: text(2, 70), nrCrm: crm, ufCrm: uf });
const exam = z
  .object({
    dtExm: date,
    procRealizado: z.string().regex(/^\d{4}$/),
    obsProc: text(1, 999).optional(),
    ordExame: z.union([z.literal(1), z.literal(2)]).optional(),
  })
  .superRefine((item, ctx) => {
    if (
      [
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
      ].includes(item.procRealizado) &&
      !item.obsProc
    )
      ctx.addIssue({
        code: "custom",
        message: "Informe a observação do procedimento diagnóstico.",
        path: ["obsProc"],
      });
    if (item.procRealizado === "0281" && !item.ordExame)
      ctx.addIssue({
        code: "custom",
        message: "Informe a ordem da audiometria.",
        path: ["ordExame"],
      });
  });
export const S2220Input = z
  .object({
    id: z.string().regex(/^ID[12][A-Z0-9]{12}\d{21}$/),
    ideEmpregador: z.object({
      tpInsc: z.union([z.literal(1), z.literal(2)]),
      nrInsc: registration.pipe(z.string().regex(/^(?:[A-Z0-9]{8}|\d{11}|[A-Z0-9]{12}\d{2})$/)),
    }),
    ideTrabalhador: z.object({
      cpfTrab: cpf,
      matricula: text(1, 30).optional(),
      codCateg: z.number().int().min(100).max(999).optional(),
    }),
    aso: z.object({
      dtAso: date,
      tpAso: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(9),
      ]),
      resAso: z.union([z.literal(1), z.literal(2)]).optional(),
      exames: z.array(exam).min(1).max(99),
      medico: physician,
      medicoResp: z
        .object({ nmMed: text(2, 70), nrCrm: crm, ufCrm: uf, cpfResp: cpf.optional() })
        .optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (Boolean(data.ideTrabalhador.matricula) === Boolean(data.ideTrabalhador.codCateg))
      ctx.addIssue({
        code: "custom",
        message: "Informe a matrícula ou, para TSVE sem matrícula, a categoria.",
        path: ["ideTrabalhador"],
      });
    const reg = data.ideEmpregador.nrInsc;
    if (
      (data.ideEmpregador.tpInsc === 2 && !/^\d{11}$/.test(reg)) ||
      (data.ideEmpregador.tpInsc === 1 && !/^(?:[A-Z0-9]{8}|[A-Z0-9]{12}\d{2})$/.test(reg))
    )
      ctx.addIssue({
        code: "custom",
        message: "Tipo de inscrição não corresponde ao documento do empregador.",
      });
    if (data.id[2] !== String(data.ideEmpregador.tpInsc))
      ctx.addIssue({
        code: "custom",
        message: "Identificador de evento incompatível com o empregador.",
      });
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (data.aso.dtAso > today || data.aso.exames.some((item) => item.dtExm > data.aso.dtAso))
      ctx.addIssue({
        code: "custom",
        message: "As datas dos exames e do ASO precisam corresponder a eventos já realizados.",
      });
  });

/** Unsigned draft only. This function neither signs nor transmits an event. */
export function buildS2220Xml(input: unknown): string {
  const parsed = S2220Input.safeParse(input);
  if (!parsed.success)
    throw new Error(
      `Dados do S-2220 incompletos ou inválidos: ${parsed.error.issues[0]?.message || "revise o ASO"}`
    );
  const data = parsed.data;
  const link = data.ideTrabalhador;
  const exams = data.aso.exames
    .map(
      (item) => `
        <exame>
          <dtExm>${xml(item.dtExm)}</dtExm>
          <procRealizado>${xml(item.procRealizado)}</procRealizado>
          ${item.obsProc ? `<obsProc>${xml(item.obsProc)}</obsProc>` : ""}
          ${item.ordExame ? `<ordExame>${item.ordExame}</ordExame>` : ""}
        </exame>`
    )
    .join("");
  const resp = data.aso.medicoResp;
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00">
  <evtMonit Id="${xml(data.id)}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>NAI_SST_S1.3</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>${data.ideEmpregador.tpInsc}</tpInsc>
      <nrInsc>${xml(data.ideEmpregador.nrInsc)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${xml(link.cpfTrab)}</cpfTrab>
      ${link.matricula ? `<matricula>${xml(link.matricula)}</matricula>` : `<codCateg>${link.codCateg}</codCateg>`}
    </ideVinculo>
    <exMedOcup>
      <tpExameOcup>${data.aso.tpAso}</tpExameOcup>
      <aso>
        <dtAso>${xml(data.aso.dtAso)}</dtAso>
        ${data.aso.resAso ? `<resAso>${data.aso.resAso}</resAso>` : ""}
        ${exams}
        <medico>
          <nmMed>${xml(data.aso.medico.nmMed)}</nmMed>
          <nrCRM>${xml(data.aso.medico.nrCrm)}</nrCRM>
          <ufCRM>${xml(data.aso.medico.ufCrm)}</ufCRM>
        </medico>
      </aso>
      ${
        resp
          ? `<respMonit>
        ${resp.cpfResp ? `<cpfResp>${xml(resp.cpfResp)}</cpfResp>` : ""}
        <nmResp>${xml(resp.nmMed)}</nmResp>
        <nrCRM>${xml(resp.nrCrm)}</nrCRM>
        <ufCRM>${xml(resp.ufCrm)}</ufCRM>
      </respMonit>`
          : ""
      }
    </exMedOcup>
  </evtMonit>
</eSocial>`;
}
