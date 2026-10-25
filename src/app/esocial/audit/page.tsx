"use client";

import Link from "next/link";
import { useSgi } from "@/contexts/sgi-context";
import { useUser, useFirestore } from "@/firebase";
import { useCompanyDirectory } from "@/hooks/use-company-directory";
import { Button } from "@/components/ui/button";

export default function EsocialAuditPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId, canBrowseAllCompanies, authorizedCompanies } = useSgi();
  const {
    data: companies,
    isLoading,
    error,
  } = useCompanyDirectory(db, user?.uid, canBrowseAllCompanies, authorizedCompanies);
  const company = companies.find((item) => item.id === activeClientId);
  return (
    <div className="space-y-5 p-6">
      <h1 className="text-3xl font-bold">Superauditoria eSocial</h1>
      {error ? (
        <p role="alert">Consulta da empresa indisponível. Nenhuma auditoria foi realizada.</p>
      ) : isLoading ? (
        <p role="status">Consultando cadastro autorizado...</p>
      ) : company ? (
        <div>
          <h2>{company.name}</h2>
          <p>CNPJ: {company.cnpj || "não informado no cadastro"}</p>
        </div>
      ) : (
        <p role="status">Selecione uma empresa autorizada no cabeçalho.</p>
      )}
      <p role="status">
        Auditoria não realizada. O cruzamento exige registros vinculados de PGR, PCMSO, exames e
        folha. Esta tela ainda não fornece esses registros ao processamento; não há conclusão de
        conformidade ou cálculo de multas.
      </p>
      <Button disabled>Reprocessar Auditoria — fontes pendentes</Button>
      <div className="flex gap-5">
        <Link href="/nai-importa">Importar documentos de origem</Link>
        <Link href="/esocial-audit">Consultar fila de eventos eSocial</Link>
      </div>
    </div>
  );
}
