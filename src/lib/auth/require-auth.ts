import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { AuthContext } from "./auth-context";
import { parseClaims } from "./claims";
import { unauthorized } from "./errors";

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
  return {
    uid: decoded.uid,
    email: profile.email || decoded.email || "",
    role: parsed.role,
    tenantId: parsed.tenantId || null,
    permissions: parsed.permissions || [],
    servedCompanies: parsed.servedCompanies || [],
  };
}
