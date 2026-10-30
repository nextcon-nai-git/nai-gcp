import { z } from "zod";
import {
  CAMPAIGN_HEADERS,
  PRICE_HEADERS,
  PROVIDER_HEADERS,
  normalizeAvpText,
} from "./avp-periodic-control";
import { parseBrlCents } from "./avp-costs";
import type { AvpMapClinic } from "./avp-map-clinics";

export const PeriodicSourcesSchema = z
  .object({
    campaignSpreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]{20,200}$/),
    accreditationSpreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]{20,200}$/),
  })
  .strict()
  .refine(
    (v) => v.campaignSpreadsheetId !== v.accreditationSpreadsheetId,
    "Selecione duas planilhas diferentes."
  );
export type PeriodicSources = z.infer<typeof PeriodicSourcesSchema>;
export function spreadsheetIdFromUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "docs.google.com" ||
    url.username ||
    url.password
  )
    throw new Error("Use um link do Google Sheets.");
  const id = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,200})(?:\/|$)/)?.[1];
  if (!id) throw new Error("Link de planilha inválido.");
  return id;
}
const cell = (value: unknown) => String(value ?? "").trim();
function columns(row: unknown[], required: readonly string[]) {
  const normalized = row.map((v) => normalizeAvpText(cell(v)));
  return required.map((header) => {
    const key = normalizeAvpText(header);
    const index = normalized.indexOf(key);
    if (index < 0 || normalized.lastIndexOf(key) !== index)
      throw new Error("Cabeçalho ausente ou duplicado na fonte AVP.");
    return index;
  });
}
export function adaptLiveCampaign(values: unknown[][]) {
  if (values.length < 5 || values.length > 10004)
    throw new Error("Campanha vazia ou acima do limite.");
  const indexes = columns(values[3] || [], CAMPAIGN_HEADERS.slice(0, -1));
  const rows = values.slice(4).flatMap((row, i) => {
    if (!row.some((v) => cell(v))) return [];
    return [[...indexes.map((index) => cell(row[index])), String(i + 5)]];
  });
  if (!rows.length) throw new Error("Campanha sem participantes.");
  return [CAMPAIGN_HEADERS, ...rows];
}

const ACCREDITATION_HEADERS = [
  "#",
  "Cidade",
  "UF",
  "STATUS",
  "NOME DA CLÍNICA QUE TRABALHAMOS",
  "CONTATO",
  "VALOR ATUAL",
  "VALOR NEGOCIADO",
  "PRAZO DE PAGAMENTO",
  "AUTORIZADO PARA AGENDAMENTO E SINALIZADO A EQUIPE?",
  "OBSREVAÇÃO",
  "CNPJ SOC",
] as const;
export function adaptLiveAccreditation(values: unknown[][], checkedAt: string) {
  if (values.length < 3 || values.length > 10002)
    throw new Error("Credenciamento vazio ou acima do limite.");
  const indexes = columns(values[1] || [], ACCREDITATION_HEADERS);
  const clinics: AvpMapClinic[] = [];
  const providers: unknown[][] = [PROVIDER_HEADERS];
  const prices: unknown[][] = [PRICE_HEADERS];
  const ids = new Set<string>();
  values.slice(2).forEach((raw, index) => {
    if (!raw.some((v) => cell(v))) return;
    const [
      id,
      city,
      uf,
      status,
      name,
      phone,
      current,
      negotiated,
      payment,
      authorized,
      notes,
      cnpj,
    ] = indexes.map((i) => cell(raw[i]));
    if (!id || ids.has(id) || !city || !/^[A-Z]{2}$/.test(uf))
      throw new Error("Credenciamento sem ID único, município ou UF.");
    ids.add(id);
    const price = negotiated || current;
    const parsed = parseBrlCents(price);
    const cents = parsed !== null && parsed > 0 ? parsed : null;
    const reference = `Credenciamento · linha ${index + 3}`;
    const conditions = [
      notes,
      payment && `Pagamento: ${payment}`,
      `Autorização na fonte: ${authorized || "não informada"}`,
      current && `Valor atual: ${current}`,
      negotiated && `Valor negociado: ${negotiated}`,
    ]
      .filter(Boolean)
      .join(" · ");
    clinics.push({
      id: `credenciamento-${id}`,
      cidade: city,
      uf,
      nome: name || "Clínica a definir",
      identified: !!name,
      telefone: phone,
      cents: name ? cents : null,
      status,
      notes: conditions,
      source: reference,
      date: checkedAt.slice(0, 10),
    });
    if (!name) return;
    // An authorization to schedule is not proof of an active signed contract.
    providers.push([name, "", cnpj, city, uf, phone, "", "", "", "", "Não", String(index + 3)]);
    prices.push([
      name,
      `${city}/${uf}`,
      cents === null ? "" : cents / 100,
      "ASO clínico",
      "Credenciamento atual",
      checkedAt.slice(0, 10),
      "",
      reference,
      cnpj,
      conditions,
      String(index + 3),
    ]);
  });
  if (!clinics.length) throw new Error("Credenciamento sem municípios.");
  return { clinics, providers, prices };
}
