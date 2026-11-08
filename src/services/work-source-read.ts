import "server-only";
import { z } from "zod/v3";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError } from "@/lib/auth/errors";
import { requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { requireTallosAccess } from "@/lib/integrations/tallos-api";
import { requireSocAccess, socRead } from "@/lib/integrations/soc";
import { adminDb } from "@/lib/firebase-admin";
import { isValidCnpj } from "@/lib/cnpj";
import { fromOmieDate, toOmieDate } from "@/lib/financial/omie-dre";
import { omieConnectorSession } from "@/services/omie-financial";
import { WorkSourceQuery, type WorkSourceSelection, workDay } from "@/lib/work-source-query";

const cnpj = z.string().regex(/^[A-Z0-9]{12}\d{2}$/).refine(isValidCnpj);
const code = z.string().regex(/^\d{1,20}$/);
const scopeSchema = z.object({
  cnpjs: z.array(cnpj).min(1).max(30),
  soc: z.object({ companyId: code, units: z.array(code).min(1).max(200) }).optional(),
  omie: z.object({ cnpj, partyCode: z.number().int().safe().positive() }).optional(),
}).strict().refine(s => !s.omie || s.cnpjs.includes(s.omie.cnpj));
type Scope = z.infer<typeof scopeSchema>;
type Selection = WorkSourceSelection;
type RdRow = { id: string; cnpj: string; day: string };
type SocForm = {id: string; employeeId: string; day: string};
const privateScopes = () => adminDb.collection("webhook_deliveries").doc("work-assistant")
  .collection("companies");

async function rdOrders(scope: Scope, q: Selection) {
  // UTC bounds include the whole final local day, including historical DST changes.
  const upper = new Date(Date.parse(q.end) + 2 * 86400000).toISOString();
  const snapshot = await adminDb.collection("integrations").doc("rd-conversas-avp")
    .collection("asoRequests").where("cnpj","in",[...new Set(scope.cnpjs)])
    .where("createdAt",">=",q.start + "T00:00:00.000Z").where("createdAt","<",upper)
    .orderBy("createdAt","asc").limit(101).select("cnpj","source","createdAt").get();
  const rows: RdRow[] = [];
  for (const doc of snapshot.docs.slice(0,100)) {
    const v = doc.data();
    if (!scope.cnpjs.includes(v.cnpj) || v.source !== "rd-conversas" ||
      !/^rd-[a-f0-9]{64}$/.test(doc.id) || typeof v.createdAt !== "string" ||
      !Number.isFinite(Date.parse(v.createdAt))) throw new Error("RD inconsistente");
    const day = workDay(new Date(v.createdAt));
    if(day >= q.start && day <= q.end) rows.push({id:doc.id,cnpj:v.cnpj,day});
  }
  return {rows,partial:snapshot.size>100};
}

const linkSchema = z.object({cnpj,companyId:code,employeeId:code,formId:code});
type Link = z.infer<typeof linkSchema>;
async function confirmedLinks(companyId: string, rows: RdRow[]) {
  const links = new Map<string,Link>();
  if (!rows.length) return links;
  const base = privateScopes().doc(companyId).collection("rdSocLinks");
  const docs = await adminDb.getAll(...rows.map(row => base.doc(row.id)));
  for(const doc of docs){
    const parsed=linkSchema.safeParse(doc.data());
    if(parsed.success) links.set(doc.id,parsed.data);
  }
  return links;
}

async function socForms(scope:Scope,q:Selection,priorityIds:string[]){
  if(!scope.soc) throw new Error("Escopo SOC pendente");
  const {companyId,units}=scope.soc;
  const roster = await socRead("employees",{companyId});
  // An employee ID shared by multiple units cannot establish the unit of an ASO.
  const eligible = new Set<string>(), excluded = new Set<string>();
  for(const person of roster){
    if(person.companyId!==companyId) throw new Error("Escopo SOC divergente");
    if(!units.includes(person.unitId)) excluded.add(person.id);
    else if(code.safeParse(person.id).success) eligible.add(person.id);
  }
  for(const id of excluded) eligible.delete(id);
  const ids=[...new Set([...priorityIds.filter(id=>eligible.has(id)),...eligible])].slice(0,50);
  const data=ids.length?await socRead("asos",{companyId,start:q.start,end:q.end,employeeIds:ids.join(",")}):[];
  const forms:SocForm[]=[];
  const seen = new Set<string>();
  for(const row of data){
    const day=fromOmieDate(row.issuedAt);
    if(!day || day<q.start || day>q.end || row.companyId!==companyId ||
      !ids.includes(row.employeeId) || !code.safeParse(row.id).success) throw new Error("Retorno SOC divergente");
    const key=row.employeeId+":"+row.id;
    if(!seen.has(key)) forms.push({id:row.id,employeeId:row.employeeId,day});
    seen.add(key);
  }
  return {forms,partial:eligible.size>ids.length,checked:ids.length};
}

const titleSchema=z.object({
  codigo_lancamento_omie:z.number().int().safe().positive(),
  codigo_cliente_fornecedor:z.number().int().safe().positive(),
  data_vencimento:z.string(),valor_documento:z.number().finite().nonnegative(),
});
async function receivables(user:AuthContext,scope:Scope,q:Selection){
  if(!scope.omie) throw new Error("Vínculo financeiro pendente");
  const binding=scope.omie;
  const session=await omieConnectorSession(user);
  const party=await session.call("partyDetail",{codigo_cliente_omie:binding.partyCode});
  if(party.codigo_cliente_omie!==binding.partyCode || typeof party.cnpj_cpf!=="string" ||
    party.cnpj_cpf.replace(/[.\/\s-]/g,"").toUpperCase()!==binding.cnpj) throw new Error("Vínculo Omie divergente");
  const raw=await session.call("receivable",{filtrar_cliente:binding.partyCode,
    filtrar_por_cpf_cnpj:binding.cnpj,filtrar_apenas_titulos_em_aberto:"S",
    ordenar_por:"CODIGO",pagina:1,registros_por_pagina:50,
    filtrar_por_data_de:toOmieDate(q.start),filtrar_por_data_ate:toOmieDate(q.end)});
  const p=z.object({pagina:z.literal(1),total_de_paginas:z.number().int().nonnegative(),
    total_de_registros:z.number().int().nonnegative(),conta_receber_cadastro:z.array(titleSchema).max(50)}).parse(raw);
  const rows=p.conta_receber_cadastro;
  if(p.total_de_registros<rows.length || (p.total_de_registros>0 && (!rows.length || !p.total_de_paginas)) ||
    (p.total_de_registros===0 && p.total_de_paginas>1) ||
    new Set(rows.map(r=>r.codigo_lancamento_omie)).size!==rows.length) throw new Error("Página Omie inconsistente");
  const lines=rows.map(r=>{
    const due=fromOmieDate(r.data_vencimento);
    if(r.codigo_cliente_fornecedor!==binding.partyCode || !due || due<q.start || due>q.end) throw new Error("Título fora do escopo");
    return "Título "+r.codigo_lancamento_omie+" · "+due+" · "+ r.valor_documento.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  });
  return ["Omie · contas a receber em aberto · CNPJ "+binding.cnpj+" · valores originais dos títulos.",
    ...lines, ...(lines.length?[]:["Nenhum título retornado no período."]),
    ...(p.total_de_registros>rows.length || p.total_de_paginas>1?["Consulta parcial: primeira página de até 50 títulos."]:[])].join("\n");
}

async function observed<T>(read:()=>Promise<T>){
  try{return await read();}catch(e){
    if(e instanceof AuthError && [401,403].includes(e.status)) throw e;
    return null;
  }
}

export async function readWorkSources(user:AuthContext,companyId:string,input:unknown){
  requirePgrCompany(user,companyId);
  const q=WorkSourceQuery.parse(input);
  const wantRd=q.source==="rd"||q.source==="rd_soc", wantSoc=q.source==="soc"||q.source==="rd_soc";
  if(wantRd) requireTallosAccess(user);
  if(wantSoc) requireSocAccess(user);
  if(q.source==="omie") requireFinancialAccess(user);
  const heading="Período "+q.start+" a "+q.end+" · consulta em "+new Date().toISOString();
  const record=await privateScopes().doc(companyId).get();
  const bound=scopeSchema.safeParse(record.data());
  if(!bound.success) return heading+"\nVínculo do cliente com as fontes pendente de validação. Consulta não executada.";
  const scope=bound.data;
  if(q.source==="omie"){
    const data=await observed(()=>receivables(user,scope,q));
    return heading+"\n"+(data??"Omie indisponível ou vínculo financeiro não validado. Total desconhecido.");
  }
  const rd=wantRd?await observed(()=>rdOrders(scope,q)):null;
  const links=rd&&wantSoc?await observed(()=>confirmedLinks(companyId,rd.rows)):null;
  const preferred=links?[...links.values()].filter(l=>l.companyId===scope.soc?.companyId).map(l=>l.employeeId):[];
  const soc=wantSoc?await observed(()=>socForms(scope,q,preferred)):null;
  const lines=[heading];
  if(wantRd) lines.push(rd?"RD Conversas · pedidos recebidos pelo webhook no recorte: "+rd.rows.length+(rd.partial?" (consulta parcial)":""):"RD Conversas indisponível. Quantidade desconhecida.");
  if(wantSoc) lines.push(soc?"SOC · "+soc.forms.length+" ASO(s) emitido(s) no período para "+soc.checked+" código(s) de colaborador consultados"+(soc.partial?" (consulta parcial, até 50 códigos).":"."):"SOC indisponível ou vínculo não validado. Emissões desconhecidas.");
  // A signed-off request-to-form association is required. No identity inference from names or dates.
  const occurrences=new Map<string,number>();
  for(const l of links?.values()??[]){const k=[l.companyId,l.employeeId,l.formId].join(":");occurrences.set(k,(occurrences.get(k)??0)+1);}
  for(const row of rd?.rows??[]){
    const l=links?.get(row.id);
    const found=l && l.cnpj===row.cnpj && l.companyId===scope.soc?.companyId &&
      occurrences.get([l.companyId,l.employeeId,l.formId].join(":"))===1 &&
      soc?.forms.find(f=>f.id===l.formId && f.employeeId===l.employeeId && f.day>=row.day);
    lines.push("RD "+row.id+" · "+row.day+(wantSoc?(found?" · ASO SOC confirmado em "+found.day:" · emissão a conferir"):""));
  }
  return lines.join("\n");
}
