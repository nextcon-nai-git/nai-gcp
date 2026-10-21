import "server-only";
import { auth as googleAuth, sheets as googleSheets } from "googleapis/build/src/apis/sheets";
import { adminDb } from "@/lib/firebase-admin";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { AVP_PERIODIC_TABS, buildAvpPeriodicControl } from "@/lib/avp-periodic-control";

export async function readAvpPeriodicControl() {
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
  const specs = [
    [AVP_PERIODIC_TABS.campaign, 2026102001, "AE", 31],
    [AVP_PERIODIC_TABS.providers, 2026102002, "L", 12],
    [AVP_PERIODIC_TABS.prices, 2026102003, "K", 11],
  ] as const;
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
  if (values?.length !== 3) throw new Error("Fontes AVP incompletas.");
  return buildAvpPeriodicControl(
    values[0].values || [],
    values[1].values || [],
    values[2].values || [],
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
    })
  );
}
