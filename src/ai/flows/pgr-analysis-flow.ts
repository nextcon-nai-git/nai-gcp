"use server";

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrRole } from "@/lib/auth/require-pgr-access";
import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { analyzePgrDocument, type PgrAnalysisInput } from "@/services/pgr-document-analysis";
export type { PgrAnalysisOutput } from "@/lib/pgr-schema";
export type { PgrAnalysisInput } from "@/services/pgr-document-analysis";

export async function analyzePgrPdf(
  input: PgrAnalysisInput & { idToken?: string; appCheckToken?: string }
) {
  const request = new NextRequest("https://nai.local/api/pgr/analyze", {
    headers: {
      authorization: `Bearer ${input.idToken || ""}`,
      ...(input.appCheckToken ? { "X-Firebase-AppCheck": input.appCheckToken } : {}),
    },
  });
  const user = await requireAuth(request);
  await requirePgrAppCheck(request);
  requirePgrRole(user);
  return analyzePgrDocument(input);
}
