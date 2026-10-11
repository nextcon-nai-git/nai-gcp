import "server-only";
import { createHash, createHmac } from "node:crypto";
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
import {
  fromOmieDate,
  OmieDreQuerySchema,
  suggestOmieDreActions,
  summarizeOmieDre,
  toOmieDate,
  type OmieDreReport,
  type OmieDreRow,
} from "@/lib/financial/omie-dre";
import { FinancialActionImportSchema } from "@/lib/financial/actions";
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
  dre: ["financas/dre", "ListarDRE"],
} as const;
const DRE_RESPONSE_MAX_BYTES = 16 * 1024 * 1024;
const dreTooLarge = () =>
  new AuthError(
    "O relatório Omie excedeu o limite desta consulta. Selecione um período menor.",
    413
  );
async function readDreJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length") || 0) > DRE_RESPONSE_MAX_BYTES) {
    await response.body?.cancel();
    throw dreTooLarge();
  }
  if (!response.body) throw unavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > DRE_RESPONSE_MAX_BYTES) {
        await reader.cancel();
        throw dreTooLarge();
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
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
      signal: AbortSignal.timeout(kind === "dre" ? 45000 : 20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call: method,
        app_key: credentials.appKey,
        app_secret: credentials.appSecret,
        param: [param],
      }),
    });
    const data = kind === "dre" ? await readDreJson(response) : await response.json();
    if (!response.ok || !data || typeof data !== "object") throw unavailable();
    const record = data as Record<string, unknown>;
    if (record.faultstring || record.faultcode) throw unavailable();
    return record;
  } catch (error) {
    if (kind === "dre" && error instanceof AuthError && error.status === 413) throw error;
    throw unavailable();
  }
}

// Official contract: https://app.omie.com.br/api/v1/financas/dre/
// No title pagination or payment dates are substituted for the DRE endpoint.
const dreText = z.string().max(1000).default("");
const dreRecordSchema = z.object({
  dreTipo: dreText,
  dreGrupo: dreText,
  dreConta: dreText,
  categoria: dreText,
  dataMovimento: z.string().max(10),
  valor: z.number().finite(),
  cnpj_cpf: z.string().max(30).default(""),
  nomeClienteFornecedor: dreText,
  cidade: z.string().max(100).default(""),
  estado: z.string().max(2).default(""),
  tagFuncionario: z.string().max(30).default(""),
  cnpjEmpresa: z.string().max(30),
});
const invalidDre = () =>
  new AuthError(
    "A resposta da DRE não pôde ser validada para a empresa e o período consultados. Confira o relatório no Omie ou consulte um período menor.",
    503
  );
const normalizedFlag = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function redactPersonalText(value: string, personName = ""): string {
  let text = value.replace(
    /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/g,
    "[identificação pessoal omitida]"
  );
  if (personName.trim().length >= 2) {
    const escaped = personName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "giu"), "[pessoa omitida]");
  }
  return text.trim();
}

export async function listOmieDre(user: AuthContext, input: unknown): Promise<OmieDreReport> {
  requireFinancialAccess(user);
  const parsed = OmieDreQuerySchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Informe um período válido de até 12 meses e a base de datas.");
  const credentials = await read();
  if (!credentials)
    throw new AuthError("Conecte o aplicativo NEXTCON antes de consultar a DRE.", 409);
  const companyCnpj = credentials.cnpj.replace(/\D/g, "");
  if (companyCnpj.length !== 14) throw invalidDre();
  const query = parsed.data;
  const params = {
    dPeriodoInicial: toOmieDate(query.start),
    dPeriodoFinal: toOmieDate(query.end),
    cTipoData: query.dateBasis === "emission" ? "1" : "2",
  };
  const data = await call(credentials, "dre", params);
  for (const key of ["dPeriodoInicial", "dPeriodoFinal", "cTipoData"] as const) {
    if (data[key] !== undefined && data[key] !== params[key]) throw invalidDre();
  }
  const result = z.array(dreRecordSchema).max(50000).safeParse(data.listaDRE);
  if (!result.success) throw invalidDre();
  // Sorting makes import identity independent of Omie's row order. Equal rows remain separate:
  // a duplicate-looking row may be a legitimate allocation or another transaction.
  const canonical = result.data.map((row) => JSON.stringify(row)).sort();
  // A credential rotation also rotates pseudonyms. Give that context its own revision
  // so an unchanged raw report never collides with differently pseudonymized cards.
  const identityContext = createHmac("sha256", credentials.appSecret)
    .update("nai-financial-pseudonyms:v1")
    .digest("hex");
  const sourceSha256 = createHash("sha256")
    .update(JSON.stringify({ companyCnpj, query, identityContext, rows: canonical }))
    .digest("hex");
  const rows: OmieDreRow[] = canonical.map((value, index) => {
    const row = JSON.parse(value) as z.infer<typeof dreRecordSchema>;
    const date = fromOmieDate(row.dataMovimento);
    const scaled = row.valor * 100;
    const amountCents = Math.round(scaled);
    if (
      !date ||
      date < query.start ||
      date > query.end ||
      row.cnpjEmpresa.replace(/\D/g, "") !== companyCnpj ||
      !Number.isSafeInteger(amountCents) ||
      Math.abs(amountCents) > 1e14 ||
      Math.abs(scaled - amountCents) > 0.00001
    )
      throw invalidDre();
    const document = row.cnpj_cpf.replace(/\D/g, "");
    const person =
      document.length === 11 ||
      /^(s|sim|true|1|funcionario)$/.test(normalizedFlag(row.tagFuncionario));
    const cnpj = !person && document.length === 14 ? document : null;
    const name = row.nomeClienteFornecedor.trim();
    const clean = (value: string) => redactPersonalText(value, person ? name : "");
    const identity = cnpj || (person ? document || name : name.toLocaleUpperCase("pt-BR"));
    const partyId = createHmac("sha256", credentials.appSecret)
      .update(`${companyCnpj}:party:${identity || "unknown"}`)
      .digest("hex");
    return {
      id: createHash("sha256").update(`${sourceSha256}:${index}`).digest("hex"),
      date,
      type: clean(row.dreTipo) || "Tipo não informado",
      group: clean(row.dreGrupo) || "Grupo não informado",
      account: clean(row.dreConta) || "Conta não informada",
      category: clean(row.categoria) || "Categoria não informada",
      amountCents,
      partyId,
      partyName: person
        ? `Pessoa física ${partyId.slice(0, 8)}`
        : clean(name) || "Fornecedor não informado",
      partyCnpj: cnpj,
      identityStatus: person ? "person_hidden" : cnpj ? "cnpj" : name ? "name_only" : "unknown",
      city: clean(row.cidade),
      state: row.estado.toUpperCase(),
    };
  });
  let summary: OmieDreReport["summary"];
  try {
    summary = summarizeOmieDre(rows, query);
  } catch {
    throw invalidDre();
  }
  const warnings = [
    "O relatório inclui as categorias vinculadas a contas DRE no Omie. Confira categorias sem vínculo e ajustes por competência antes de considerar o período fechado.",
    "A cidade é a do cadastro do fornecedor no Omie. Confirme a unidade executante na NF e no atendimento antes de concluir o custo dos exames por cidade.",
    "Os rankings usam a classificação financeira explícita e custos com saldo negativo, compensando valores positivos da mesma classificação. Confira sinais e estornos; quantidade de lançamentos não é quantidade de exames.",
  ];
  if (!rows.length)
    warnings.unshift(
      "O Omie retornou a lista DRE vazia neste período. Isso não comprova ausência de operações ou um resultado zero da empresa."
    );
  if (summary.positiveExpenseEntries)
    warnings.push(
      `${summary.positiveExpenseEntries} valores positivos em contas de despesa exigem conferência da convenção de sinais e dos estornos.`
    );
  if (summary.unclassifiedExpenseEntries)
    warnings.push(
      `${summary.unclassifiedExpenseEntries} lançamentos de despesa não foram atribuídos a engenharia ou exames por falta de classificação ou identidade suficiente.`
    );
  const report = {
    schemaVersion: 1 as const,
    query,
    company: credentials.company,
    cnpj: credentials.cnpj,
    queriedAt: new Date().toISOString(),
    sourceSha256,
    rows,
    summary,
    warnings,
  };
  const actions = FinancialActionImportSchema.safeParse(suggestOmieDreActions(report));
  if (!actions.success) throw invalidDre();
  return { ...report, suggestedActions: actions.data };
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
