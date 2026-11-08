// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {AuthContext} from "@/lib/auth/auth-context";
import {WorkSourceQuery, currentWorkWeek} from "@/lib/work-source-query";

const m=vi.hoisted(()=>({scope:vi.fn(),rd:vi.fn(),links:vi.fn(),soc:vi.fn(),omie:vi.fn(),session:vi.fn(), where:vi.fn()}));
vi.mock("@/lib/firebase-admin",()=>({adminDb:{
  collection:(name:string)=>({doc:()=>({collection:()=>name==="webhook_deliveries"?
    {doc:()=>({get:m.scope,collection:()=>({doc:(id:string)=>id})})}:
    {where:m.where}})}),
  getAll:m.links,
}}));
vi.mock("@/lib/integrations/soc",async original=>({...await original<typeof import("@/lib/integrations/soc")>(),socRead:m.soc}));
vi.mock("@/services/omie-financial",()=>({omieConnectorSession:m.session}));
import {readWorkSources} from "./work-source-read";

const cnpj="12345678000195",other="11111111000191",id="rd-"+"a".repeat(64);
const user={uid:"u",role:"SUPER_ADMIN",tenantId:null,servedCompanies:[]} as unknown as AuthContext;
const selection={source:"rd_soc",start:"2026-11-02",end:"2026-11-08"};
const config={cnpjs:[cnpj],soc:{companyId:"11",units:["3"]},omie:{partyCode:45,cnpj}};
const doc=(id:string,data:Record<string,unknown>)=>({id,data:()=>data});
const row={id:"7",employeeId:"9",companyId:"11",issuedAt:"05/11/2026"};
const incoming={cnpj,source:"rd-conversas",createdAt:"2026-11-03T15:00:00.000Z"};
beforeEach(()=>{
  vi.resetAllMocks();
  m.scope.mockResolvedValue(doc("C",config));
  const query={where:m.where,orderBy:()=>query,limit:()=>query,select:()=>query,get:m.rd};
  m.where.mockReturnValue(query);
  m.rd.mockResolvedValue({docs:[doc(id,incoming)],size:1});
  m.links.mockResolvedValue([doc(id,{cnpj,companyId:"11",employeeId:"9",formId:"7"})]);
  m.soc.mockImplementation(async(resource:string)=>resource==="employees"?[{id:"9",unitId:"3",companyId:"11"}]:[row]);
  m.session.mockResolvedValue({call:m.omie});
});
describe("consultas do assistente",()=>{
  it("confirma só o vínculo documentado e não duplica linhas do mesmo ASO",async()=>{
    m.soc.mockResolvedValueOnce([{id:"9",unitId:"3",companyId:"11"}]).mockResolvedValueOnce([row,row]);
    const s=await readWorkSources(user,"client",selection);
    expect(s).toContain("ASO SOC confirmado em 2026-11-05");
    expect(s).toContain("1 ASO(s)");
    expect(m.where).toHaveBeenCalledWith("cnpj","in",[cnpj]);
  });
  it("não atribui por nome, ficha fora da unidade ou vínculo de outro CNPJ",async()=>{
    m.links.mockResolvedValue([doc(id,{cnpj:other,companyId:"11",employeeId:"9",formId:"7"})]);
    expect(await readWorkSources(user,"client",selection)).toContain("emissão a conferir");
    m.links.mockResolvedValue([]);
    expect(await readWorkSources(user,"client",selection)).not.toContain("ASO SOC confirmado");
    m.soc.mockResolvedValueOnce([{id:"9",unitId:"22",companyId:"11"}]);
    expect(await readWorkSources(user,"client",selection)).toContain("0 código(s)");
  });
  it("rejeita dados fora do escopo e mantém fontes indisponíveis desconhecidas",async()=>{
    m.rd.mockResolvedValue({docs:[doc(id,{...incoming,cnpj:other})],size:1});
    m.soc.mockRejectedValue(new Error("upstream secret"));
    const answer=await readWorkSources(user,"client",selection);
    expect(answer).toContain("RD Conversas indisponível");
    expect(answer).toContain("SOC indisponível");
    expect(answer).not.toContain("upstream secret");
  });
  it("preserva a consulta RD se o SOC estiver fora do ar",async()=>{
    m.soc.mockRejectedValue(new Error("offline"));
    const answer=await readWorkSources(user,"client",selection);
    expect(answer).toContain(id);
    expect(answer).toContain("emissão a conferir");
    expect(answer).not.toContain("0 ASO");
  });
  it("bloqueia acesso sem vínculo ou sem perfil antes da consulta aos fornecedores",async()=>{
    m.scope.mockResolvedValue(doc("C",{}));
    expect(await readWorkSources(user,"client",selection)).toContain("pendente");
    expect(m.soc).not.toHaveBeenCalled();
    await expect(readWorkSources({...user,role:"CLIENT_ADMIN",tenantId:"outro"},"client",selection)).rejects.toThrow();
    expect(m.scope).toHaveBeenCalledTimes(1);
  });
  it("confere o favorecido e a data de cada título antes da exibição",async()=>{
    const title={codigo_lancamento_omie:123,codigo_cliente_fornecedor:45,data_vencimento:"06/11/2026",valor_documento:40};
    const page={pagina:1,total_de_paginas:1,total_de_registros:1,conta_receber_cadastro:[title]};
    const party={codigo_cliente_omie:45,cnpj_cpf:cnpj};
    const ask=()=>readWorkSources(user,"client",{...selection,source:"omie"});
    m.omie.mockResolvedValueOnce(party).mockResolvedValueOnce(page);
    expect(await ask()).toContain("Título 123 · 2026-11-06");
    expect(m.omie.mock.calls.map(c=>c[0])).toEqual(["partyDetail","receivable"]);
    m.omie.mockResolvedValueOnce(party).mockResolvedValueOnce({...page,conta_receber_cadastro:[{...title,codigo_cliente_fornecedor:99}]});
    expect(await ask()).not.toContain("Título 123");
    m.omie.mockResolvedValueOnce({...party,cnpj_cpf:other});
    expect(await ask()).toContain("Total desconhecido");
  });
  it("respeita a semana de Brasília e rejeita datas e argumentos de outro cliente",()=>{
    expect(currentWorkWeek(new Date("2026-11-09T01:00:00Z"))).toEqual({start:"2026-11-02",end:"2026-11-08"});
    for(const query of [{...selection,start:"2026-02-30"},{...selection,end:"2027-01-01"},{...selection,companyId:"outro"}])
      expect(WorkSourceQuery.safeParse(query).success).toBe(false);
  });
});
