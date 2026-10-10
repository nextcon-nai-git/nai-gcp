"use client";

import * as React from "react";
import Link from "next/link";
import { Video, Loader2, Plus, ExternalLink } from "lucide-react";
import {
  collection,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { isValidMeetUrl, prepareAppointment } from "@/lib/telemedicine";

export default function TelemedicinePage() {
  const { user, role } = useUser();
  if (!user) return <p role="status">Entre no NAI para consultar os agendamentos.</p>;
  if (!["SUPER_ADMIN", "ADMIN", "OPERATIONS"].includes(role || "")) {
    return (
      <p role="alert">A agenda administrativa está disponível à equipe autorizada de operações.</p>
    );
  }
  return <Appointments key={user.uid} userId={user.uid} />;
}

function Appointments({ userId }: { userId: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const emptyForm = {
    pacienteEmail: "",
    medicoEmail: "",
    data: "",
    hora: "",
    titulo: "Videoconsulta Nextcon",
    linkMeet: "",
  };
  const [form, setForm] = React.useState(emptyForm);
  const appointmentsQuery = useMemoFirebase(
    () =>
      db
        ? query(collection(db, "agendamentos_telemedicina"), orderBy("inicio", "desc"), limit(50))
        : null,
    [db]
  );
  const { data: appointments, isLoading, error } = useCollection(appointmentsQuery);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!db || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const appointment = prepareAppointment(form);
      await addDoc(collection(db, "agendamentos_telemedicina"), {
        titulo: appointment.titulo,
        paciente_email: appointment.pacienteEmail,
        medico_email: appointment.medicoEmail,
        inicio: Timestamp.fromDate(appointment.start),
        fim: Timestamp.fromDate(appointment.end),
        link_meet: appointment.linkMeet,
        status: "agendada",
        is_mock: false,
        invitationStatus: "not_sent",
        createdBy: userId,
        createdAt: serverTimestamp(),
      });
      toast({
        title: "Agendamento salvo",
        description:
          "Compartilhe o link com os participantes. Nenhum convite foi enviado automaticamente.",
      });
      setForm(emptyForm);
      setOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Agendamento não salvo",
        description:
          error instanceof Error && error.name !== "FirebaseError"
            ? error.message
            : "Verifique a conexão e sua permissão antes de tentar novamente.",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
            <Video /> Telemedicina
          </h1>
          <p className="text-muted-foreground mt-2">
            Agenda administrativa de videoconsultas · horários de Brasília
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!saving) setOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Novo agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar videoconsulta</DialogTitle>
              <DialogDescription>
                Crie a sala no Google Meet e cole o link abaixo. O NAI registra o horário; o envio
                dos convites é manual.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              {(
                [
                  ["titulo", "Título", "text"],
                  ["pacienteEmail", "E-mail do paciente", "email"],
                  ["medicoEmail", "E-mail do médico", "email"],
                  ["data", "Data", "date"],
                  ["hora", "Horário de Brasília (30 minutos)", "time"],
                  ["linkMeet", "Link da sala Google Meet", "url"],
                ] as const
              ).map(([field, label, type]) => (
                <div className="space-y-1" key={field}>
                  <Label htmlFor={field}>{label}</Label>
                  <Input
                    id={field}
                    type={type}
                    required
                    disabled={saving}
                    value={form[field]}
                    maxLength={field === "titulo" ? 200 : 254}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  />
                </div>
              ))}
              <Button type="submit" disabled={saving || !db} className="w-full">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar agendamento
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        Não há integração automática de sala, convites ou dispositivos de sinais vitais. Informações
        clínicas devem ser registradas no módulo de saúde, com acesso autorizado.
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Últimos 50 agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status">Carregando agendamentos…</p>
          ) : error ? (
            <p role="alert">
              Não foi possível consultar a agenda. Verifique seu acesso e tente novamente.
            </p>
          ) : !appointments?.length ? (
            <p className="text-muted-foreground">Nenhum agendamento cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appointment) => {
                const date = appointment.inicio?.toDate?.();
                const validDate = date instanceof Date && Number.isFinite(date.getTime());
                const roomAvailable =
                  appointment.is_mock === false && isValidMeetUrl(appointment.link_meet);
                return (
                  <article
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <h2 className="font-semibold">{appointment.titulo || "Videoconsulta"}</h2>
                      <p className="text-sm break-all">
                        {appointment.paciente_email || "Paciente não informado"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Médico: {appointment.medico_email || "Não informado"}
                      </p>
                      <p className="text-sm">
                        {validDate
                          ? date.toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "Data não informada"}
                      </p>
                      <Badge variant="outline">
                        {appointment.status || "Status não informado"}
                      </Badge>
                    </div>
                    {roomAvailable ? (
                      <Button asChild variant="outline">
                        <a href={appointment.link_meet} target="_blank" rel="noopener noreferrer">
                          Abrir sala informada
                          <ExternalLink className="ml-2 size-4" />
                        </a>
                      </Button>
                    ) : (
                      <p className="text-sm text-amber-700">
                        Link antigo ou simulado: confirme a sala com o responsável.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Button asChild variant="outline">
        <Link href="/health-control">Abrir saúde ocupacional</Link>
      </Button>
    </div>
  );
}
