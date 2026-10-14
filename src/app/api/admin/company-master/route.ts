import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { forbidden, badRequest } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const text = z.string().max(1000);
const schema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    name: z.string().trim().min(3).max(300),
    cnpj: z.string().transform(normalizeCnpj).refine(isValidCnpj, "CNPJ inválido."),
    segment: z.string().min(1).max(300),
    cnae: text.default(""),
    cnaeDescricao: text.default(""),
    risk_degree: z.number().int().min(1).max(4),
    city: z.string().min(2).max(300),
    state: z.string().length(2),
    address: text.default(""),
    email: z.union([z.literal(""), z.string().email().max(300)]).default(""),
    phone: text.default(""),
    website: text.default(""),
    active: z.boolean(),
    esocial_enabled: z.boolean(),
  })
  .strict();
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (user.tenantId || !["SUPER_ADMIN", "ADMIN"].includes(user.role)) throw forbidden();
    const parsed = schema.safeParse(await limitedJson(req));
    if (!parsed.success)
      throw badRequest("Dados mestre inválidos: " + parsed.error.issues[0]?.message);
    const data = parsed.data;
    const ref = adminDb.collection("companies").doc(data.id);
    const audit = adminDb.collection("admin_company_changes").doc();
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      const previous = current.data() || {};
      tx.set(
        ref,
        {
          ...data,
          ...(!current.exists || !previous.createdAt
            ? { createdAt: FieldValue.serverTimestamp() }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.create(audit, {
        companyId: data.id,
        actorUid: user.uid,
        changedAt: FieldValue.serverTimestamp(),
        previous: Object.fromEntries(Object.keys(data).map((key) => [key, previous[key] ?? null])),
        next: data,
      });
    });
    return NextResponse.json({ saved: true, companyId: data.id }, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
