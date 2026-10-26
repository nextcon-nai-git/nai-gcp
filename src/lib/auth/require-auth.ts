import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { AuthContext } from "./auth-context";
import { parseClaims } from "./claims";
import { forbidden, unauthorized } from "./errors";

export function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const token = extractBearerToken(request);
  if (!token) throw unauthorized();
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw unauthorized("Sessão inválida ou expirada. Entre novamente.");
  }
  const snapshot = await adminDb.collection("users").doc(decoded.uid).get();
  if (!snapshot.exists) throw unauthorized("Perfil NAI não cadastrado.");
  const profile = snapshot.data()!;
  const parsed = parseClaims(profile);
  // This read-only role has one server-mediated surface. Never let legacy
  // tenant checks or accidentally assigned permissions widen its access.
  if (
    parsed.role === "MEDICAL_EXPERT" &&
    (profile.accessEnabled !== true ||
      request.method !== "GET" ||
      request.nextUrl.pathname !== "/api/expert/workspace")
  )
    throw forbidden("Seu acesso está restrito aos CNPJs e cards liberados no portal de perícias.");
  return {
    uid: decoded.uid,
    email: profile.email || decoded.email || "",
    role: parsed.role,
    tenantId: parsed.tenantId || null,
    permissions: parsed.permissions || [],
    servedCompanies: parsed.servedCompanies || [],
  };
}
