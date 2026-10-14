import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { badRequest } from "@/lib/auth/errors";
import { privateHeaders, privateFailure, limitedJson } from "@/lib/http/private-api";
import {
  connectorOverview,
  connectorCatalog,
  previewConnectorExport,
  executeConnectorExport,
  reconcileConnectorExport,
} from "@/services/omie-connectors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: NextRequest) {
  try {
    const u = await requireAuth(r);
    requireFinancialAccess(u);
    return NextResponse.json(await connectorOverview(u), {
      headers: privateHeaders,
    });
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    const u = await requireAuth(r);
    requireFinancialAccess(u);
    const p = z
      .object({ action: z.enum(["catalog", "preview", "execute", "reconcile"]), data: z.unknown() })
      .strict()
      .safeParse(await limitedJson(r));
    if (!p.success) throw badRequest("Operação inválida.");
    const functions = {
      catalog: connectorCatalog,
      preview: previewConnectorExport,
      execute: executeConnectorExport,
      reconcile: reconcileConnectorExport,
    };
    return NextResponse.json(await functions[p.data.action](u, p.data.data), {
      headers: privateHeaders,
    });
  } catch (e) {
    if (e instanceof z.ZodError)
      return privateFailure(badRequest("Parâmetros ou resposta do conector inválidos."));
    return privateFailure(e);
  }
}
