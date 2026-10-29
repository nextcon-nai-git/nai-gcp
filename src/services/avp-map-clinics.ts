import "server-only";
import { auth as googleAuth, sheets as googleSheets } from "googleapis/build/src/apis/sheets";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { AVP_MAP_CLINIC_TAB, readAvpMapClinics } from "@/lib/avp-map-clinics";

export async function readAvpMapClinicSource() {
  const auth = new googleAuth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = googleSheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: AVP_SOURCE.spreadsheetId,
      range: `'${AVP_MAP_CLINIC_TAB}'!A1:J1002`,
      valueRenderOption: "FORMATTED_VALUE",
    },
    { timeout: 20000 }
  );
  return {
    clinics: readAvpMapClinics(result.data.values || []),
    checkedAt: new Date().toISOString(),
  };
}
