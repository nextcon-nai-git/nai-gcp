import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { privateFailure, privateHeaders, limitedJson } from "@/lib/http/private-api";
import { createExpertAccount, previewExpertAccount } from "@/services/expert-accounts";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await previewExpertAccount(
        await requireAuth(request),
        request.nextUrl.searchParams.get("provider") || ""
      ),
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const input = await limitedJson(request, 8192);
    return NextResponse.json(await createExpertAccount(user, input), { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
