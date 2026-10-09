import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, forbidden, badRequest } from "@/lib/auth/errors";
import { generateApiKey, VALID_DEVELOPER_SCOPES } from "@/lib/developer-api-guard";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const id = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !value.includes("/"));
const input = z.object({
  clientId: id,
  name: z.string().trim().min(1).max(120),
  scopes: z
    .array(z.enum(VALID_DEVELOPER_SCOPES))
    .min(1)
    .max(VALID_DEVELOPER_SCOPES.length)
    .default(["access_control:read"]),
});
function requireKeyAdmin(user: AuthContext, clientId?: string) {
  if (user.role === "SUPER_ADMIN") return;
  if (user.role !== "ADMIN") throw forbidden("A gestão de chaves exige perfil administrador.");
  if (user.tenantId && clientId !== user.tenantId)
    throw forbidden("Esta chave pertence a outra empresa.");
}
function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof AuthError ? error.message : "Não foi possível gerenciar as chaves." },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireKeyAdmin(user, user.tenantId || undefined);
    const parsed = input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw badRequest("Informe empresa, nome e escopos válidos.");
    const { clientId, name, scopes } = parsed.data;
    requireKeyAdmin(user, clientId);
    if (
      !["GLOBAL", "ALL_TENANTS"].includes(clientId) &&
      !(await adminDb.collection("companies").doc(clientId).get()).exists
    )
      throw new AuthError("Empresa não encontrada.", 404);
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const createdAt = new Date().toISOString();
    const record = {
      clientId,
      name,
      keyHash,
      keyPrefix,
      scopes: [...new Set(scopes)],
      active: true,
      createdAt,
      createdBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const saved = await adminDb.collection("api_keys").add(record);
    return NextResponse.json(
      {
        success: true,
        id: saved.id,
        name,
        clientId,
        keyPrefix,
        scopes: record.scopes,
        rawKey,
        createdAt,
        message: "Chave gerada. Guarde-a em local seguro; ela só será exibida agora.",
      },
      { status: 201, headers }
    );
  } catch (error) {
    return failure(error);
  }
}
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const clientId = req.nextUrl.searchParams.get("clientId") || user.tenantId || undefined;
    requireKeyAdmin(user, clientId);
    if (clientId && !id.safeParse(clientId).success) throw badRequest("Empresa inválida.");
    let query = adminDb.collection("api_keys").where("active", "==", true);
    if (clientId) query = query.where("clientId", "==", clientId);
    const snapshot = await query.limit(501).get();
    if (snapshot.size > 500) throw new AuthError("Restrinja a consulta por empresa.", 422);
    const keys = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        clientId: data.clientId,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt || null,
      };
    });
    return NextResponse.json({ keys }, { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireKeyAdmin(user, user.tenantId || undefined);
    const keyId = id.safeParse(req.nextUrl.searchParams.get("id"));
    if (!keyId.success) throw badRequest("ID da chave inválido.");
    const ref = adminDb.collection("api_keys").doc(keyId.data);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new AuthError("Chave não encontrada.", 404);
    requireKeyAdmin(user, snapshot.data()?.clientId);
    await ref.update({
      active: false,
      revokedAt: new Date().toISOString(),
      revokedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, message: "Chave revogada." }, { headers });
  } catch (error) {
    return failure(error);
  }
}
