"use client";

import * as React from "react";
import {
  CheckCircle2,
  ShieldCheck,
  SendHorizontal,
  Activity,
  Zap,
  Clock,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";

export default function EsocialAudit() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState("agrupador");
  const [isSyncingRubrics, setIsSyncingRubrics] = React.useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const queueQuery = useMemoFirebase(() => {
    if (!db || !profile?.companyId) return null;
    return query(
      collection(db, "companies", profile.companyId, "esocial_events_queue"),
      orderBy("createdAt", "desc")
    );
  }, [db, profile]);
  const { data: queueDocs } = useCollection(queueQuery);

  /**
   * Caching e Resiliência: O evento é gerado e armazenado localmente no banco.
   * Uma rotina em background (Cloud Function) tentará o envio real.
   */
  const handleSimulateEvent = async (type: string) => {
    if (!db || !profile?.companyId) return;

    const names = ["BRUNO GADELHA", "ERICK HENRIQUE", "JOÃO BESTEL"];
    const name = names[Math.floor(Math.random() * names.length)];

    let firewallMessage = "";
    let status = "approved_firewall_aguardando_transmissao";

    // Validação Firewall NAI (Camada Preventiva Local)
    if (type === "S-2240") {
      const caValido = Math.random() > 0.3;
      if (!caValido) {
        status = "blocked_pelo_firewall";
        firewallMessage = "Bloqueio NAI: EPI sem C.A. válido.";
      }
    }

    const colRef = collection(db, "companies", profile.companyId, "esocial_events_queue");
    await addDocumentNonBlocking(colRef, {
      id: `EVT-${Date.now()}`,
      eventType: type,
      employeeName: name,
      status,
      firewallMessage,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });

    toast({
      title: status.includes("blocked") ? "Evento Bloqueado" : "Evento Persistido",
      description: status.includes("blocked")
        ? "Inconsistência técnica detectada."
        : "Aguardando janela de transmissão resiliente.",
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            NAI e-Social Resilience
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest mt-2 flex items-center gap-2">
            <ShieldCheck className="size-3 text-emerald-500" /> Camada de Persistência Contra
            Instabilidade do Governo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleSimulateEvent("S-2240")}
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2"
          >
            <Zap className="size-4" /> Persistir S-2240
          </Button>
          <Button
            onClick={() => handleSimulateEvent("S-2220")}
            className="gradient-nextcon text-white h-11 px-6 rounded-xl font-black uppercase text-[10px] gap-2"
          >
            <SendHorizontal className="size-4" /> Persistir S-2220
          </Button>
        </div>
      </header>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2.5rem] flex gap-4 items-start text-left animate-in zoom-in-95">
        <Info className="size-5 text-primary shrink-0 mt-1" />
        <div className="space-y-1">
          <h4 className="text-[10px] font-black uppercase text-primary">
            Protocolo de Resiliência Ativo
          </h4>
          <p className="text-xs text-primary/70 italic leading-relaxed">
            &quot;Os eventos são gerados localmente e enfileirados. Nossa API monitora a
            estabilidade do governo e reagenda o envio automaticamente em caso de falha externa
            (HTTP 503/504).&quot;
          </p>
        </div>
      </div>

      <Card className="card-shadow border-none bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-6 px-8 flex justify-between items-center flex-row">
          <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
            <Activity className="size-5 text-accent" /> Fila de Transmissão Resiliente
          </CardTitle>
          <Badge className="bg-emerald-100 text-emerald-700 font-black uppercase text-[8px] h-6 px-3">
            Sync Online
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-8">Evento / Lote</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Status Operacional</TableHead>
                <TableHead className="pr-8">Diagnóstico / eSocial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueDocs?.map((evt) => (
                <TableRow key={evt.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="pl-8 py-5">
                    <Badge variant="outline" className="font-mono text-primary border-primary/20">
                      {evt.eventType}
                    </Badge>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                      Lote: {evt.id.substring(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-black text-xs uppercase text-primary">{evt.employeeName}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-[8px] font-black uppercase border-none px-3 h-6",
                        evt.status === "Enviado"
                          ? "bg-emerald-100 text-emerald-700"
                          : evt.status.includes("Tentando")
                            ? "bg-amber-100 text-amber-700 animate-pulse"
                            : evt.status === "blocked_pelo_firewall"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {evt.status === "Enviado"
                        ? "Transmitido"
                        : evt.status.includes("Tentando")
                          ? "Reagendado"
                          : evt.status === "blocked_pelo_firewall"
                            ? "Bloqueado"
                            : "Em Fila"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-8">
                    {evt.status === "Enviado" ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        <span className="text-[9px] font-mono text-emerald-600">
                          {evt.protocoloGoverno}
                        </span>
                      </div>
                    ) : evt.ultimoErro ? (
                      <p className="text-[9px] text-red-600 italic font-bold leading-tight flex items-center gap-1">
                        <Clock className="size-3" /> {evt.ultimoErro}
                      </p>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                        Aguardando janela segura
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
