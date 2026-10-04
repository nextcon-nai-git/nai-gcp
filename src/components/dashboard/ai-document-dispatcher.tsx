"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Sparkles,
  Bot,
  ArrowRight,
  Loader2,
  FileText,
  Building2,
  User,
  Calendar,
  ShieldCheck,
  X,
  FileCheck2,
  FolderCheck,
  Stethoscope,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES } from "@/lib/real-data";
import { cn } from "@/lib/utils";

export interface ClassificationResult {
  category: string;
  title: string;
  companyName: string | null;
  companyCnpj: string | null;
  employeeName: string | null;
  employeeCpf: string | null;
  providerName: string | null;
  providerCnpjOrCrm: string | null;
  documentDate: string | null;
  amount: number | null;
  summary: string;
  destinationRoute: string;
  destinationLabel: string;
  confidence: number;
}

export function AiDocumentDispatcher() {
  const router = useRouter();
  const { user } = useUser();
  const { activeClientId } = useSgi();
  const { toast } = useToast();

  const activeCompanyObj = REAL_COMPANIES.find((c) => c.id === activeClientId);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analyzedFile, setAnalyzedFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ClassificationResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDispatching, setIsDispatching] = React.useState(false);

  // Campos editáveis
  const [editableTitle, setEditableTitle] = React.useState("");
  const [editableCompany, setEditableCompany] = React.useState("");
  const [editableEmployee, setEditableEmployee] = React.useState("");
  const [editableProvider, setEditableProvider] = React.useState("");
  const [editableDate, setEditableDate] = React.useState("");

  const processFile = async (file: File) => {
    setAnalyzedFile(file);
    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result as string;

        const res = await fetch("/api/ai-classify-document", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await user!.getIdToken()}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileBase64: base64Data,
            activeClientName: activeCompanyObj?.name || "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA",
          }),
        });

        const data = await res.json();
        setIsAnalyzing(false);

        if (data.success && data.result) {
          const resObj = data.result as ClassificationResult;
          setResult(resObj);
          setEditableTitle(resObj.title);
          setEditableCompany(
            resObj.companyName ||
              activeCompanyObj?.name ||
              "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA"
          );
          setEditableEmployee(resObj.employeeName || "");
          setEditableProvider(resObj.providerName || "");
          setEditableDate(resObj.documentDate || new Date().toISOString().split("T")[0]);

          setIsDialogOpen(true);
          toast({
            title: "Documento Analisado por IA Gemini 3.8! ✨",
            description: `Classificado para o módulo: ${resObj.destinationLabel}`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro na Leitura por IA",
            description: data.error || "Não foi possível analisar o arquivo.",
          });
        }
      };
    } catch (e: any) {
      setIsAnalyzing(false);
      toast({
        variant: "destructive",
        title: "Erro no Processamento",
        description: e.message,
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!result) return;
    setIsDispatching(true);

    try {
      const res = await fetch("/api/ai-classify-document/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user!.getIdToken()}`,
        },
        body: JSON.stringify({
          fileName: analyzedFile?.name || "Documento IA",
          title: editableTitle || result.title || "Documento SST",
          category: result.category || "OUTROS",
          companyName: editableCompany || result.companyName || "Empresa",
          companyCnpj: result.companyCnpj || null,
          employeeName: editableEmployee || null,
          employeeCpf: result.employeeCpf || null,
          providerName: editableProvider || null,
          providerCnpjOrCrm: result.providerCnpjOrCrm || null,
          documentDate:
            editableDate || result.documentDate || new Date().toISOString().split("T")[0],
          destinationRoute: result.destinationRoute || "/documents",
          destinationLabel: result.destinationLabel || "Repositório Geral",
          summary: result.summary || "",
          dispatchedBy: user?.email || "IA Auto Dispatcher",
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.createdCompany) {
          toast({
            title: "Novo Cliente Cadastrado! 🏢",
            description: `Empresa "${editableCompany}" adicionada à base.`,
          });
        }
        if (data.createdProvider) {
          toast({
            title: "Novo Prestador Cadastrado! 🩺",
            description: `Prestador "${editableProvider}" adicionado e vinculado.`,
          });
        } else if (data.linkedProvider) {
          toast({
            title: "Prestador Vinculado! 🔗",
            description: `Vínculo atualizado entre "${editableProvider}" e ${editableCompany}.`,
          });
        }

        toast({
          title: "Documento Protocolado com Sucesso! 🚀",
          description: `Base atualizada e redirecionando para ${result.destinationLabel}`,
        });

        setIsDialogOpen(false);
        setTimeout(() => {
          router.push(result.destinationRoute);
        }, 400);
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao Salvar",
          description: data.error || "Não foi possível salvar a destinação.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro de Conexão ao Salvar",
        description: e.message,
      });
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
      />

      <Card className="border border-primary/20 hover:border-accent bg-gradient-to-r from-slate-900 via-primary to-[#001F3F] text-white rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300">
        <CardContent className="p-8">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl transition-all border-2 border-dashed border-white/10",
              isDragging
                ? "bg-accent/20 border-accent scale-[1.01]"
                : "hover:bg-white/5 hover:border-accent/40"
            )}
          >
            <div className="flex items-center gap-5">
              <div className="p-4 bg-accent/20 border border-accent/40 rounded-2xl text-accent shadow-lg">
                {isAnalyzing ? (
                  <Loader2 className="size-8 animate-spin text-accent" />
                ) : (
                  <Bot className="size-8 text-accent" />
                )}
              </div>
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <Badge className="bg-accent text-primary font-black text-[8px] tracking-[0.3em] px-2.5 h-5 uppercase">
                    HUB MULTIMODAL IA NAI
                  </Badge>
                  <span className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="size-3" /> Auto Cadastro de Clientes & Prestadores
                  </span>
                </div>
                <h3 className="text-xl font-headline font-black uppercase text-white tracking-tight">
                  Upload & Protocolo Inteligente de Documentos
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  Arraste qualquer ASO, PGR, PCMSO ou Extrato. A IA cria clientes/prestadores e
                  destina automaticamente aos cards do sistema.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                disabled={isAnalyzing}
                className="bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[10px] tracking-widest h-14 px-8 rounded-2xl shadow-xl gap-2 transition-all hover:scale-105"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1" />
                    Processando com IA...
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-5" />
                    Enviar & Destinar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIÁLOGO EXECUTIVO DE CONFIRMAÇÃO E VÍNCULO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-[2.5rem] p-8 border-none shadow-2xl text-left">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center justify-between">
              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-black text-[9px] uppercase px-3 h-6 tracking-widest gap-1.5">
                <ShieldCheck className="size-3.5" /> NAI IA Confiança: {result?.confidence}%
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-full"
              >
                <X className="size-4" />
              </Button>
            </div>
            <DialogTitle className="text-2xl font-black text-primary font-headline uppercase tracking-tight">
              Análise e Vínculo Concluído
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Valide e edite o Cliente, Prestador e Colaborador antes de atualizar os cards.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-6 my-2">
              {/* CARD DE DESTINO EXECUTIVO */}
              <div className="p-6 bg-gradient-to-r from-primary to-[#001F3F] text-white rounded-3xl space-y-2 shadow-xl border border-primary/30">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-1.5">
                    <FolderCheck className="size-3.5" /> Módulo & Base de Destino
                  </span>
                  <Badge className="bg-accent text-primary font-black text-[9px] uppercase px-3 h-5">
                    {result.destinationRoute}
                  </Badge>
                </div>
                <h4 className="text-xl font-headline font-black uppercase text-white tracking-tight">
                  {result.destinationLabel}
                </h4>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {result.summary}
                </p>
              </div>

              {/* CAMPOS EDITÁVEIS PARA CADASTRO & VÍNCULO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                    <FileText size={12} className="text-primary" /> Título do Documento
                  </label>
                  <Input
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                    <Building2 size={12} className="text-primary" /> Cliente / Empresa (Auto-Cria)
                  </label>
                  <Input
                    value={editableCompany}
                    onChange={(e) => setEditableCompany(e.target.value)}
                    placeholder="Nome do Cliente"
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                    <Stethoscope size={12} className="text-primary" /> Prestador / Clínica
                    (Auto-Cria/Víncula)
                  </label>
                  <Input
                    value={editableProvider}
                    onChange={(e) => setEditableProvider(e.target.value)}
                    placeholder="Clínica / Médico Responsável"
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                    <User size={12} className="text-primary" /> Colaborador (Auto-Cadastra)
                  </label>
                  <Input
                    value={editableEmployee}
                    onChange={(e) => setEditableEmployee(e.target.value)}
                    placeholder="Nome do Colaborador"
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-medium text-xs"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                    <Calendar size={12} className="text-primary" /> Data de Emissão / Vigor
                  </label>
                  <Input
                    type="date"
                    value={editableDate}
                    onChange={(e) => setEditableDate(e.target.value)}
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold text-xs"
                  />
                </div>
              </div>

              {/* BOTÃO PRINCIPAL DE CONFIRMAÇÃO */}
              <Button
                onClick={handleConfirmDispatch}
                disabled={isDispatching}
                className="w-full h-16 bg-accent hover:bg-accent/90 text-primary font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-[1.01] gap-2 mt-2"
              >
                {isDispatching ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <FileCheck2 className="size-5 text-primary" />
                    Salvar, Criar Base & Ir Para {result.destinationLabel}
                    <ArrowRight className="size-5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
