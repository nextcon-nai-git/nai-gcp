"use client";

import * as React from "react";
import {
  FileSearch,
  UploadCloud,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  FileText,
  User,
  Stethoscope,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ExternalLink,
  ShieldQuestion,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  validateMedicalCertificate,
  type ValidatorOutput,
} from "@/ai/flows/medical-certificate-validator-flow";
import { cn } from "@/lib/utils";

export default function MedicalCertificatesPage() {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<ValidatorOutput | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "Envie apenas PDF ou Imagem.",
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const analysis = await validateMedicalCertificate({
          fileDataUri: base64,
          fileName: file.name,
        });
        setResult(analysis);

        if (analysis.authenticity === "forged") {
          toast({
            variant: "destructive",
            title: "Alerta de Fraude!",
            description: "A NAI detectou sinais críticos de falsificação.",
          });
        } else {
          toast({
            title: "Análise Concluída",
            description: "O documento foi processado pela inteligência NAI.",
          });
        }
      };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro na NAI",
        description: "Não foi possível validar o atestado.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Validador Forense de Atestados
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Triagem inteligente para detecção de fraudes e montagens digitais.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-10 text-[10px] font-black uppercase tracking-widest gap-2 bg-white"
            asChild
          >
            <a href="https://atestacfm.org.br/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5 text-blue-600" /> Atesta CFM (Oficial)
            </a>
          </Button>
          <Badge
            variant="outline"
            className="border-primary text-primary px-4 h-10 flex items-center gap-2 font-black uppercase text-[10px] bg-white"
          >
            <Sparkles className="size-4 text-accent" /> NAI Forensic Engine 2026
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card
            className={cn(
              "border-2 border-dashed h-[400px] flex flex-col items-center justify-center text-center p-10 transition-all cursor-pointer relative overflow-hidden",
              dragActive
                ? "border-accent bg-accent/5 scale-[1.01]"
                : "border-primary/10 hover:border-primary/20 bg-white",
              isAnalyzing ? "pointer-events-none opacity-50" : ""
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            />

            {isAnalyzing ? (
              <div className="space-y-4 animate-pulse">
                <Loader2 className="size-16 mx-auto animate-spin text-primary" />
                <div>
                  <p className="text-sm font-black uppercase text-primary tracking-widest">
                    NAI Analisando Pixels...
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-1">
                    Verificando CRM e Metadados do arquivo
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-6 bg-primary/5 rounded-full inline-block group-hover:scale-110 transition-transform">
                  <UploadCloud className="size-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-primary">Arraste o Atestado aqui</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Suporta PDF, PNG ou JPG. A IA analisará carimbos, assinaturas e consistência de
                    dados.
                  </p>
                </div>
                <Button className="bg-primary rounded-xl font-black uppercase text-[10px] tracking-widest px-8">
                  Selecionar Arquivo
                </Button>
              </div>
            )}
          </Card>

          <Card className="bg-[#090e24] text-white border-none p-6 rounded-[2rem] shadow-2xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2">
                <ShieldAlert className="size-4" /> Importante: Validação Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <p className="text-xs leading-relaxed opacity-70">
                A análise da NAI é uma triagem forense digital. Para uma consulta definitiva da
                autenticidade e evitar fraudes, utilize sempre a plataforma oficial{" "}
                <strong>Atesta CFM</strong>.
              </p>
              <Button
                className="w-full h-12 bg-white/10 hover:bg-white/20 text-accent font-black uppercase text-[10px] border border-accent/20"
                asChild
              >
                <a href="https://atestacfm.org.br/" target="_blank" rel="noopener noreferrer">
                  Acessar Plataforma Oficial CFM <ExternalLink className="size-3 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {result ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <Card
                className={cn(
                  "border-none shadow-2xl overflow-hidden rounded-[2.5rem]",
                  result.authenticity === "legitimate"
                    ? "bg-emerald-50"
                    : result.authenticity === "suspicious"
                      ? "bg-amber-50"
                      : "bg-red-50"
                )}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        Status de Autenticidade
                      </p>
                      <h2 className="text-3xl font-black uppercase flex items-center gap-3">
                        {result.authenticity === "legitimate" && (
                          <CheckCircle2 className="size-8 text-emerald-600" />
                        )}
                        {result.authenticity === "suspicious" && (
                          <AlertTriangle className="size-8 text-amber-600" />
                        )}
                        {result.authenticity === "forged" && (
                          <XCircle className="size-8 text-red-600" />
                        )}
                        {result.authenticity === "legitimate"
                          ? "Legítimo"
                          : result.authenticity === "suspicious"
                            ? "Suspeito"
                            : "Falsificado"}
                      </h2>
                    </div>
                    <Badge
                      className={cn(
                        "h-10 px-4 font-black border-none text-[10px]",
                        result.authenticity === "legitimate"
                          ? "bg-emerald-600"
                          : result.authenticity === "suspicious"
                            ? "bg-amber-600"
                            : "bg-red-600"
                      )}
                    >
                      {result.confidence}% Confiança
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <DataField
                      icon={User}
                      label="Paciente"
                      value={result.extractedData.patientName}
                    />
                    <DataField
                      icon={Stethoscope}
                      label="Médico / CRM"
                      value={`${result.extractedData.doctorName} (${result.extractedData.crm})`}
                    />
                    <DataField icon={Calendar} label="Data" value={result.extractedData.date} />
                    <DataField
                      icon={Building2}
                      label="Clínica"
                      value={result.extractedData.clinicName}
                    />
                  </div>

                  <div className="bg-white/50 p-6 rounded-[2rem] border-2 border-white">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3 flex items-center gap-2">
                      <FileSearch className="size-3" /> Diagnóstico NAI Forensic
                    </p>
                    <p className="text-sm leading-relaxed text-primary/80 italic">
                      "{result.reasoning}"
                    </p>
                  </div>

                  {result.redFlags.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-red-600 tracking-widest ml-1">
                        Pontos de Atenção (Red Flags)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.redFlags.map((flag, i) => (
                          <Badge
                            key={i}
                            variant="destructive"
                            className="bg-red-100 text-red-700 border-none text-[9px] font-bold"
                          >
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                  onClick={() => setResult(null)}
                >
                  Nova Análise
                </Button>
                {result.authenticity !== "legitimate" && (
                  <Button className="flex-1 h-14 rounded-2xl bg-red-600 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20">
                    Bloquear Pagamento
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 border-2 border-dashed rounded-[3rem] p-20">
              <FileSearch className="size-24 text-primary" />
              <div className="space-y-2">
                <p className="text-xl font-black uppercase text-primary tracking-widest">
                  Aguardando Documento
                </p>
                <p className="text-sm">Envie um atestado para iniciar a análise forense digital.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataField({ icon: Icon, label, value }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
        <Icon className="size-2.5" /> {label}
      </p>
      <p className="text-[11px] font-bold text-primary leading-tight truncate">
        {value || "Não identificado"}
      </p>
    </div>
  );
}
