import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { manageUserAccess, previewUserAccess } from "@/services/user-access";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await previewUserAccess(
        await requireAuth(request),
        request.nextUrl.searchParams.get("kind"),
        request.nextUrl.searchParams.get("id")
      ),
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    return NextResponse.json(await manageUserAccess(actor, await limitedJson(request, 8192)), {
      headers: privateHeaders,
    });
  } catch (error) {
    return privateFailure(error);
  }
}
