"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, Search } from "lucide-react";
import { collection, doc, orderBy, query, where } from "firebase/firestore";
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { DownloadAsoButton } from "@/components/documents/download-aso-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ExamRecord = {
  employeeName?: string;
  data_emissao?: string | number | { toDate: () => Date };
  resultado?: string;
  status_esocial?: string;
  protocolo_governo?: string;
  examType?: string;
};

function examDate(value: ExamRecord["data_emissao"]) {
  if (!value) return "Não informada";
  const date =
    typeof value === "object"
      ? value.toDate()
      : new Date(
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T12:00:00Z`
            : value
        );
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "Não informada";
}

export default function ClientExamsHistory() {
  const { user } = useUser();
  const db = useFirestore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const profileRef = useMemoFirebase(
    () => (db && user ? doc(db, "users", user.uid) : null),
    [db, user]
  );
  const { data: profile, error: profileError } = useDoc<{
    companyId?: string;
    companyName?: string;
  }>(profileRef);
  const asoQuery = useMemoFirebase(
    () =>
      db && profile?.companyId
        ? query(
            collection(db, "atendimentos_aso"),
            where("companyId", "==", profile.companyId),
            orderBy("data_emissao", "desc")
          )
        : null,
    [db, profile?.companyId]
  );
  const { data: records, isLoading, error } = useCollection<ExamRecord>(asoQuery);
  const statuses = useMemo(
    () => [...new Set((records || []).map((record) => record.status_esocial).filter(Boolean))],
    [records]
  );
  const filtered = (records || []).filter(
    (record) =>
      (!status || record.status_esocial === status) &&
      (record.employeeName || "")
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR"))
  );

  return (
    <section className="space-y-5 pb-10">
      <header>
        <h1 className="text-2xl font-semibold text-primary">Histórico de ASOs</h1>
        <p className="mt-1 text-sm text-slate-600">Registros de exames da sua empresa.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-500" />
          <Input
            aria-label="Buscar colaborador por nome"
            placeholder="Buscar colaborador por nome"
            className="bg-white pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Status registrado no eSocial"
          className="h-10 rounded-md border bg-white px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos os status registrados</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      {error || profileError ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Não foi possível consultar os exames. Confira o acesso à empresa e tente novamente.
        </p>
      ) : !user ? (
        <p role="status">Entre na sua conta para consultar os exames.</p>
      ) : isLoading ? (
        <p role="status" className="flex items-center gap-2 p-5 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando exames…
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Colaborador</th>
                <th className="p-4">Data de emissão</th>
                <th className="p-4">Resultado registrado</th>
                <th className="p-4">eSocial S-2220</th>
                <th className="p-4">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-t">
                  <td className="p-4 font-medium">{record.employeeName || "Nome não informado"}</td>
                  <td className="p-4">{examDate(record.data_emissao)}</td>
                  <td className="p-4">
                    <Badge variant="outline" className="gap-1">
                      {record.resultado === "Apto" && (
                        <CheckCircle2 aria-hidden="true" className="size-3" />
                      )}
                      {record.resultado || "Não informado"}
                    </Badge>
                  </td>
                  <td className="space-y-1 p-4">
                    <p className="text-xs">
                      Status interno: {record.status_esocial || "Não informado"}
                    </p>
                    {record.protocolo_governo && (
                      <p className="max-w-56 break-all text-xs text-slate-500">
                        Protocolo informado: {record.protocolo_governo}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Recibo do evento não verificado nesta tela.
                    </p>
                  </td>
                  <td className="p-4">
                    {record.employeeName ? (
                      <DownloadAsoButton
                        patientData={{
                          patientName: record.employeeName,
                          companyName: profile?.companyName,
                          status: record.resultado || "Não informado",
                          type: record.examType,
                        }}
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Cadastro incompleto</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    Nenhum registro localizado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-1 flex items-center gap-2 font-medium text-slate-800">
            <FileText className="size-4" />
            Documento original
          </p>
          <p>
            O download desta tela gera um resumo do cadastro. A assinatura deve ser conferida no ASO
            original arquivado pela equipe responsável.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-1 font-medium text-slate-800">Comprovação no eSocial</p>
          <p>
            O aceite depende do recibo do evento. Um protocolo de lote ou status interno não
            confirma esse aceite. A equipe responsável prepara, autoriza e acompanha a transmissão.
          </p>
        </div>
      </div>
    </section>
  );
}
