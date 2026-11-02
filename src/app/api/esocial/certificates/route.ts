import { esocialFailure } from "@/services/esocial/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedFormData, limitedJson, privateHeaders } from "@/lib/http/private-api";
import {
  canManageEsocialConnection,
  requireEsocialAdministrator,
  requireEsocialMessagingAccess,
} from "@/services/esocial/access";
import {
  esocialCertificateStatus,
  retireEsocialCertificate,
  uploadEsocialCertificate,
} from "@/services/esocial/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialMessagingAccess(user);
    return NextResponse.json(
      {
        certificate: await esocialCertificateStatus(),
        canManage: canManageEsocialConnection(user),
      },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}

export async function POST(request: NextRequest) {
  let bytes: Buffer | undefined;
  try {
    const user = await requireAuth(request);
    requireEsocialAdministrator(user);
    const form = await limitedFormData(request, 64 * 1024);
    const allowed = new Set(["file", "password", "registration", "confirmed"]);
    if (
      [...form.keys()].some((key) => !allowed.has(key)) ||
      [...allowed].some((key) => form.getAll(key).length !== 1)
    )
      throw badRequest("Envie um certificado, a senha, o titular e a confirmação.");
    const file = form.get("file"),
      password = form.get("password"),
      registration = form.get("registration");
    if (
      !(file instanceof File) ||
      !/\.(pfx|p12)$/i.test(file.name) ||
      file.size < 100 ||
      file.size > 40 * 1024 ||
      typeof password !== "string" ||
      password.length > 1024 ||
      typeof registration !== "string" ||
      !registration.trim() ||
      registration.length > 30 ||
      form.get("confirmed") !== "true"
    )
      throw badRequest("Confira o certificado PFX/P12 de até 40 KB, senha, titular e confirmação.");
    bytes = Buffer.from(await file.arrayBuffer());
    const certificate = await uploadEsocialCertificate(user, bytes, password, registration);
    return NextResponse.json({ certificate, canManage: true }, { headers: privateHeaders });
  } catch (failure) {
    return esocialFailure(failure);
  } finally {
    bytes?.fill(0);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialAdministrator(user);
    const body = await limitedJson(request, 1024);
    if (!body || body.confirmed !== true)
      throw badRequest("Confirme a desativação do certificado.");
    return NextResponse.json(
      { certificate: await retireEsocialCertificate(user), canManage: true },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}
