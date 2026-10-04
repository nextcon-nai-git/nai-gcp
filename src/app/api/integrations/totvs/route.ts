import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Integração ainda não configurada neste ambiente. Nenhum registro foi enviado ou salvo.",
    },
    { status: 501 }
  );
}
export async function GET() {
  return NextResponse.json({ configured: false, status: "CONFIGURATION_REQUIRED" });
}
