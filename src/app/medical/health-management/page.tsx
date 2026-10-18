"use client";

import * as React from "react";
import { HeartPulse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, where } from "firebase/firestore";
import { AttendanceTab } from "@/components/medical/tabs/AttendanceTab";
import { StructuredRecordTab } from "@/components/medical/tabs/StructuredRecordTab";
import { ProfessionalEvolutionTab } from "@/components/medical/tabs/ProfessionalEvolutionTab";
import { PsychosocialTab } from "@/components/medical/tabs/PsychosocialTab";
import { NewAttendanceModal } from "@/components/medical/modals/NewAttendanceModal";
import { nursingAttendanceDate } from "@/lib/medical/nursing-attendance";
import { useSgi } from "@/contexts/sgi-context";

export default function HealthManagementUnified() {
  const db = useFirestore();
  const { role, isUserLoading } = useUser();
  const { activeClientId, isGlobalStaff } = useSgi();
  const canRead = [
    "SUPER_ADMIN",
    "ADMIN",
    "DOCTOR",
    "NURSE",
    "HEALTH_PROFESSIONAL",
    "PROVIDER",
  ].includes(role || "");
  const [period, setPeriod] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const attendancesQuery = useMemoFirebase(() => {
    if (!db || !canRead || isUserLoading || !activeClientId || activeClientId === "unauthorized")
      return null;
    if (activeClientId === "all" && !isGlobalStaff) return null;
    return query(
      collection(db, "nursing_attendances"),
      ...(activeClientId === "all" ? [] : [where("companyId", "==", activeClientId)]),
      orderBy("timestamp", "desc"),
      limit(200)
    );
  }, [db, canRead, isUserLoading, activeClientId, isGlobalStaff]);
  const { data, isLoading, error } = useCollection(attendancesQuery);
  const attendances = React.useMemo(
    () =>
      (data || []).filter((item) => {
        const date = nursingAttendanceDate(item);
        return (
          date && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === period
        );
      }),
    [data, period]
  );

  if (isUserLoading) return <p role="status">Carregando acesso clínico...</p>;
  if (!canRead) return <p role="alert">Seu perfil não pode consultar dados clínicos.</p>;
  if (!attendancesQuery)
    return <p role="status">Selecione uma empresa autorizada para consultar os atendimentos.</p>;

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-primary">
            <HeartPulse /> Saúde & Prontuário Digital
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Atendimentos de enfermagem registrados na unidade selecionada.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-2 text-sm">
            Período
            <Input
              aria-label="Período"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <NewAttendanceModal />
        </div>
      </header>
      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <p>
            {isLoading
              ? "Carregando registros..."
              : error
                ? "Consulta indisponível."
                : `${attendances.length} atendimentos do período entre os registros carregados.`}
          </p>
          <p className="text-muted-foreground">
            A consulta mostra até 200 registros recentes, datados pelo servidor. Registros legados
            sem data de recebimento precisam de revisão específica. Períodos anteriores podem exigir
            uma consulta histórica. O cadastro de atendimento não transmite eventos ao eSocial nem
            determina aptidão ocupacional.
          </p>
          <p className="text-muted-foreground">
            Importação em lote indisponível nesta tela: o vínculo do paciente e a identificação
            profissional devem ser conferidos no cadastro individual.
          </p>
        </CardContent>
      </Card>
      <Tabs defaultValue="attendance">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="attendance">Atendimentos</TabsTrigger>
          <TabsTrigger value="clinical_records">Prontuário (PEP)</TabsTrigger>
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
          <TabsTrigger value="psychosocial">Psicossocial</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          {error ? (
            <p role="alert" className="p-6">
              Não foi possível consultar os atendimentos. Verifique seu acesso e tente novamente.
              Essa falha não significa ausência de registros.
            </p>
          ) : (
            <AttendanceTab attendances={attendances} loading={isLoading} />
          )}
        </TabsContent>
        <TabsContent value="clinical_records">
          <StructuredRecordTab />
        </TabsContent>
        <TabsContent value="evolution">
          <ProfessionalEvolutionTab />
        </TabsContent>
        <TabsContent value="psychosocial">
          <PsychosocialTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
