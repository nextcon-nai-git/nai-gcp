"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, limit, query } from "firebase/firestore";
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { ClientDocuments } from "@/components/clients/client-documents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SstJourney } from "@/components/dashboard/sst-journey";

type Company = {
  name?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  address?: string;
  active?: boolean;
  isDeleted?: boolean;
  risk_degree?: number | string;
  scope?: string;
  responsible_name?: string;
};
type Employee = {
  name?: string;
  job_role?: { title?: string } | string;
  department?: string;
  isDeleted?: boolean;
};
const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

export default function ClientCockpitPage() {
  const params = useParams<{ id: string }>();
  return <ClientCockpit key={params.id} clientId={params.id} />;
}

function ClientCockpit({ clientId }: { clientId: string }) {
  const db = useFirestore();
  const { setActiveClientId } = useSgi();
  const [search, setSearch] = useState("");
  const companyRef = useMemoFirebase(
    () => (db && clientId ? doc(db, "companies", clientId) : null),
    [db, clientId]
  );
  const { data: company, isLoading, error } = useDoc<Company>(companyRef);
  const employeesRef = useMemoFirebase(
    () =>
      db && company && !company.isDeleted
        ? query(collection(db, "companies", clientId, "employees"), limit(501))
        : null,
    [db, clientId, company]
  );
  const employees = useCollection<Employee>(employeesRef);
  useEffect(() => {
    if (company && !company.isDeleted) setActiveClientId(clientId);
  }, [company, clientId, setActiveClientId]);

  if (!db || isLoading)
    return (
      <p role="status" className={panel}>
        Carregando cadastro do cliente…
      </p>
    );
  if (error)
    return (
      <div role="alert" className={panel}>
        <h1 className="text-xl font-semibold">Cadastro indisponível</h1>
        <p className="mt-2">
          Não foi possível consultar este cliente. Confira seu acesso ou tente novamente.
        </p>
        <Link href="/clients" className="mt-4 inline-block text-teal-700 underline">
          Voltar aos clientes
        </Link>
      </div>
    );
  if (!company || company.isDeleted)
    return (
      <div className={panel}>
        <h1 className="text-xl font-semibold">Cliente não encontrado</h1>
        <Link href="/clients" className="mt-4 inline-block text-teal-700 underline">
          Voltar aos clientes
        </Link>
      </div>
    );
  const records = (employees.data || []).filter((employee) => !employee.isDeleted);
  const filtered = records.slice(0, 500).filter((employee) =>
    String(employee.name || "")
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR"))
  );
  const companyQuery = `?company=${encodeURIComponent(clientId)}`;
  return (
    <div className="space-y-6 pb-16 text-slate-900">
      <Link href="/clients" className="text-sm font-medium text-teal-700">
        ← Unidades & Clientes
      </Link>
      <header className="rounded-2xl bg-[#102b3b] p-6 text-white sm:p-8">
        <p className="text-xs uppercase tracking-widest text-teal-200">
          Cadastro do cliente ·{" "}
          {company.active === true
            ? "Ativo"
            : company.active === false
              ? "Inativo"
              : "Status não informado"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          {company.name || "Nome não informado"}
        </h1>
        <p className="mt-3 text-sm text-slate-200">
          CNPJ: {company.cnpj || "Não informado"} ·{" "}
          {[company.city, company.state].filter(Boolean).join(" / ") || "Localidade não informada"}
        </p>
        {company.address && <p className="mt-2 text-sm text-slate-200">{company.address}</p>}
        <p className="mt-2 text-sm text-slate-200">
          Grau de risco cadastrado: {company.risk_degree || "Não informado"}
        </p>
        {company.scope && <p className="mt-4 text-sm text-slate-200">{company.scope}</p>}
        {company.responsible_name && (
          <p className="mt-3 text-sm">Responsável cadastrado: {company.responsible_name}</p>
        )}
      </header>
      <ClientDocuments companyId={clientId} />
      <SstJourney companyId={clientId} companyName={company.name} />
      <Tabs defaultValue="colaboradores">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2">
          <TabsTrigger value="colaboradores">Quadro de Vidas</TabsTrigger>
          <TabsTrigger value="saude">Saúde (PCMSO & ASO)</TabsTrigger>
          <TabsTrigger value="engenharia">Engenharia (PGR & NRs)</TabsTrigger>
          <TabsTrigger value="prestadores">Prestadores</TabsTrigger>
          <TabsTrigger value="esocial">eSocial SST</TabsTrigger>
        </TabsList>
        <TabsContent value="colaboradores" className={panel}>
          <h2 className="text-lg font-semibold">Colaboradores cadastrados</h2>
          <p className="mt-2 text-sm text-slate-500">
            Registros salvos nesta unidade. A situação dos ASOs deve ser conferida no módulo de
            saúde.
          </p>
          <label className="mt-4 block text-sm">
            Pesquisar colaborador
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-2 block w-full rounded-lg border p-3"
              placeholder="Nome do colaborador"
            />
          </label>
          {employees.error ? (
            <p role="alert" className="mt-4 text-amber-800">
              Não foi possível ler os colaboradores. Confira as permissões de acesso.
            </p>
          ) : employees.isLoading || !employees.data ? (
            <p role="status" className="mt-4">
              Carregando colaboradores…
            </p>
          ) : (
            <>
              {employees.data.length > 500 && (
                <p className="mt-4 text-amber-800">
                  Exibindo até 500 registros. Consulte o módulo Quadro de Vidas para a gestão
                  completa.
                </p>
              )}
              <ul className="mt-4 divide-y">
                {filtered.map((employee) => (
                  <li key={employee.id} className="py-3">
                    <p className="font-medium">{employee.name || "Nome não informado"}</p>
                    <p className="text-sm text-slate-500">
                      {typeof employee.job_role === "string"
                        ? employee.job_role
                        : employee.job_role?.title || "Cargo não informado"}
                      {employee.department ? ` · ${employee.department}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              {!filtered.length && (
                <p className="mt-4 text-slate-500">
                  {search
                    ? "Nenhum colaborador corresponde à pesquisa."
                    : "Nenhum colaborador cadastrado nesta unidade."}
                </p>
              )}
            </>
          )}
          <Link className="mt-4 inline-block text-teal-700 underline" href="/employees">
            Abrir Quadro de Vidas
          </Link>
        </TabsContent>
        <TabsContent value="saude" className={panel}>
          <h2 className="text-lg font-semibold">Saúde ocupacional</h2>
          <p className="my-3 text-sm text-slate-600">
            Consulte o PCMSO e os registros clínicos autorizados para conferir exames, periodicidade
            e aptidão. O cadastro do cliente, isoladamente, não comprova ASOs em dia.
          </p>
          <Link href="/health-control" className="text-teal-700 underline">
            Abrir Clínica e ASO digital
          </Link>
          <Link href="/absenteeism" className="ml-6 text-teal-700 underline">
            Consultar afastamentos
          </Link>
        </TabsContent>
        <TabsContent value="engenharia" className={panel}>
          <h2 className="text-lg font-semibold">Engenharia e prevenção</h2>
          <p className="my-3 text-sm text-slate-600">
            Consulte os documentos anexados, o inventário e as ações da unidade. Anexar um PDF não
            equivale a validar tecnicamente seu conteúdo.
          </p>
          <Link href={`/risk-management${companyQuery}`} className="text-teal-700 underline">
            Abrir inventário
          </Link>
          <Link href={`/action-plans${companyQuery}`} className="ml-6 text-teal-700 underline">
            Abrir plano de ação
          </Link>
        </TabsContent>
        <TabsContent value="prestadores" className={panel}>
          <h2 className="text-lg font-semibold">Prestadores e rede credenciada</h2>
          <p className="my-3 text-sm text-slate-600">
            Confira os vínculos no cadastro de prestadores. A localização de uma clínica não
            comprova vínculo com este cliente.
          </p>
          <Link href="/providers" className="text-teal-700 underline">
            Abrir prestadores
          </Link>
          <Link href="/accredited-network" className="ml-6 text-teal-700 underline">
            Consultar rede credenciada
          </Link>
        </TabsContent>
        <TabsContent value="esocial" className={panel}>
          <h2 className="text-lg font-semibold">Eventos de SST eSocial</h2>
          <p className="my-3 text-sm text-slate-600">
            A transmissão deve ser confirmada por recibos e protocolos. Esta ficha não atesta
            conectividade ou envio de eventos.
          </p>
          <Link href="/esocial-audit" className="text-teal-700 underline">
            Consultar fila de eventos
          </Link>
        </TabsContent>
      </Tabs>
    </div>
  );
}
