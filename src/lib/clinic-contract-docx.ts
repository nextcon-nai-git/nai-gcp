import JSZip from "jszip";
import { createHash, randomUUID } from "node:crypto";
import {
  CLINIC_CONTRACT_HASH,
  DOCX_TYPE,
  ClinicContractFieldsSchema,
  type ClinicContractFields,
} from "./clinic-contract";

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const decodeXml = (s: string) =>
  s.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, numeric, named) =>
    numeric
      ? String.fromCodePoint(
          numeric[0].toLowerCase() === "x" ? parseInt(numeric.slice(1), 16) : Number(numeric)
        )
      : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[named as string] || ""
  );

/** Replace exact placeholders even when Word splits them across styled runs. */
export function replaceDocxFields(xml: string, replacements: Record<string, string>) {
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const runs = [...paragraph.matchAll(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g)];
    const texts = runs.map((r) => decodeXml(r[2]));
    for (const [token, value] of Object.entries(replacements)) {
      if (!value) continue;
      const combined = texts.join("");
      const positions = [
        ...combined.matchAll(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")),
      ].map((m) => m.index!);
      for (const start of positions.reverse()) {
        const end = start + token.length;
        let offset = 0;
        for (let i = 0; i < texts.length; i++) {
          const old = texts[i],
            next = offset + old.length;
          if (offset < end && next > start) {
            texts[i] =
              old.slice(0, Math.max(0, start - offset)) +
              (offset <= start ? value : "") +
              old.slice(Math.min(old.length, end - offset));
          }
          offset = next;
        }
      }
    }
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      paragraph =
        paragraph.slice(0, r.index!) +
        r[1] +
        escapeXml(texts[i]) +
        r[3] +
        paragraph.slice(r.index! + r[0].length);
    }
    return paragraph;
  });
}

export function templateMatches(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex") === CLINIC_CONTRACT_HASH;
}

export async function generateClinicContract(source: Buffer, rawFields: ClinicContractFields) {
  if (!templateMatches(source)) throw new Error("O modelo não corresponde à versão cadastrada.");
  const f = ClinicContractFieldsSchema.parse(rawFields);
  const zip = await JSZip.loadAsync(source);
  const xml = await zip.file("word/document.xml")!.async("string");
  const val = (s: string, placeholder: string) => s || placeholder;
  const replacements: Record<string, string> = {
    "[___/2026]": f.contractNumber,
    "[RAZÃO SOCIAL DA CLÍNICA]": f.legalName,
    "[__.___.___/____-__]": f.cnpj,
    "[endereço completo]": f.address,
    "[Município/UF]": f.cityUf,
    "[município(s)/UF]": f.cityUf,
    "[_____-___]": f.postalCode,
    "[e-mail CREDENCIADA]": f.email,
    "[e-mail NEXTCON]": f.nextconEmail,
    "[nome], [cargo], CPF nº [___.___.___-__]": `${val(f.representative, "[nome]")}, ${val(f.representativeRole, "[cargo]")}, CPF nº ${val(f.representativeCpf, "[___.___.___-__]")}`,
    "[Nome do representante]": f.representative,
    "[cargo]": f.representativeRole,
    "CRM-PJ nº [______] · CNES nº [______]": `CRM-PJ nº ${val(f.crmPj, "[CRM-PJ]")} · CNES nº ${val(f.cnes, "[CNES]")}`,
    "Dr(a). [nome], CRM/[UF] nº [______]": `Dr(a). ${val(f.rtName, "[nome RT]")}, CRM/${val(f.rtUf, "[UF RT]")} nº ${val(f.rtCrm, "[CRM RT]")}`,
    "[nome], [e-mail/telefone]": `${val(f.lgpdName, "[nome LGPD]")}, ${val(f.lgpdContact, "[contato LGPD]")}`,
    "[e-mail/plataforma]": f.deliveryChannel,
  };
  const filled = replaceDocxFields(xml, replacements);
  // Draft status is explicit in the file itself; generating never grants approval or signature.
  const draft =
    '<w:p><w:r><w:rPr><w:b/><w:color w:val="9C2F00"/></w:rPr><w:t>MINUTA PARA REVISÃO — preencher pendências e aprovar antes de enviar ou assinar</w:t></w:r></w:p>';
  zip.file("word/document.xml", filled.replace("<w:body>", "<w:body>" + draft));
  const text = [...filled.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
    .map((p) =>
      [...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((t) => decodeXml(t[1])).join("")
    )
    .join("\n");
  const pending = [...new Set(text.match(/\[[^\]\r\n]+\]/g) || [])];
  return {
    bytes: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    text,
    pending,
  };
}

export function contractEmailDraft(docx: Buffer, fields: ClinicContractFields) {
  const f = ClinicContractFieldsSchema.parse(fields);
  if (!f.email) throw new Error("Informe um destinatário para preparar o rascunho.");
  const base64 = (s: Buffer | string) =>
    Buffer.from(s)
      .toString("base64")
      .match(/.{1,76}/g)!
      .join("\r\n");
  const boundary = `nai-${randomUUID()}`;
  const subject = "Minuta de credenciamento NEXTCON para revisão";
  const body = `Olá, ${f.legalName || "equipe da clínica"}.\n\nSegue a minuta de credenciamento para análise e negociação. A proposta padrão é R$ 30,00 por exame clínico ocupacional, pagamento em até 30 dias do recebimento da nota fiscal e entregas conforme as cláusulas 7 e 10.\n\nOs dados cadastrais, os campos pendentes e a tabela de exames complementares deverão ser conferidos e preenchidos antes da assinatura. Este envio de minuta não representa contratação concluída.\n\nAtenciosamente,\nEquipe NEXTCON`;
  return [
    "X-Unsent: 1",
    `To: ${f.email}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(body),
    `--${boundary}`,
    `Content-Type: ${DOCX_TYPE}`,
    'Content-Disposition: attachment; filename="Minuta_Credenciamento_NEXTCON.docx"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(docx),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
