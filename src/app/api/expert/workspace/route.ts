import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { readExpertWorkspace } from "@/services/expert-workspace";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json(
      await readExpertWorkspace(user, request.nextUrl.searchParams.get("company")),
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}
