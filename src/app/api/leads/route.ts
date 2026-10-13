import { NextResponse } from "next/server";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/**
 * Public intake has no configured tenant, anti-abuse control or consent workflow.
 * Do not replace the former anonymous browser SDK write with an unrestricted
 * Admin SDK write. Keep contact data out of persistence and logs until configured.
 */
export async function POST(_request: Request) {
  return NextResponse.json(
    {
      sucesso: false,
      codigo: "PUBLIC_INTEGRATION_UNAVAILABLE",
      mensagem:
        "O formulário público de contato ainda não está disponível. Nenhum lead foi registrado.",
    },
    { status: 503, headers }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
