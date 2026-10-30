import "server-only";
import { auth as googleAuth, sheets as googleSheets } from "googleapis/build/src/apis/sheets";
import { adminDb } from "@/lib/firebase-admin";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { AVP_PERIODIC_TABS, buildAvpPeriodicControl } from "@/lib/avp-periodic-control";
import {
  adaptLiveCampaign,
  adaptLiveAccreditation,
  type PeriodicSources,
} from "@/lib/avp-periodic-live";

export async function getAvpReaderEmail() {
  const auth = new googleAuth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const credentials = await auth.getCredentials();
  return credentials.client_email || null;
}

export async function readAvpPeriodicControl(sources?: PeriodicSources) {
  const auth = new googleAuth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = googleSheets({ version: "v4", auth });
  const [metadata, providers] = await Promise.all([
    sheets.spreadsheets.get(
      { spreadsheetId: AVP_SOURCE.spreadsheetId, fields: "sheets.properties" },
      { timeout: 20000 }
    ),
    adminDb.collection("providers").limit(5001).get(),
  ]);
  const specs: Array<readonly [string, number, string, number]> = [
    ...(sources ? [] : [[AVP_PERIODIC_TABS.campaign, 2026102001, "AE", 31] as const]),
    [AVP_PERIODIC_TABS.providers, 2026102002, "L", 12],
    [AVP_PERIODIC_TABS.prices, 2026102003, "K", 11],
  ];
  const ranges = specs.map(([title, id, last, width]) => {
    const sheet = metadata.data.sheets?.find((s) => s.properties?.sheetId === id)?.properties;
    const grid = sheet?.gridProperties;
    if (
      sheet?.title !== title ||
      !grid?.rowCount ||
      grid.rowCount > 10001 ||
      (grid.columnCount || 0) < width
    )
      throw new Error("Confira as três abas privadas da campanha AVP.");
    return `'${title}'!A1:${last}${grid.rowCount}`;
  });
  const result = await sheets.spreadsheets.values.batchGet(
    { spreadsheetId: AVP_SOURCE.spreadsheetId, ranges, valueRenderOption: "FORMATTED_VALUE" },
    { timeout: 25000 }
  );
  if (providers.size > 5000) throw new Error("Cadastro de prestadores excede o limite de leitura.");
  const values = result.data.valueRanges;
  if (values?.length !== specs.length) throw new Error("Fontes AVP incompletas.");
  async function readLiveTab(spreadsheetId: string, title: string, width: number) {
    const metadata = await sheets.spreadsheets.get(
      { spreadsheetId, fields: "sheets.properties" },
      { timeout: 20000 }
    );
    const sheet = metadata.data.sheets?.find((s) => s.properties?.title === title)?.properties;
    const grid = sheet?.gridProperties;
    const columnCount = grid?.columnCount || 0;
    if (!grid?.rowCount || grid.rowCount > 10000 || columnCount < width || columnCount > 256)
      throw new Error("Aba da campanha ou do credenciamento não encontrada ou fora dos limites.");
    let last = "";
    for (let n = columnCount; n > 0; n = Math.floor((n - 1) / 26))
      last = String.fromCharCode(65 + ((n - 1) % 26)) + last;
    const result = await sheets.spreadsheets.values.get(
      {
        spreadsheetId,
        range: `'${title}'!A1:${last}${grid.rowCount}`,
        valueRenderOption: "FORMATTED_VALUE",
      },
      { timeout: 25000 }
    );
    return result.data.values || [];
  }
  const checkedAt = new Date().toISOString();
  const live = sources
    ? await Promise.all([
        readLiveTab(sources.campaignSpreadsheetId, "Controle", 32),
        readLiveTab(sources.accreditationSpreadsheetId, "NAI Credenciamento", 24),
      ])
    : null;
  const accreditation = live ? adaptLiveAccreditation(live[1], checkedAt) : null;
  const offset = sources ? 0 : 1;
  const control = buildAvpPeriodicControl(
    live ? adaptLiveCampaign(live[0]) : values[0].values || [],
    [...(values[offset].values || []), ...(accreditation?.providers.slice(1) || [])],
    [...(values[offset + 1].values || []), ...(accreditation?.prices.slice(1) || [])],
    providers.docs.map((d) => {
      const p = d.data();
      return {
        name: typeof p.name === "string" ? p.name : "",
        type: typeof p.type === "string" && p.isDeleted !== true ? p.type : "",
        phone: typeof p.phone === "string" ? p.phone : "",
        email: typeof p.email === "string" ? p.email : "",
        address: typeof p.address === "string" ? p.address : "",
        cnpj: typeof p.cnpj === "string" ? p.cnpj : "",
        city: typeof p.city === "string" ? p.city : "",
        state: typeof p.state === "string" ? p.state : "",
        active: p.active === true && p.isDeleted !== true,
      };
    }),
    checkedAt
  );
  return sources && accreditation
    ? {
        ...control,
        mapClinics: accreditation.clinics,
        sources: {
          campaignUrl: `https://docs.google.com/spreadsheets/d/${sources.campaignSpreadsheetId}/edit`,
          accreditationUrl: `https://docs.google.com/spreadsheets/d/${sources.accreditationSpreadsheetId}/edit`,
        },
      }
    : control;
}
