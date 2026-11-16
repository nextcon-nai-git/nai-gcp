import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { finalizeChecklist } from "@/services/checklist-protocol";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const result = await finalizeChecklist(user.uid, await limitedJson(request, 8192));
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
