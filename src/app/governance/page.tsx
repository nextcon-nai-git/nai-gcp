"use client";

import Link from "next/link";
import { History, Landmark, Lock, Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, limit } from "firebase/firestore";

type AccessProfile = { role?: string; companyId?: string; tenantId?: string };
type AuditLog = {
  actorId?: string;
  actorRole?: string;
  userId?: string;
  userName?: string;
  patientId?: string;
  tenantId?: string;
  action?: string;
  timestamp?: { seconds: number };
};
const actions: Record<string, string> = {
  MEDICAL_RECORD_VIEWED: "Consulta de prontuário",
  MEDICAL_RECORD_CREATED: "Criação de prontuário",
  MEDICAL_RECORD_UPDATED: "Atualização de prontuário",
  ASO_VIEWED: "Consulta de ASO",
  CERTIFICATE_VIEWED: "Consulta de atestado",
  MEDICAL_ASSISTANT_USED: "Uso do assistente clínico",
  PHI_FULL_RECORD_ACCESS: "Consulta de prontuário (registro anterior)",
};

export default function CorporateGovernance() {
  const { user } = useUser();
  const db = useFirestore();
  const profileRef = useMemoFirebase(
    () => (db && user ? doc(db, "users", user.uid) : null),
    [db, user]
  );
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useDoc<AccessProfile>(profileRef);
  // Match the read boundary in Firestore rules and hide an old account's profile immediately.
  const canReadLogs =
    !!user &&
    profile?.id === user.uid &&
    !profileLoading &&
    !profileError &&
    (profile.role === "SUPER_ADMIN" ||
      (["ADMIN", "OPERATIONS"].includes(profile.role || "") &&
        !profile.tenantId &&
        (!profile.companyId || profile.companyId === "nextcon")));
  const auditLogsQuery = useMemoFirebase(
    () =>
      db && canReadLogs
        ? query(collection(db, "phi_audit_logs"), orderBy("timestamp", "desc"), limit(10))
        : null,
    [db, canReadLogs, user]
  );
  const {
    data: auditLogs,
    isLoading: logsLoading,
    error: logsError,
  } = useCollection<AuditLog>(auditLogsQuery);
  const visibleLogs = canReadLogs && !logsError && !logsLoading ? auditLogs : null;

  return (
    <main className="space-y-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-primary">Governança e segurança</h1>
          <p className="max-w-3xl text-muted-foreground">
            Consulte registros de auditoria e identifique controles que ainda precisam de
            evidências.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/audits">Abrir gestão de auditorias</Link>
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" /> Trilha de acesso a dados de saúde
          </CardTitle>
          <CardDescription>
            Até 10 registros recentes gravados no sistema, para a equipe interna autorizada. A
            listagem abrange as unidades e não representa uma certificação ou varredura de
            segurança.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profileError || logsError ? (
            <p role="alert" className="text-sm text-red-700">
              Não foi possível consultar a trilha de auditoria. Confira a sessão e as permissões de
              acesso.
            </p>
          ) : profileLoading || (canReadLogs && logsLoading) ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando registros de auditoria…
            </p>
          ) : !canReadLogs ? (
            <p className="text-sm text-muted-foreground">
              A consulta exige uma sessão da equipe interna com permissão para acessar a trilha.
            </p>
          ) : visibleLogs?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Ação registrada</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3">Referências</th>
                    <th className="p-3">Data do registro</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="p-3">
                        {actions[log.action || ""] || log.action || "Ação não informada"}
                      </td>
                      <td className="p-3">
                        {log.actorId || log.userId || log.userName || "Responsável não informado"}
                        {log.actorRole && (
                          <span className="block text-xs text-muted-foreground">
                            {log.actorRole}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="block">Empresa: {log.tenantId || "Não informada"}</span>
                        <span className="block">Paciente: {log.patientId || "Não informado"}</span>
                      </td>
                      <td className="p-3">
                        {typeof log.timestamp?.seconds === "number" &&
                        Number.isFinite(log.timestamp.seconds) &&
                        !Number.isNaN(new Date(log.timestamp.seconds * 1000).getTime())
                          ? new Date(log.timestamp.seconds * 1000).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                            })
                          : "Data não informada"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {auditLogs
                ? "Nenhum registro retornado nesta consulta."
                : "Aguardando a primeira resposta da consulta."}
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <Badge variant="outline">Evidências pendentes</Badge>
            </div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5" /> Segurança da informação
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Criptografia, políticas de acesso, resposta a incidentes e controles ISO 27001 precisam
            de avaliação e evidências. Não há uma varredura automática conectada a esta tela.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <Badge variant="outline">Matriz não vinculada</Badge>
            </div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="size-5" /> Requisitos legais
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Nenhuma matriz legal verificada foi vinculada a este painel. A aplicabilidade e o
            atendimento de cada requisito devem ser registrados na avaliação responsável.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <Badge variant="outline">Consulta não realizada</Badge>
            </div>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5" /> Situação em bases públicas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            As consultas a CADIN, CEIS e outras bases oficiais não estão conectadas a esta tela. A
            situação da empresa precisa ser conferida na fonte responsável.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
