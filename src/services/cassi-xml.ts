import "server-only";
import { createHash, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CassiGuideData } from "@/lib/cassi-automation";
import { badRequest } from "@/lib/auth/errors";
const base = "nai-tiss:///04.01.00/";
async function createValidator() {
  const lib = await import("libxml2-wasm");
  const names = [
    "tissV4_01_00.xsd",
    "tissAssinaturaDigital_v1.01.xsd",
    "tissComplexTypesV4_01_00.xsd",
    "tissSimpleTypesV4_01_00.xsd",
    "tissGuiasV4_01_00.xsd",
    "xmldsig-core-schema.xsd",
  ];
  const buffers = Object.fromEntries(
    await Promise.all(
      names.map(async (n) => [
        base + n,
        await readFile(path.join(process.cwd(), "assets", "tiss", "04.01.00", n)),
      ])
    )
  );
  if (!lib.xmlRegisterInputProvider(new lib.XmlBufferInputProvider(buffers)))
    throw Error("XSD indisponível.");
  const schema = lib.XmlDocument.fromBuffer(buffers[base + names[0]], {
    url: base + names[0],
    option: lib.ParseOption.XML_PARSE_NONET,
  });
  try {
    return { lib, validator: lib.XsdValidator.fromDoc(schema) };
  } finally {
    schema.dispose();
  }
}
let validation: ReturnType<typeof createValidator> | undefined;
const uf: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};
const council: Record<string, string> = { CRM: "06", CREFITO: "05", COREN: "03", CRP: "10" };
export async function generateCassiXml(
  g: CassiGuideData,
  extra: Record<string, string>,
  now = new Date()
) {
  if (
    !g ||
    typeof g !== "object" ||
    !extra ||
    typeof extra !== "object" ||
    Array.isArray(extra) ||
    Object.values(extra).some((v) => typeof v !== "string") ||
    !Array.isArray(g.procedures) ||
    !g.procedures.length ||
    g.procedures.length > 1000 ||
    !["SP_SADT", "INTERNACAO", "HONORARIOS"].includes(g.guideType)
  )
    throw badRequest("Tipo de guia ou procedimentos inválidos.");
  if (g.otherExpenses?.length || g.attachments?.length)
    throw badRequest("Despesas e anexos precisam de revisão antes da exportação.");
  const esc = (v: string) =>
    v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const wrap = (k: string, v: string) => `<ans:${k}>${v}</ans:${k}>`;
  const tag = (k: string, v: unknown) => {
    if (
      (typeof v !== "string" && typeof v !== "number") ||
      !String(v).trim() ||
      /[^\x20-\xff]/.test(String(v))
    )
      throw badRequest("Confira o campo TISS " + k + ".");
    return wrap(k, esc(String(v).trim()));
  };
  const code = (v: string) => String(v || "").split(" ")[0];
  const pro = (k: string, final = "CBOS") =>
    tag(k, g.requesterName) +
    tag(
      k === "nomeProf" ? "conselho" : "conselhoProfissional",
      council[g.requesterCouncilType] || g.requesterCouncilType
    ) +
    tag("numeroConselhoProfissional", g.requesterCouncilNumber) +
    tag("UF", uf[g.requesterCouncilUf] || g.requesterCouncilUf) +
    tag(final, g.requesterCbo);
  const provider = tag("codigoPrestadorNaOperadora", g.operatorCode);
  const hg = wrap(
    "cabecalhoGuia",
    tag("registroANS", "346659") + tag("numeroGuiaPrestador", g.providerGuideNumber)
  );
  const person =
    tag("numeroCarteira", g.beneficiaryCardNumber) +
    tag("atendimentoRN", g.isNewbornCare ? "S" : "N");
  const exec = wrap(
    "dadosExecutante",
    wrap("contratadoExecutante", provider) + tag("CNES", g.cnesCode)
  );
  const authorize = wrap(
    "dadosAutorizacao",
    tag("dataAutorizacao", g.authorizationDate) +
      tag("senha", g.authorizationNumber) +
      (g.passwordValidity ? tag("dataValidadeSenha", g.passwordValidity) : "")
  );
  let cents = 0;
  const items = g.procedures
    .map((p, i) => {
      if (
        !p ||
        typeof p !== "object" ||
        (p.reductionFactor != null && p.reductionFactor !== 1) ||
        !Number.isInteger(p.quantity) ||
        p.quantity < 1 ||
        !Number.isFinite(p.unitValue) ||
        p.unitValue < 0 ||
        !Number.isFinite(p.totalValue) ||
        Math.round(p.totalValue * 100) !== Math.round(p.unitValue * 100) * p.quantity
      )
        throw badRequest("Confira as quantidades e valores dos procedimentos.");
      cents += Math.round(p.totalValue * 100);
      let fields =
        tag("sequencialItem", i + 1) +
        tag("dataExecucao", p.date) +
        wrap(
          "procedimento",
          tag("codigoTabela", "22") +
            tag("codigoProcedimento", p.code) +
            tag("descricaoProcedimento", p.description)
        ) +
        tag("quantidadeExecutada", p.quantity) +
        tag("reducaoAcrescimo", (p.reductionFactor ?? 1).toFixed(2)) +
        tag("valorUnitario", p.unitValue.toFixed(2)) +
        tag("valorTotal", p.totalValue.toFixed(2));
      if (g.guideType === "HONORARIOS")
        fields += wrap(
          "profissionais",
          tag("grauParticipacao", extra.participation) +
            wrap("codProfissional", tag("codigoPrestadorNaOperadora", extra.professionalCode)) +
            pro("nomeProfissional", "CBO")
        );
      return wrap(
        g.guideType === "HONORARIOS" ? "procedimentoRealizado" : "procedimentoExecutado",
        fields
      );
    })
    .join("");
  if (Math.round(g.totalGuideValue * 100) !== cents) throw badRequest("Total da guia divergente.");
  const total = (cents / 100).toFixed(2),
    totals = wrap("valorTotal", tag("valorProcedimentos", total) + tag("valorTotalGeral", total));
  let guide: string;
  if (g.guideType === "SP_SADT")
    guide = wrap(
      "guiaSP-SADT",
      hg +
        authorize +
        wrap("dadosBeneficiario", person) +
        wrap(
          "dadosSolicitante",
          wrap("contratadoSolicitante", tag("codigoPrestadorNaOperadora", extra.requesterCode)) +
            tag("nomeContratadoSolicitante", extra.requesterUnit) +
            wrap("profissionalSolicitante", pro("nomeProfissional"))
        ) +
        wrap("dadosSolicitacao", tag("caraterAtendimento", g.careCharacter)) +
        exec +
        wrap(
          "dadosAtendimento",
          tag("tipoAtendimento", code(g.attendanceType)) +
            tag("indicacaoAcidente", extra.accident) +
            tag("regimeAtendimento", extra.regime)
        ) +
        wrap("procedimentosExecutados", items) +
        totals
    );
  else {
    if (
      !extra.start ||
      !extra.end ||
      extra.start > extra.end ||
      (g.guideType === "INTERNACAO" &&
        extra.start === extra.end &&
        extra.startTime > extra.endTime) ||
      g.procedures.some((p) => p.date < extra.start || p.date > extra.end)
    )
      throw badRequest("Confira o período de faturamento e as datas dos procedimentos.");
    if (g.guideType === "INTERNACAO")
      guide = wrap(
        "guiaResumoInternacao",
        hg +
          tag("numeroGuiaSolicitacaoInternacao", extra.admissionGuide) +
          authorize +
          wrap("dadosBeneficiario", person) +
          exec +
          wrap(
            "dadosInternacao",
            tag("caraterAtendimento", g.careCharacter) +
              tag("tipoFaturamento", extra.billing) +
              tag("dataInicioFaturamento", extra.start) +
              tag("horaInicioFaturamento", extra.startTime) +
              tag("dataFinalFaturamento", extra.end) +
              tag("horaFinalFaturamento", extra.endTime) +
              tag("tipoInternacao", extra.admissionType) +
              tag("regimeInternacao", extra.admissionRegime)
          ) +
          wrap(
            "dadosSaidaInternacao",
            (g.primaryCid ? tag("diagnostico", g.primaryCid) : "") +
              tag("indicadorAcidente", extra.accident) +
              tag("motivoEncerramento", extra.endReason)
          ) +
          wrap("procedimentosExecutados", items) +
          totals
      );
    else
      guide = wrap(
        "guiaHonorarios",
        hg +
          tag("guiaSolicInternacao", extra.admissionGuide) +
          tag("senha", g.authorizationNumber) +
          wrap("beneficiario", person) +
          wrap(
            "localContratado",
            wrap("codigoContratado", tag("codigoNaOperadora", extra.siteCode)) +
              tag("nomeContratado", extra.siteName) +
              tag("cnes", extra.siteCnes)
          ) +
          wrap(
            "dadosContratadoExecutante",
            tag("codigonaOperadora", g.operatorCode) + tag("cnesContratadoExecutante", g.cnesCode)
          ) +
          wrap(
            "dadosInternacao",
            tag("dataInicioFaturamento", extra.start) + tag("dataFimFaturamento", extra.end)
          ) +
          wrap("procedimentosRealizados", items) +
          tag("valorTotalHonorarios", total) +
          tag("dataEmissaoGuia", extra.issued)
      );
  }
  const seq = String(randomInt(100000000000, 999999999999));
  const time = now.toISOString(),
    header = wrap(
      "cabecalho",
      wrap(
        "identificacaoTransacao",
        tag("tipoTransacao", "ENVIO_LOTE_GUIAS") +
          tag("sequencialTransacao", seq) +
          tag("dataRegistroTransacao", time.slice(0, 10)) +
          tag("horaRegistroTransacao", time.slice(11, 19))
      ) +
        wrap("origem", wrap("identificacaoPrestador", provider)) +
        wrap("destino", tag("registroANS", "346659")) +
        tag("Padrao", "4.01.00")
    );
  const body =
    header +
    wrap(
      "prestadorParaOperadora",
      wrap("loteGuias", tag("numeroLote", seq) + wrap("guiasTISS", guide))
    );
  const digest = createHash("md5")
    .update(
      body
        .replace(/<[^>]*>/g, "")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&"),
      "latin1"
    )
    .digest("hex");
  const xml =
    '<?xml version="1.0" encoding="ISO-8859-1"?><ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas">' +
    body +
    wrap("epilogo", tag("hash", digest)) +
    "</ans:mensagemTISS>";
  validation ??= createValidator().catch((e) => {
    validation = undefined;
    throw e;
  });
  const { lib, validator } = await validation;
  const bytes = Buffer.from(xml, "latin1");
  const doc = lib.XmlDocument.fromBuffer(bytes, { option: lib.ParseOption.XML_PARSE_NONET });
  try {
    validator.validate(doc);
  } catch {
    throw badRequest(
      "O XSD TISS 04.01.00 recusou a guia. Confira os códigos, datas e identificadores informados."
    );
  } finally {
    doc.dispose();
  }
  return bytes;
}
