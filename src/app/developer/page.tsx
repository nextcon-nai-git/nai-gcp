"use client";

import * as React from "react";
import {
  Key,
  Webhook,
  BookOpen,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Zap,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Clock,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Network,
  Cpu,
  Globe,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function DeveloperHubPanel() {
  const { toast } = useToast();
  const { user, companyId } = useUser();
  const db = useFirestore();

  const [activeTab, setActiveTab] = React.useState("keys");
  const [showNewKeyModal, setShowNewKeyModal] = React.useState(false);
  const [keyName, setKeyName] = React.useState("");
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const keysQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, "api_keys"),
      where("clientId", "==", companyId),
      orderBy("createdAt", "desc")
    );
  }, [db, companyId]);
  const { data: keys, isLoading: loadingKeys } = useCollection(keysQuery);

  const handleCreateKey = async () => {
    if (!keyName || !companyId) return;
    setIsCreating(true);
    try {
      const response = await fetch("/api/v1/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: companyId, name: keyName }),
      });
      const data = await response.json();
      if (data.rawKey) {
        setGeneratedKey(data.rawKey);
        toast({
          title: "Chave Gerada!",
          description: "Salve-a agora, ela não será exibida novamente.",
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na Geração" });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const integrationMap = [
    {
      target: "Catracas / Relógios Ponto",
      protocol: "HTTP REST / API Local",
      mechanism: "Consulta síncrona ao /api/v1/access-control/check",
      icon: Cpu,
    },
    {
      target: "ERPs (SAP, Senior, TOTVS)",
      protocol: "Webhooks (Event-Driven)",
      mechanism: "NAI envia 'employee.clearance_changed' via HMAC",
      icon: Database,
    },
    {
      target: "Sistemas de Terceirizados",
      protocol: "REST Batch / GraphQL",
      mechanism: "Sincronização periódica de ASOs e Treinamentos",
      icon: Network,
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-2">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5 uppercase">
            M2M CONNECTIVITY HUB
          </Badge>
          <h1 className="text-4xl font-headline font-black text-primary uppercase tracking-tighter leading-none">
            Developer Portal
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.3em] mt-2 flex items-center gap-2">
            <Terminal className="size-4 text-accent" /> APIs Abertas & Webhooks de Integração
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            asChild
            className="h-12 px-6 rounded-2xl border-slate-200 text-primary font-black uppercase text-[10px] gap-2 shadow-sm hover:bg-slate-50 btn-hover-effect"
          >
            <a href="/developer/docs" target="_blank">
              <BookOpen className="size-4 text-accent" /> Documentação API
            </a>
          </Button>
          <Button
            onClick={() => {
              setGeneratedKey(null);
              setShowNewKeyModal(true);
            }}
            className="gradient-nextcon text-white h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl gap-2 btn-hover-effect"
          >
            <Plus className="size-4 text-accent" /> Gerar Credencial M2M
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-[2rem] h-16 shadow-inner">
            <TabsTrigger
              value="keys"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              Chaves de API
            </TabsTrigger>
            <TabsTrigger
              value="mapping"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              Mapeamento de Terceiros
            </TabsTrigger>
            <TabsTrigger
              value="webhooks"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              Webhooks
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="keys" className="mt-8 focus-visible:ring-0">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 text-[10px] font-black uppercase tracking-widest">
                  <TableRow className="border-none">
                    <TableHead className="pl-10 py-6">Nome / Equipamento</TableHead>
                    <TableHead>Prefixo</TableHead>
                    <TableHead>Criação</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="pr-10 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingKeys ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center">
                        <Loader2 className="animate-spin mx-auto opacity-20" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    keys?.map((k) => (
                      <TableRow
                        key={k.id}
                        className="hover:bg-slate-50/50 transition-all border-b last:border-none"
                      >
                        <TableCell className="pl-10 py-6">
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "size-10 rounded-xl flex items-center justify-center shadow-inner",
                                k.active ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                              )}
                            >
                              <Key size={18} />
                            </div>
                            <span className="font-black text-xs text-primary uppercase">
                              {k.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] font-mono font-bold text-accent bg-accent/5 px-2 py-1 rounded">
                            {k.keyPrefix}...
                          </code>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={cn(
                              "text-[8px] font-black uppercase border-none px-3 h-6 rounded-lg",
                              k.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {k.active ? "ATIVA" : "REVOGADA"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-10 text-right">
                          {k.active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-300 hover:text-red-600 transition-all"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="mt-8 focus-visible:ring-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {integrationMap.map((item) => (
              <Card
                key={item.target}
                className="card-shadow border-none bg-white rounded-[2.5rem] p-8 flex flex-col justify-between group hover:ring-2 ring-primary/5 transition-all"
              >
                <div className="space-y-6 text-left">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-slate-50 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                      <item.icon size={24} />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[8px] font-black border-slate-100 uppercase"
                    >
                      {item.protocol}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-primary uppercase font-headline">
                      {item.target}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 italic">
                      "{item.mechanism}"
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-8 h-12 rounded-xl text-primary font-black uppercase text-[9px] gap-2 hover:bg-slate-50"
                >
                  Ver Specs <ChevronRight size={14} />
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-8 focus-visible:ring-0">
          <Card className="p-32 text-center bg-white border-none rounded-[3.5rem] opacity-30 flex flex-col items-center gap-6">
            <div className="p-8 bg-slate-50 rounded-full shadow-inner">
              <Webhook size={64} className="text-primary" />
            </div>
            <div className="space-y-2">
              <p className="font-black uppercase text-sm tracking-[0.4em]">
                Engine de Webhooks Ativa
              </p>
              <p className="text-xs font-bold text-slate-400">
                Notifique seu ERP sobre mudanças de elegibilidade eSocial.
              </p>
            </div>
            <Button disabled className="h-12 px-8 rounded-xl font-black uppercase text-[10px]">
              Novo Endpoint
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE CRIAÇÃO DE CHAVE */}
      <Dialog open={showNewKeyModal} onOpenChange={setShowNewKeyModal}>
        <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-8 bg-primary text-white shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Zap size={140} className="text-accent" />
            </div>
            <div className="relative z-10 space-y-2">
              <DialogTitle className="text-2xl font-black uppercase font-headline">
                Gerar Credencial M2M
              </DialogTitle>
              <DialogDescription className="text-white/60 font-medium italic text-sm">
                Chave de acesso seguro para validação em hardware e APIs.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-8">
            {!generatedKey ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">
                    Identificação do Equipamento
                  </label>
                  <Input
                    placeholder="Ex: Catraca Portaria Principal"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="h-14 bg-slate-50 border-none rounded-xl font-bold text-primary shadow-inner"
                  />
                </div>
                <Button
                  onClick={handleCreateKey}
                  disabled={isCreating || !keyName}
                  className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 btn-hover-effect"
                >
                  {isCreating ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-5 text-accent" />
                  )}
                  Gerar Chave Live
                </Button>
              </div>
            ) : (
              <div className="space-y-8 animate-in zoom-in-95">
                <div className="p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl flex items-start gap-4 text-amber-800">
                  <ShieldAlert className="size-6 shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-sm font-black uppercase">Segurança Crítica</p>
                    <p className="text-xs font-medium leading-relaxed">
                      Copie a chave agora. Por motivos de segurança, ela não será mostrada
                      novamente!
                    </p>
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    readOnly
                    value={generatedKey}
                    className="h-16 bg-slate-900 border-none rounded-2xl font-mono text-xs text-accent px-6 pr-14 shadow-2xl"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(generatedKey)}
                    className="absolute right-3 top-3 rounded-xl text-white hover:bg-white/10"
                  >
                    {copied ? (
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    ) : (
                      <Copy className="size-5" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={() => setShowNewKeyModal(false)}
                  className="w-full h-14 bg-slate-100 text-primary hover:bg-white font-black uppercase text-[10px] rounded-2xl shadow-md"
                >
                  Concluído
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
