import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { getPermits, savePermit, permitEmployees } from "@/services/pt-apr";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const q = request.nextUrl.searchParams;
    if (q.get("directory") === "1")
      return NextResponse.json(await permitEmployees(user, q.get("company") || ""), {
        headers: privateHeaders,
      });
    return NextResponse.json(await getPermits(user, q.get("company") || "", q.get("after")), {
      headers: privateHeaders,
    });
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json(
      await savePermit(user, await limitedJson(request, 16000), request.signal),
      { headers: privateHeaders }
    );
  } catch (e) {
    return privateFailure(e);
  }
}
