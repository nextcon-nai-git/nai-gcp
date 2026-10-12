import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { FinanceBookSchema, emptyFinanceBook } from "@/lib/financial/operations";
import { SupplierBook, qualificationCurrent } from "@/lib/suppliers/qualification";
import {
  OmieExport,
  ExportSelection,
  omieIntegrationKey,
  matchesOmieExport,
  normalizeDocument,
} from "@/lib/financial/omie-export";
import { brazilToday } from "@/lib/financial/treasury";
import { toOmieDate } from "@/lib/financial/omie-dre";
import { omieConnectorSession } from "./omie-financial";
import { readPrivate, writePrivate } from "./private-json-store";
const financePath = "financial-operations/v1/nextcon.json",
  supplierPath = "supplier-qualification/v1/book.json";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function conflict(s: string): never {
  throw new AuthError(s, 409);
}
async function sources() {
  const [finance, suppliers] = await Promise.all([
    readPrivate(financePath, FinanceBookSchema, emptyFinanceBook),
    readPrivate(supplierPath, SupplierBook, () =>
      SupplierBook.parse({ version: 0, applications: [], audit: [] })
    ),
  ]);
  return { finance, suppliers };
}
export async function connectorOverview(u: AuthContext) {
  requireFinancialAccess(u);
  const s = await sources();
  return {
    suppliers: s.suppliers.value.applications
      .filter((a) => qualificationCurrent(a, brazilToday()))
      .map((a) => ({ id: a.id, name: a.profile.name, document: a.profile.document })),
    titles: s.finance.value.titles
      .filter((t) => t.status === "approved")
      .map((t) => ({
        id: t.id,
        kind: t.kind,
        party: t.party,
        description: t.description,
        amountCents: t.amountCents,
        dueDate: t.dueDate,
        externalReference: t.externalReference,
      })),
    exports: [...s.finance.value.omieExports, ...s.suppliers.value.omieExports],
  };
}
const catalogQuery = z
  .object({
    kind: z.enum(["catalogParties", "categories", "accounts"]),
    page: z.number().int().min(1).max(10000),
  })
  .strict();
export async function connectorCatalog(u: AuthContext, input: unknown) {
  requireFinancialAccess(u);
  const q = catalogQuery.parse(input);
  const session = await omieConnectorSession(u);
  const raw = await session.call(q.kind, {
    pagina: q.page,
    registros_por_pagina: 50,
    apenas_importado_api: "N",
  });
  const key = {
    catalogParties: "clientes_cadastro",
    categories: "categoria_cadastro",
    accounts: "ListarContasCorrentes",
  }[q.kind];
  const page = z
    .object({
      pagina: z.number().int(),
      total_de_paginas: z.number().int().nonnegative(),
      total_de_registros: z.number().int().nonnegative(),
    })
    .parse(raw);
  if (page.pagina !== q.page)
    throw new AuthError("Página retornada pelo Omie diverge da solicitação.", 502);
  const rows = z.array(z.record(z.unknown())).max(50).parse(raw[key]);
  return {
    kind: q.kind,
    page: page.pagina,
    pages: page.total_de_paginas,
    total: page.total_de_registros,
    rows: z
      .array(
        z.object({
          code: z.union([z.string().min(1).max(60), z.number().int().safe().positive()]),
          name: z.string().max(500),
          document: z.string().max(30).optional(),
          inactive: z.string().max(1).optional(),
          total: z.string().max(1).optional(),
        })
      )
      .parse(
        rows.map((r) =>
          q.kind === "catalogParties"
            ? {
                code: r.codigo_cliente_omie,
                name: r.razao_social,
                document: r.cnpj_cpf,
                inactive: r.inativo,
              }
            : q.kind === "categories"
              ? { code: r.codigo, name: r.descricao, inactive: r.inativo, total: r.totalizadora }
              : { code: r.nCodCC, name: r.descricao, inactive: r.inativo }
        )
      ),
  };
}
async function prepare(u: AuthContext, input: unknown) {
  requireFinancialAccess(u);
  const selection = ExportSelection.parse(input),
    s = await sources(),
    session = await omieConnectorSession(u);
  const { kind, sourceId } = selection;
  const key = omieIntegrationKey(kind, sourceId);
  const old = (kind === "supplier" ? s.suppliers.value : s.finance.value).omieExports.find(
    (e) => e.sourceId === sourceId
  );
  if (old)
    conflict(
      "Já existe um envio reservado ou confirmado para este registro. Consulte o histórico e reconcilie a resposta."
    );
  let payload: Record<string, unknown>;
  let sourceVersion: number;
  if (kind === "supplier") {
    const a = s.suppliers.value.applications.find((a) => a.id === sourceId);
    if (!a || !qualificationCurrent(a, brazilToday()))
      conflict("Fornecedor sem homologação vigente.");
    if (a.profile.name.length > 60)
      conflict(
        "O Omie aceita razão social de até 60 caracteres. Ajuste o cadastro e renove a revisão."
      );
    payload = {
      codigo_cliente_integracao: key,
      razao_social: a.profile.name,
      cnpj_cpf: normalizeDocument(a.profile.document),
      email: a.profile.email,
      tags: [{ tag: "Fornecedor" }],
    };
    sourceVersion = a.version;
  } else {
    const t = s.finance.value.titles.find((t) => t.id === sourceId && t.kind === kind);
    if (!t || t.status !== "approved" || t.externalReference)
      conflict("Escolha um título aprovado sem referência externa.");
    if (s.finance.value.settlements.some((x) => x.titleId === t.id && !x.reversed))
      conflict("Título com baixa local não pode ser exportado.");
    if (t.dueDate < brazilToday()) conflict("O envio exige vencimento atual ou futuro.");
    if (s.finance.value.periods.some((p) => p.month === t.competence && p.closed))
      conflict("Competência fechada.");
    if (!selection.partyCode || !selection.categoryCode || !selection.accountCode)
      throw badRequest("Selecione cliente/fornecedor, categoria e conta do Omie.");
    const party = await session.call("partyDetail", { codigo_cliente_omie: selection.partyCode });
    const norm = (v: unknown) =>
      String(v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
    if (
      party.codigo_cliente_omie !== selection.partyCode ||
      party.inativo === "S" ||
      norm(party.razao_social) !== norm(t.party)
    )
      conflict("Cliente/fornecedor selecionado não corresponde ao nome do título ou está inativo.");
    const category = await session.call("categoryDetail", { codigo: selection.categoryCode });
    if (
      category.codigo !== selection.categoryCode ||
      category.inativo === "S" ||
      category.totalizadora === "S"
    )
      conflict("Categoria inválida, inativa ou totalizadora.");
    const account = await session.call("accountDetail", { nCodCC: selection.accountCode });
    if (account.nCodCC !== selection.accountCode || account.inativo === "S")
      conflict("Conta Omie inválida ou inativa.");
    payload = {
      codigo_lancamento_integracao: key,
      codigo_cliente_fornecedor: selection.partyCode,
      data_vencimento: toOmieDate(t.dueDate),
      valor_documento: t.amountCents / 100,
      codigo_categoria: selection.categoryCode,
      data_previsao: toOmieDate(t.dueDate),
      id_conta_corrente: selection.accountCode,
      observacao: `NAI: ${t.description}`,
      ...(kind === "payable" ? { baixar_documento: "N", conciliar_documento: "N" } : {}),
    };
    sourceVersion = s.finance.value.version;
  }
  const hash = digest(JSON.stringify({ selection, payload, sourceVersion, scope: session.scope }));
  return { selection, payload, hash, session, s };
}
export async function previewConnectorExport(u: AuthContext, input: unknown) {
  const p = await prepare(u, input);
  return {
    selection: p.selection,
    payload: p.payload,
    hash: p.hash,
    company: p.session.company,
    cnpj: p.session.cnpj,
  };
}
export async function executeConnectorExport(u: AuthContext, input: unknown) {
  requireFinancialAccess(u);
  const req = z
    .object({ selection: ExportSelection, hash: z.string().length(64) })
    .strict()
    .parse(input);
  const p = await prepare(u, req.selection);
  if (p.hash !== req.hash) conflict("Dados alterados desde a prévia. Gere uma nova prévia.");
  const record = OmieExport.parse({
    sourceId: p.selection.sourceId,
    kind: p.selection.kind,
    key: omieIntegrationKey(p.selection.kind, p.selection.sourceId),
    scope: p.session.scope,
    company: p.session.company,
    hash: p.hash,
    payload: p.payload,
    status: "reserved",
    remoteId: null,
    actor: u.uid,
    at: new Date().toISOString(),
    confirmedAt: null,
    confirmedBy: null,
  });
  // Reserve in the SAME generation as the source: concurrent local edits or exports fail before POST.
  const state = p.selection.kind === "supplier" ? p.s.suppliers : p.s.finance;
  state.value.omieExports.push(record);
  state.value.version++;
  await writePrivate(
    p.selection.kind === "supplier" ? supplierPath : financePath,
    state.value,
    state.generation
  );
  // Never repeat this POST. A crash, timeout or provider fault leaves an inspectable reservation.
  try {
    await p.session.call(
      p.selection.kind === "supplier"
        ? "createSupplier"
        : p.selection.kind === "payable"
          ? "createPayable"
          : "createReceivable",
      p.payload
    );
  } catch {
    return {
      status: "reserved",
      message:
        "Envio sem confirmação. Use Consultar resultado; não repita a inclusão. A reserva foi preservada.",
    };
  }
  return reconcileConnectorExport(u, { kind: record.kind, sourceId: record.sourceId });
}
export async function reconcileConnectorExport(u: AuthContext, input: unknown) {
  requireFinancialAccess(u);
  const selection = z
    .object({ kind: ExportSelection.shape.kind, sourceId: z.string().uuid() })
    .strict()
    .parse(input);
  const s = await sources(),
    state = selection.kind === "supplier" ? s.suppliers : s.finance;
  const record = state.value.omieExports.find(
    (e) => e.sourceId === selection.sourceId && e.kind === selection.kind
  );
  if (!record) conflict("Envio não encontrado.");
  const session = await omieConnectorSession(u);
  if (record.scope !== session.scope)
    conflict(
      "A conexão Omie mudou. Restabeleça o mesmo aplicativo antes de consultar o resultado."
    );
  const raw = await session.call(
    selection.kind === "supplier"
      ? "partyDetail"
      : selection.kind === "payable"
        ? "payableDetail"
        : "receivableDetail",
    selection.kind === "supplier"
      ? { codigo_cliente_integracao: record.key }
      : { codigo_lancamento_integracao: record.key }
  );
  const remoteId = matchesOmieExport(record, raw);
  if (!remoteId)
    conflict(
      "O registro Omie não corresponde integralmente à prévia. Reserva mantida para conferência manual."
    );
  if (record.status === "confirmed") {
    if (record.remoteId !== remoteId) conflict("Código remoto divergente.");
    return { status: "confirmed", remoteId, message: "Registro confirmado no Omie." };
  }
  record.status = "confirmed";
  record.remoteId = remoteId;
  record.confirmedAt = new Date().toISOString();
  record.confirmedBy = u.uid;
  state.value.version++;
  if (selection.kind !== "supplier") {
    const title = s.finance.value.titles.find((t) => t.id === record.sourceId);
    if (!title) conflict("Título de origem não encontrado.");
    title.externalReference = String(remoteId);
    s.finance.value.audit.push({
      id: randomUUID(),
      actor: u.uid,
      at: record.confirmedAt,
      action: "omieExport",
      hash: record.hash,
      version: state.value.version,
      reason: "Envio confirmado por consulta ao Omie",
      details: JSON.stringify(record),
    });
  } else {
    s.suppliers.value.audit.push({
      id: randomUUID(),
      actor: u.uid,
      applicationId: record.sourceId,
      at: record.confirmedAt,
      action: "omieExport",
      hash: record.hash,
      details: JSON.stringify(record),
    });
  }
  await writePrivate(
    selection.kind === "supplier" ? supplierPath : financePath,
    state.value,
    state.generation
  );
  return {
    status: "confirmed",
    remoteId,
    message: "Registro confirmado no Omie e vinculado ao NAI.",
  };
}
