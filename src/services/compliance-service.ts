"use client";

import type { FirebaseApp } from "firebase/app";
import { getNaiAppCheckToken } from "@/firebase/app-check";
import { CATEGORIAS_COMPLIANCE, type ComplianceReportInput } from "@/lib/compliance";

export { CATEGORIAS_COMPLIANCE };

export async function criarDenuncia(app: FirebaseApp, dadosFormulario: ComplianceReportInput) {
  const appCheckToken = await getNaiAppCheckToken(app);
  const response = await fetch("/api/compliance/reports", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
    },
    body: JSON.stringify(dadosFormulario),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.protocol !== "string")
    throw new Error(result.error || "Não foi possível registrar o relato.");
  return result.protocol;
}
