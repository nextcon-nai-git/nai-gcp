import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { firebaseConfig } from "@/firebase/config";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import {
  limitedFormData,
  limitedJson,
  privateFailure,
  privateHeaders,
} from "@/lib/http/private-api";
import {
  CLINIC_CONTRACT_HASH,
  CLINIC_CONTRACT_NAME,
  CLINIC_CONTRACT_VERSION,
  ClinicContractFieldsSchema,
  DOCX_TYPE,
} from "@/lib/clinic-contract";
import {
  contractEmailDraft,
  generateClinicContract,
  templateMatches,
} from "@/lib/clinic-contract-docx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const file = () =>
  getStorage()
    .bucket(firebaseConfig.storageBucket)
    .file(`private-contract-templates/clinics/${CLINIC_CONTRACT_HASH}.docx`);
async function access(req: NextRequest) {
  const user = await requireAuth(req);
  requireAvpAccess(user);
  if (!canAccessAvpEvidence(user))
    throw forbidden("Modelo disponível à equipe interna autorizada da operação AVP.");
  return user;
}
const canUpload = (user: { role: string | null; tenantId: string | null }) =>
  user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !user.tenantId);
async function source() {
  const [exists] = await file().exists();
  if (!exists) throw new AuthError("Cadastre o modelo original antes de preparar uma minuta.", 404);
  const [bytes] = await file().download();
  if (!templateMatches(bytes))
    throw new AuthError("O modelo armazenado precisa ser conferido.", 409);
  return bytes;
}
export async function GET(req: NextRequest) {
  try {
    const user = await access(req);
    if (req.nextUrl.searchParams.get("download") === "original") {
      return new NextResponse(new Uint8Array(await source()), {
        headers: {
          ...privateHeaders,
          "Content-Type": DOCX_TYPE,
          "Content-Disposition": `attachment; filename="${CLINIC_CONTRACT_NAME}"`,
        },
      });
    }
    const [ready] = await file().exists();
    return NextResponse.json(
      {
        ready,
        canUpload: canUpload(user),
        version: CLINIC_CONTRACT_VERSION,
        name: CLINIC_CONTRACT_NAME,
      },
      { headers: privateHeaders }
    );
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await access(req);
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      if (!canUpload(user))
        throw forbidden("Somente administradores internos podem cadastrar o modelo.");
      const form = await limitedFormData(req, 2 * 1024 * 1024);
      const upload = form.get("file");
      if (!(upload instanceof File)) throw badRequest("Selecione o contrato Word original.");
      const bytes = Buffer.from(await upload.arrayBuffer());
      if (!templateMatches(bytes))
        throw badRequest(
          "Selecione o arquivo original Contrato_Credenciamento_Clinicas_Nextcon_v2.docx. Outra versão exige nova revisão do modelo."
        );
      try {
        await file().save(bytes, {
          resumable: false,
          contentType: DOCX_TYPE,
          metadata: {
            cacheControl: "private, no-store",
            metadata: {
              uploadedBy: user.uid,
              uploadedAt: new Date().toISOString(),
              templateVersion: CLINIC_CONTRACT_VERSION,
            },
          },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      } catch (e) {
        if (!(e && typeof e === "object" && "code" in e && Number(e.code) === 412)) throw e;
        await source();
      }
      return NextResponse.json(
        { saved: true, version: CLINIC_CONTRACT_VERSION },
        { headers: privateHeaders }
      );
    }
    const payload = await limitedJson(req, 16000);
    const parsed = ClinicContractFieldsSchema.safeParse(payload.fields);
    if (!parsed.success) throw badRequest("Confira os campos da clínica e o endereço de e-mail.");
    if (!["preview", "docx", "email"].includes(payload.format))
      throw badRequest("Formato inválido.");
    if (payload.format === "email" && !parsed.data.email)
      throw badRequest("Informe o e-mail da clínica para preparar o rascunho.");
    const result = await generateClinicContract(await source(), parsed.data);
    if (payload.format === "preview")
      return NextResponse.json(
        { text: result.text, pending: result.pending, version: CLINIC_CONTRACT_VERSION },
        { headers: privateHeaders }
      );
    const email = payload.format === "email";
    const bytes = email
      ? Buffer.from(contractEmailDraft(result.bytes, parsed.data), "utf8")
      : result.bytes;
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": email ? "message/rfc822" : DOCX_TYPE,
        "Content-Disposition": `attachment; filename="${email ? "Rascunho_Email_Credenciamento.eml" : "Minuta_Credenciamento_NEXTCON.docx"}"`,
      },
    });
  } catch (e) {
    return privateFailure(e);
  }
}
