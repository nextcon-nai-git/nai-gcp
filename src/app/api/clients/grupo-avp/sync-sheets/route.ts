import { NextRequest, NextResponse } from "next/server";
import {
  formatGoogleSheetsCsvUrl,
  parseSpreadsheetText,
  mergeSpreadsheetData,
} from "@/lib/avp-sheet-importer";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden, handleAuthError } from "@/lib/auth/errors";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (
      !["SUPER_ADMIN", "ADMIN"].includes(user.role) &&
      user.tenantId !== "GRUPO_AVP" &&
      !user.servedCompanies.includes("GRUPO_AVP")
    ) {
      throw forbidden("Seu perfil não possui acesso ao Grupo AVP.");
    }
    if (Number(req.headers.get("content-length")) > 5_000_000)
      return NextResponse.json({ error: "Fila excede o limite de importação." }, { status: 413 });
    const body = await req.json();
    if (typeof body.sheetUrl !== "string")
      return NextResponse.json({ error: "Informe o link da planilha." }, { status: 400 });
    const { csvUrl, error } = formatGoogleSheetsCsvUrl(body.sheetUrl);
    if (error || !csvUrl) return NextResponse.json({ error }, { status: 400 });
    const currentAsos = body.currentAsos ?? [];
    if (
      !Array.isArray(currentAsos) ||
      currentAsos.length > 10_000 ||
      currentAsos.some(
        (item) =>
          !item ||
          ["id", "numero", "colaborador", "cidade"].some((key) => typeof item[key] !== "string")
      )
    ) {
      return NextResponse.json({ error: "Fila atual inválida." }, { status: 400 });
    }
    let target = csvUrl;
    let response: Response | undefined;
    const signal = AbortSignal.timeout(20_000);
    for (let hop = 0; hop < 5; hop++) {
      const url = new URL(target);
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !(url.hostname === "docs.google.com" || url.hostname.endsWith(".googleusercontent.com"))
      ) {
        return NextResponse.json(
          { error: "A planilha redirecionou para um destino incompatível." },
          { status: 400 }
        );
      }
      response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        signal,
        headers: { Accept: "text/csv" },
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location) break;
      target = new URL(location, url).href;
    }
    if (!response?.ok)
      return NextResponse.json(
        {
          error:
            "Não foi possível ler a planilha com as permissões atuais. Use um link CSV já autorizado ou importe o arquivo local.",
        },
        { status: 422 }
      );
    if (Number(response.headers.get("content-length")) > 5_000_000)
      return NextResponse.json({ error: "Planilha excede 5 MB." }, { status: 413 });
    const reader = response.body?.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    if (reader)
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > 5_000_000) {
          await reader.cancel();
          return NextResponse.json({ error: "Planilha excede 5 MB." }, { status: 413 });
        }
        parts.push(chunk.value);
      }
    const text = Buffer.concat(parts).toString("utf8");
    if (/<!doctype html|<html|accounts.google.com/i.test(text))
      return NextResponse.json(
        {
          error:
            "O link exige login no Google. Importe XLSX/CSV local mantendo as permissões da planilha.",
        },
        { status: 422 }
      );
    const rows = parseSpreadsheetText(text);
    if (!rows.length)
      return NextResponse.json({ error: "Nenhuma linha encontrada na planilha." }, { status: 422 });
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      rowCount: rows.length,
      mergeResult: mergeSpreadsheetData(currentAsos as GrupoAvpAso[], rows),
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { error: "A sincronização não terminou. Tente novamente ou importe o arquivo local." },
      { status: 503 }
    );
  }
}
