import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { requireSocAccess } from "@/lib/integrations/soc";
import {
  SOC_DASHBOARD_MAX_BYTES,
  socDashboardSchema,
  socDashboardWriteSchema,
} from "@/lib/integrations/soc-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This collection is excluded from the generic Firestore client rules.
const document = () => adminDb.collection("webhook_deliveries").doc("soc-dashboard");
const canPublish = (role: string) => ["ADMIN", "SUPER_ADMIN"].includes(role);
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
const failure = (error: unknown) =>
  error instanceof AuthError
    ? reply({ error: error.message }, error.status)
    : reply({ error: "Não foi possível acessar o levantamento SOC. Tente novamente." }, 500);

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireSocAccess(user);
    const saved = await document().get();
    if (!saved.exists)
      return reply({
        snapshot: null,
        version: null,
        savedAt: null,
        canPublish: canPublish(user.role),
      });
    const data = saved.data()!;
    return reply({
      snapshot: socDashboardSchema.parse(data.snapshot),
      version: data.version,
      savedAt: data.savedAt,
      canPublish: canPublish(user.role),
    });
  } catch (error) {
    return failure(error);
  }
}

async function readBoundedJson(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new AuthError("Envie um arquivo JSON de levantamento.", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new AuthError("Arquivo vazio.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > SOC_DASHBOARD_MAX_BYTES) {
        await reader.cancel();
        throw new AuthError("Arquivo maior que o limite permitido.", 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AuthError("Arquivo JSON inválido.", 400);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireSocAccess(user);
    if (!canPublish(user.role))
      throw new AuthError("Somente administradores internos podem publicar levantamentos.", 403);
    const parsed = socDashboardWriteSchema.safeParse(await readBoundedJson(req));
    if (!parsed.success)
      return reply(
        { error: "Levantamento inválido. Confira datas, códigos únicos e campos do arquivo." },
        400
      );
    const { snapshot, expectedVersion } = parsed.data;
    if (Date.parse(snapshot.observedAt) > Date.now() + 300_000)
      return reply({ error: "A data da consulta não pode estar no futuro." }, 400);
    const version = randomUUID();
    const savedAt = new Date().toISOString();
    const ref = document();
    await adminDb.runTransaction(async (transaction) => {
      const previous = await transaction.get(ref);
      const data = previous.data();
      if ((data?.version ?? null) !== expectedVersion)
        throw new AuthError("O painel foi atualizado. Recarregue antes de publicar.", 409);
      if (
        data?.snapshot?.observedAt &&
        Date.parse(snapshot.observedAt) < Date.parse(data.snapshot.observedAt)
      )
        throw new AuthError("Este levantamento é anterior ao já publicado.", 409);
      transaction.set(ref, { snapshot, version, savedAt, updatedBy: user.uid });
    });
    return reply({ snapshot, version, savedAt, canPublish: true });
  } catch (error) {
    return failure(error);
  }
}
