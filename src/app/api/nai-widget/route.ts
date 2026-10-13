import { NextResponse } from "next/server";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/** Internal avatar configuration has not been approved as a public publication. */
export async function GET() {
  return NextResponse.json(
    {
      sucesso: false,
      codigo: "PUBLIC_INTEGRATION_UNAVAILABLE",
      mensagem: "O widget público da NAI ainda não está disponível.",
    },
    { status: 503, headers }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
