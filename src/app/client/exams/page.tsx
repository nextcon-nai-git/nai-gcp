"use client";

import * as React from "react";
import {
  HeartPulse,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Loader2,
  SendHorizontal,
  CloudDownload,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { DownloadAsoButton } from "@/components/documents/download-aso-button";

export default function ClientExamsHistory() {
  const { user } = useUser();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const asoQuery = useMemoFirebase(() => {
    if (!db || !profile?.companyId) return null;
    return query(
      collection(db, "atendimentos_aso"),
      where("companyId", "==", profile.companyId),
      orderBy("data_emissao", "desc")
    );
  }, [db, profile]);

  const { data: asos, isLoading } = useCollection(asoQuery);

  // Otimização: Filtragem memorizada da lista de ASOs
  const filteredAsos = React.useMemo(() => {
    if (!asos) return [];
    if (!searchTerm.trim()) return asos;
    const lowerSearch = searchTerm.toLowerCase();
    return asos.filter((a) => (a.employeeName || "").toLowerCase().includes(lowerSearch));
  }, [asos, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Portal do RH: Vigilância Médica
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-2">
            Monitoramento de ASOs, Assinaturas Digitais e eSocial S-2220.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] tracking-widest gap-2"
          >
            <Download className="size-4" /> Exportar Tudo
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-3 group">
          <Search className="absolute left-4 top-3.5 size-4 text-slate-300 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar colaborador por nome ou CPF..."
            className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="h-12 bg-white border-none shadow-sm rounded-xl font-bold uppercase text-[10px]">
            <SelectValue placeholder="Status eSocial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="Enviado">Enviado (OK)</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-24 text-center flex flex-col items-center gap-4">
              <Loader2 className="size-12 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Sincronizando Base de Saúde...
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase py-5 pl-8">
                    Colaborador
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Data / Emissão</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">
                    ASO (Status)
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">
                    eSocial (S-2220)
                  </TableHead>
                  <TableHead className="text-right pr-8">Dossiê</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAsos.map((aso) => (
                  <TableRow key={aso.id} className="hover:bg-slate-50 transition-colors group">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                          {aso.employeeName?.substring(0, 2).toUpperCase()}
                        </div>
                        <p className="font-bold text-primary text-xs uppercase leading-tight">
                          {aso.employeeName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-primary">
                        {new Date(aso.data_emissao).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                        Assinado via NAI Cloud
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          "text-[9px] font-black uppercase border-none px-3 h-6",
                          aso.resultado === "Apto"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {aso.resultado === "Apto" ? (
                          <CheckCircle2 className="size-2.5 mr-1" />
                        ) : (
                          <AlertCircle className="size-2.5 mr-1" />
                        )}
                        {aso.resultado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] font-black uppercase h-5",
                            aso.status_esocial === "Enviado"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-orange-50 text-orange-600 border-orange-100"
                          )}
                        >
                          {aso.status_esocial === "Enviado" ? "PROTOCOLADO" : "PROCESSANDO"}
                        </Badge>
                        {aso.protocolo_governo && (
                          <span className="text-[8px] font-mono text-slate-400">
                            ID: {aso.protocolo_governo}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DownloadAsoButton
                        patientData={{
                          patientName: aso.employeeName,
                          companyName: profile?.companyName,
                          status: aso.resultado,
                          type: "Periódico",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredAsos.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest"
                    >
                      Nenhum registro localizado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[#090e24] text-white rounded-[2rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <ShieldCheck className="size-32 text-accent" />
          </div>
          <div className="relative z-10 space-y-4">
            <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.2em]">
              Blindagem Legal
            </Badge>
            <h3 className="text-lg font-black uppercase font-headline">Validade Jurídica</h3>
            <p className="text-xs text-white/60 leading-relaxed font-medium">
              Todos os documentos gerados neste portal possuem assinatura digital certificada e
              registro de metadados de emissão, garantindo plena aceitação em fiscalizações e
              perícias judiciais.
            </p>
          </div>
        </div>
        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg text-white shadow-sm">
              <Globe className="size-4" />
            </div>
            <h4 className="text-sm font-black text-primary uppercase">NAI eSocial Engine</h4>
          </div>
          <p className="text-[11px] text-primary/70 leading-relaxed font-medium italic">
            "Nosso motor de transmissão envia o evento S-2220 automaticamente para o governo assim
            que o médico finaliza o atendimento, eliminando o risco de atrasos na folha."
          </p>
        </div>
      </div>
    </div>
  );
}
