import JSZip from "jszip";
import Papa from "papaparse";
import { z } from "zod";
import { BRITANIA_CNPJS } from "./britania-group";

const text = z.string().max(600);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
export const fapCaseSchema = z
  .object({
    key: z.string().regex(/^\d{11}$/),
    name: text.min(3),
    sourceCnpj: z.enum(BRITANIA_CNPJS),
    reportedCnpjs: z.array(z.enum(BRITANIA_CNPJS)).max(8),
    sourcePath: z.string().max(400),
    hasRegistration: z.boolean(),
    registration: text,
    jobTitles: z.array(text).max(50),
    department: text,
    admission: date,
    termination: date,
    benefits: text,
    dib: text,
    ddb: text,
    cost: z.number().nonnegative().nullable(),
    alerts: text,
    rhNotes: text,
    leaves: z
      .array(
        z
          .object({
            start: date,
            end: date,
            reason: text,
            category: z.enum(["atestado", "covid", "previdenciario", "administrativo", "outro"]),
          })
          .strict()
      )
      .max(1500),
  })
  .strict();
export const fapDossierSchema = z
  .object({
    version: z.literal(1),
    sourceName: z.string().max(200),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    controlName: z.string().max(200),
    controlSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .or(z.literal("")),
    cases: z.array(fapCaseSchema).min(1).max(200),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (new Set(d.cases.map((c) => c.key)).size !== d.cases.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF repetido; revisar vínculos antes de importar.",
      });
  });
export type FapCase = z.infer<typeof fapCaseSchema>;
export type FapDossier = z.infer<typeof fapDossierSchema>;
export function isoDate(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().startsWith(iso) ? iso : null;
}
export function parseRegistration(text: string) {
  const cnpjs = [
    ...new Set(
      [...text.matchAll(/C\.N\.P\.J\.:\s*([\d./-]+)/g)].map((m) => m[1].replace(/\D/g, ""))
    ),
  ];
  if (cnpjs.some((c) => !BRITANIA_CNPJS.some((allowed) => allowed === c)))
    throw new Error("Ficha contém CNPJ fora do grupo; revisar o pacote.");
  const leaves: FapCase["leaves"] = [];
  let inHistory = false;
  for (const line of text.split(/\r?\n/)) {
    if (/Hist.rico de Afastamento/i.test(line)) inHistory = true;
    else if (/^\+[-]+[^+]*[A-Za-zÀ-ÿ][^+]*[-]+\+$/.test(line)) inHistory = false;
    if (!inHistory) continue;
    const m = /^\|\s+(\d{2}\/\d{2}\/\d{4})\s+(?:(\d{2}\/\d{2}\/\d{4})\s+)?(.+?)\s*\|?$/.exec(line);
    if (!m) continue;
    const reason = m[3].replace(/\|$/, "").trim();
    const category = /COVID/i.test(reason)
      ? "covid"
      : /ATESTADO/i.test(reason)
        ? "atestado"
        : /INSS|PREVID|ACIDENTE|DOEN[ÇC]A/i.test(reason)
          ? "previdenciario"
          : /ABONO|FALTA|SUSPENS|TRANSFER|LICEN|COMPENSA/i.test(reason)
            ? "administrativo"
            : "outro";
    leaves.push({ start: isoDate(m[1]), end: m[2] ? isoDate(m[2]) : null, reason, category });
  }
  return {
    reportedCnpjs: cnpjs,
    leaves,
    registration: /Matr.cula:\s*([\d-]+)/.exec(text)?.[1] || "",
    name: /Matr.cula:\s*[\d-]+\s+([^|\r\n]+)/.exec(text)?.[1].trim() || "",
    jobTitles: [
      ...new Set(
        [...text.matchAll(/Cargo\/N.vel:\s*[\d.]+\s+\d+\s+([^|\r\n]+)/g)].map((m) => m[1].trim())
      ),
    ],
    department: /Unid Lota..o:\s*\d+\s+([^|\r\n]+)/.exec(text)?.[1].trim() || "",
    admission: isoDate(/Data Admiss.o:\s*([\d/]+)/.exec(text)?.[1] || ""),
    termination: isoDate(/Data Desl\.:\s*([\d/]+)/.exec(text)?.[1] || ""),
  };
}
async function hash(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
/** Parse locally; never submit raw HR text or unrelated personal/financial fields. */
export async function readBritaniaDossier(
  zipBytes: ArrayBuffer,
  sourceName: string,
  controlBytes?: ArrayBuffer,
  controlName = ""
): Promise<FapDossier> {
  if (zipBytes.byteLength > 10 * 1024 * 1024 || (controlBytes?.byteLength || 0) > 2 * 1024 * 1024)
    throw new Error("Pacote excede o limite de importação.");
  // Validate central-directory sizes before JSZip inflates any entry.
  const view = new DataView(zipBytes);
  let end = -1;
  for (let i = zipBytes.byteLength - 22; i >= Math.max(0, zipBytes.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error("ZIP inválido ou dividido em volumes.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    total = 0;
  if (count > 2000 || offset === 0xffffffff) throw new Error("ZIP excede o limite.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Diretório ZIP inválido.");
    const size = view.getUint32(offset + 24, true);
    total += size;
    if (view.getUint16(offset + 8, true) & 1 || size > 500000 || total > 8 * 1024 * 1024)
      throw new Error("ZIP protegido ou conteúdo descompactado acima do limite.");
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  const decode = (bytes: Uint8Array) => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  };
  const control = new Map<string, string[]>();
  if (controlBytes) {
    const rows = Papa.parse<string[]>(decode(new Uint8Array(controlBytes)), {
      delimiter: ";",
      skipEmptyLines: true,
    }).data;
    const header = rows.findIndex((r) => r[0] === "CNPJ" && r[2] === "Nome do Colaborador");
    if (header < 0) throw new Error("Cabeçalho do controle FAP não encontrado.");
    for (const row of rows.slice(header + 1)) {
      const cpf = (row[4] || "").replace(/\D/g, "");
      if (!cpf) continue;
      if (control.has(cpf)) throw new Error("Controle contém CPF duplicado.");
      control.set(cpf, row);
    }
  }
  const zip = await JSZip.loadAsync(zipBytes);
  if (Object.keys(zip.files).length > 2000) throw new Error("Quantidade de arquivos excedida.");
  const cases = new Map<string, FapCase>();
  let expanded = 0;
  for (const file of Object.values(zip.files)) {
    if (file.dir || !/\.txt$/i.test(file.name)) continue;
    const m = /\/(\d{8}-\d{4}-\d{2})\/[^/]*?(\d{3}\.\d{3}\.\d{3}-\d{2})\//.exec(file.name);
    if (!m) continue;
    const cnpj = m[1].replace(/\D/g, ""),
      key = m[2].replace(/\D/g, "");
    if (!BRITANIA_CNPJS.some((c) => c === cnpj)) throw new Error("Pasta fora do grupo Britânia.");
    const prior = cases.get(key);
    if (prior && prior.sourceCnpj !== cnpj)
      throw new Error("CPF em múltiplas sedes; conciliar vínculos antes de importar.");
    const row = control.get(key);
    const item =
      prior ||
      ({
        key,
        name: row?.[2]?.trim() || "Colaborador a identificar",
        sourceCnpj: cnpj,
        reportedCnpjs: [],
        sourcePath: file.name.split("/").slice(0, 3).join("/"),
        hasRegistration: false,
        registration: row?.[3] || "",
        jobTitles: [],
        department: "",
        admission: null,
        termination: null,
        benefits: row?.[6] || "",
        dib: row?.[7] || "",
        ddb: row?.[8] || "",
        cost: row?.[9]?.includes("R$")
          ? Number(row[9].replace(/[^\d,]/g, "").replace(",", "."))
          : null,
        alerts: row?.[10] || "",
        rhNotes: row?.[24] || "",
        leaves: [],
      } as FapCase);
    if (/\/01_Ficha_de_registro\//.test(file.name)) {
      if (item.hasRegistration) throw new Error("Mais de uma ficha por CPF; revisar versões.");
      const bytes = await file.async("uint8array");
      expanded += bytes.byteLength;
      if (bytes.byteLength > 500000 || expanded > 8 * 1024 * 1024)
        throw new Error("Conteúdo descompactado excede o limite.");
      const raw = decode(bytes);
      const parsed = parseRegistration(raw);
      const cpfInText = /(?:C\.P\.F\.|IdPessoaFisica):\s*([\d.-]+)/
        .exec(raw)?.[1]
        .replace(/\D/g, "");
      if (cpfInText !== key) throw new Error("CPF da ficha não corresponde à pasta.");
      Object.assign(item, parsed, {
        name: row?.[2]?.trim() || parsed.name || item.name,
        hasRegistration: true,
        sourcePath: file.name,
      });
    }
    cases.set(key, item);
  }
  if (
    control.size &&
    (cases.size !== control.size || [...control.keys()].some((k) => !cases.has(k)))
  )
    throw new Error("Pacote e controle não contêm os mesmos colaboradores.");
  return fapDossierSchema.parse({
    version: 1,
    sourceName,
    sha256: await hash(zipBytes),
    controlName,
    controlSha256: controlBytes ? await hash(controlBytes) : "",
    cases: [...cases.values()],
  });
}
