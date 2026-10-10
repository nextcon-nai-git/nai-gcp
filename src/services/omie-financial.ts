import "server-only";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import {
  OmieCredentialsSchema,
  OmieQuerySchema,
  type OmieConnection,
  type OmiePage,
} from "@/lib/financial/omie";
import { z } from "zod";
// Default-deny Storage Rules protect this prefix, including from client-side admins.
// No download tokens, signed URLs, credential readback or client Firestore storage.
const file = () =>
  getStorage().bucket(firebaseConfig.storageBucket).file("private-integrations/omie/nextcon.json");
type Credentials = z.infer<typeof OmieCredentialsSchema>;
type Saved = Credentials & {
  company: string;
  cnpj: string;
  verifiedAt: string;
  connectedBy: string;
};
const unavailable = () =>
  new AuthError(
    "Omie indisponível ou credenciais sem acesso. Confira a chave do aplicativo NEXTCON e tente novamente.",
    503
  );
const methods = {
  company: ["geral/empresas", "ListarEmpresas"],
  payable: ["financas/contapagar", "ListarContasPagar"],
  receivable: ["financas/contareceber", "ListarContasReceber"],
} as const;
async function call(
  credentials: Credentials,
  kind: keyof typeof methods,
  param: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const [path, method] = methods[kind];
  try {
    const response = await fetch(`https://app.omie.com.br/api/v1/${path}/`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call: method,
        app_key: credentials.appKey,
        app_secret: credentials.appSecret,
        param: [param],
      }),
    });
    const data = await response.json();
    if (!response.ok || !data || typeof data !== "object" || data.faultstring || data.faultcode)
      throw unavailable();
    return data;
  } catch {
    throw unavailable();
  }
}
async function read(): Promise<Saved | null> {
  try {
    const [bytes] = await file().download();
    return JSON.parse(bytes.toString()) as Saved;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && Number(e.code) === 404) return null;
    throw e;
  }
}
function publicStatus(saved: Saved | null): OmieConnection {
  return saved
    ? { connected: true, company: saved.company, cnpj: saved.cnpj, verifiedAt: saved.verifiedAt }
    : { connected: false };
}
export async function omieStatus(user: AuthContext) {
  requireFinancialAccess(user);
  return publicStatus(await read());
}
export async function connectOmie(user: AuthContext, input: unknown) {
  requireFinancialAccess(user);
  const parsed = OmieCredentialsSchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Preencha App Key e App Secret válidos do aplicativo NEXTCON.");
  const data = await call(parsed.data, "company", { pagina: 1, registros_por_pagina: 50 });
  const companySchema = z.object({
    razao_social: z.string(),
    nome_fantasia: z.string().optional(),
    cnpj: z.string(),
  });
  const companies = z.array(companySchema).safeParse(data.empresas_cadastro);
  if (
    !companies.success ||
    companies.data.length !== 1 ||
    !/nextcon/i.test(`${companies.data[0].razao_social} ${companies.data[0].nome_fantasia || ""}`)
  )
    throw badRequest(
      "A chave não identificou uma única empresa NEXTCON. Confira o aplicativo selecionado no Omie."
    );
  const company = companies.data[0];
  const saved: Saved = {
    ...parsed.data,
    company: company.razao_social,
    cnpj: company.cnpj,
    verifiedAt: new Date().toISOString(),
    connectedBy: user.uid,
  };
  await file().save(JSON.stringify(saved), {
    resumable: false,
    contentType: "application/json",
    metadata: { cacheControl: "private, no-store" },
  });
  return publicStatus(saved);
}
export async function disconnectOmie(user: AuthContext) {
  requireFinancialAccess(user);
  await file().delete({ ignoreNotFound: true });
  return { connected: false };
}
export async function listOmie(user: AuthContext, input: unknown): Promise<OmiePage> {
  requireFinancialAccess(user);
  const parsed = OmieQuerySchema.safeParse(input);
  if (!parsed.success) throw badRequest("Consulta Omie inválida.");
  const credentials = await read();
  if (!credentials)
    throw new AuthError("Conecte o aplicativo NEXTCON antes de consultar o financeiro.", 409);
  const { kind, page, status } = parsed.data;
  const data = await call(credentials, kind, {
    pagina: page,
    registros_por_pagina: 50,
    apenas_importado_api: "N",
    ordenar_por: "CODIGO",
    ordem_descrescente: "S",
    ...(status !== "ALL" ? { filtrar_por_status: status } : {}),
  });
  const item = z.object({
    codigo_lancamento_omie: z.number().int(),
    numero_documento: z.string().optional(),
    codigo_cliente_fornecedor: z.number().optional(),
    data_vencimento: z.string(),
    valor_documento: z.number().finite(),
    status_titulo: z.string().optional(),
    codigo_categoria: z.string().optional(),
  });
  const result = z
    .object({
      pagina: z.number().int().nonnegative(),
      total_de_paginas: z.number().int().nonnegative(),
      total_de_registros: z.number().int().nonnegative(),
    })
    .safeParse(data);
  const records = z
    .array(item)
    .max(50)
    .safeParse(data[kind === "payable" ? "conta_pagar_cadastro" : "conta_receber_cadastro"]);
  if (!result.success || !records.success) throw unavailable();
  return {
    page: result.data.pagina,
    pages: result.data.total_de_paginas,
    total: result.data.total_de_registros,
    queriedAt: new Date().toISOString(),
    rows: records.data.map((r) => ({
      id: String(r.codigo_lancamento_omie),
      document: r.numero_documento || "—",
      partyCode: String(r.codigo_cliente_fornecedor ?? "—"),
      dueDate: r.data_vencimento,
      amount: r.valor_documento,
      status: r.status_titulo || "Não informado",
      category: r.codigo_categoria || "—",
    })),
  };
}
