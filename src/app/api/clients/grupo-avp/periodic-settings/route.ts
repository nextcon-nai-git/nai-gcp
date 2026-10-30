import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { spreadsheetIdFromUrl } from "@/lib/avp-periodic-live";
import { configureAvpPeriodicSources, getAvpPeriodicSettings } from "@/services/avp-periodic-sync";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
async function authorize(req: NextRequest) {
  const user = await requireAuth(req);
  requireAvpAccess(user);
  if (user.role !== "SUPER_ADMIN" && !(user.role === "ADMIN" && !user.tenantId))
    throw new AuthError("Configuração restrita à administração interna.", 403);
  return user;
}
function failure(error: unknown) {
  if (error instanceof AuthError) {
    const response = handleAuthError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const conflict = error instanceof Error && error.message === "CONFLICT";
  return NextResponse.json(
    {
      error: conflict
        ? "A configuração mudou ou está em atualização. Reabra e confira antes de salvar."
        : "Não foi possível validar as duas planilhas. Confira os links, as abas Controle e NAI Credenciamento e a permissão de leitura do NAI. A configuração anterior foi preservada.",
    },
    { status: conflict ? 409 : 422, headers }
  );
}
export async function GET(req: NextRequest) {
  try {
    await authorize(req);
    return NextResponse.json(await getAvpPeriodicSettings(), { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await authorize(req);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 4096)
      return NextResponse.json(
        { error: "Configuração excede o limite." },
        { status: 413, headers }
      );
    const body = z
      .object({
        campaignUrl: z.string().max(500),
        accreditationUrl: z.string().max(500),
        revision: z.string().max(64),
      })
      .strict()
      .parse(JSON.parse(raw));
    const result = await configureAvpPeriodicSources(
      {
        campaignSpreadsheetId: spreadsheetIdFromUrl(body.campaignUrl),
        accreditationSpreadsheetId: spreadsheetIdFromUrl(body.accreditationUrl),
      },
      body.revision,
      user.uid
    );
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
