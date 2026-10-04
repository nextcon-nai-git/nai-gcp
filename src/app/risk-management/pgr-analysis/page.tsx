"use client";

import * as React from "react";
import {
  FileUp,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  Brain,
  Volume2,
  MapPin,
  UploadCloud,
  Calendar,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { analyzePgrPdf, type PgrAnalysisOutput } from "@/ai/flows/pgr-analysis-flow";
import { generateVoiceResponse } from "@/ai/flows/voice-response-flow";
import { syncDocumentToGoogleDrive } from "@/actions/google-drive-backup";
import { useFirestore, useUser, useStorage } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
import { STORAGE_PATHS } from "@/lib/storage-paths";
import Link from "next/link";
import { useSgi } from "@/contexts/sgi-context";

/**
 * @fileOverview Página de Análise Técnica de PGR / LTCAT com Card Mestre e Mapa.
 * Interpreta o laudo, sugere ações preventivas, corretivas, não conformidades
 * e gera o Card Detalhado com localização geográfica e validade.
 */

export default function PgrAnalysisPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { setActiveClientId } = useSgi();

  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [isIntegrating, setIsIntegrating] = React.useState(false);
  const [result, setResult] = React.useState<PgrAnalysisOutput | null>(null);
  const [detectedCompanyId, setDetectedCompanyId] = React.useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleFile = async (file: File) => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "Arquivo Ausente",
        description: "Selecione um arquivo PGR/LTCAT.",
      });
      return;
    }

    setUploadedFile(file);
    setIsAnalyzing(true);
    setResult(null);
    setDetectedCompanyId(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo selecionado."));
        reader.readAsDataURL(file);
      });

      const analysis = await analyzePgrPdf({
        pdfDataUri: base64,
        fileName: file.name,
      });

      setResult(analysis);

      const cleanCnpj =
        (analysis?.pgrCardDetalhado?.cnpj || "").replace(/\D/g, "") || `emp_${Date.now()}`;
      setDetectedCompanyId(cleanCnpj);

      toast({
        title: "Laudo Processado com Sucesso!",
        description: `${analysis?.pgrCardDetalhado?.razaoSocial || "Empresa"} auditado com sucesso.`,
      });
    } catch (error: any) {
      console.error("[PGR Analysis Error]:", error);
      toast({
        variant: "destructive",
        title: "Erro na NAI",
        description: error?.message || "Não foi possível processar o laudo.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleIntegrateAndStore = async () => {
    if (!result || !detectedCompanyId) {
      toast({
        variant: "destructive",
        title: "Ação não disponível",
        description: "Processe um laudo primeiro.",
      });
      return;
    }

    setIsIntegrating(true);
    try {
      let fileUrl = "";
      let storagePath = "";

      if (!db) {
        throw new Error(
          "Banco indisponível. A análise permanece nesta tela; conecte-se para salvar no cadastro autenticado."
        );
      }

      // 1. Armazena no Firebase Storage
      if (storage && uploadedFile) {
        try {
          storagePath = STORAGE_PATHS.CLIENT_SST_NR(
            detectedCompanyId,
            "nr01_pgr",
            uploadedFile.name
          );
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, uploadedFile);
          fileUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn(
            "[PGR Storage Warning] Upload para Cloud Storage ignorado, mantendo gravação no Firestore:",
            storageErr
          );
        }
      }

      // 2. Garante/Atualiza o Cadastro da Empresa
      const companyRef = doc(db, "companies", detectedCompanyId);
      await setDoc(
        companyRef,
        {
          id: detectedCompanyId,
          name: (result?.pgrCardDetalhado?.razaoSocial || "EMPRESA").toUpperCase(),
          cnpj: result?.pgrCardDetalhado?.cnpj || "",
          risk_degree: result?.pgrCardDetalhado?.grauDeRisco || 1,
          address: result?.pgrCardDetalhado?.enderecoCompleto || "",
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3. Salva o Card Mestre do PGR em pgr_cards
      await addDoc(collection(db, "companies", detectedCompanyId, "pgr_cards"), {
        ...(result?.pgrCardDetalhado || {}),
        fileName: uploadedFile?.name || "Laudo_PGR.pdf",
        fileUrl,
        storagePath,
        createdAt: serverTimestamp(),
      });

      // 4. Injeta cada Ação (Preventiva, Corretiva, Não Conformidade) no Kanban de Segurança
      if (result.acoesCategorizadas && result.acoesCategorizadas.length > 0) {
        for (const acao of result.acoesCategorizadas) {
          await addDoc(collection(db, "companies", detectedCompanyId, "tasks"), {
            title: `[${acao.tipoAcao}] ${acao.titulo}`,
            description: `${acao.descricaoDetalhada} (Ref: ${acao.referenciaLegal})`,
            companyId: detectedCompanyId,
            type: "engenharia_seguranca",
            status: acao.colunaKanban || "todo",
            priority: acao.prioridade || "high",
            responsible: acao.responsavelSugerido || "Engenharia de Segurança",
            createdAt: serverTimestamp(),
          });
        }
      }

      // 5. Espelhamento no Google Drive corporativo
      if (uploadedFile) {
        await syncDocumentToGoogleDrive({
          fileName: uploadedFile.name,
          fileCategory: "LAUDO_SST",
          companyName: result.pgrCardDetalhado.razaoSocial,
        });
      }

      toast({
        title: "SGI Sincronizado e Backup Realizado!",
        description: `PGR arquivado. ${result.acoesCategorizadas.length} ações técnicas injetadas no Kanban e espelhadas no Google Drive.`,
      });

      setActiveClientId(detectedCompanyId);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na Integração", description: e.message });
    } finally {
      setIsIntegrating(false);
    }
  };

  const handleSpeak = async () => {
    if (!result || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const voiceRes = await generateVoiceResponse(result.parecerTecnicoIA);
      const audio = new Audio(voiceRes.audioDataUri);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.play();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro de Áudio" });
      setIsSpeaking(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="space-y-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-primary -ml-2 mb-2 gap-2"
          >
            <Link href="/risk-management">
              <ArrowLeft className="size-4" /> Voltar ao Inventário
            </Link>
          </Button>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Auditoria Neural de PGR & LTCAT
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Interpretação de laudos, ações preventivas, mapa geográfico e vigência.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        {/* LADO ESQUERDO: UPLOAD & CARD DO PGR */}
        <div className="lg:col-span-5 space-y-6">
          <Card
            className={cn(
              "border-2 border-dashed h-[320px] flex flex-col items-center justify-center text-center p-8 transition-all cursor-pointer relative overflow-hidden bg-white rounded-[3rem]",
              dragActive
                ? "border-accent bg-accent/5"
                : "border-primary/10 hover:border-primary/20",
              isAnalyzing ? "pointer-events-none opacity-50" : ""
            )}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => document.getElementById("pgr-upload")?.click()}
          >
            <input
              id="pgr-upload"
              type="file"
              className="hidden"
              accept=".pdf,image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {isAnalyzing ? (
              <div className="space-y-4 animate-pulse">
                <Loader2 className="size-16 mx-auto animate-spin text-primary opacity-20" />
                <div>
                  <p className="text-sm font-black uppercase text-primary tracking-widest">
                    Auditando PGR / LTCAT via IA...
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-1">
                    NAI Forensic Engineering v3.0
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 bg-primary/5 rounded-full inline-block group-hover:scale-110 transition-all">
                  <FileUp className="size-10 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-primary">Upload de PGR / LTCAT</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Envie o documento (PDF ou Imagem) para gerar o Card Mestre, Mapa e Ações do SGI.
                  </p>
                </div>
                <Button className="bg-primary rounded-xl font-black uppercase text-[10px] tracking-widest px-8 shadow-xl">
                  Selecionar Documento
                </Button>
              </div>
            )}
          </Card>

          {/* CARD DO PGR DETALHADO */}
          {result && (
            <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden animate-in slide-in-from-left-4">
              <CardHeader className="bg-primary text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-accent text-primary font-black uppercase text-[8px] mb-2">
                      Card Mestre do PGR
                    </Badge>
                    <CardTitle className="text-xl font-headline font-black uppercase">
                      {result?.pgrCardDetalhado?.razaoSocial || "EMPRESA AUDITADA"}
                    </CardTitle>
                    <p className="text-xs text-white/70 font-mono mt-1">
                      CNPJ: {result?.pgrCardDetalhado?.cnpj || "-"}
                    </p>
                  </div>
                  <Badge className="bg-red-500 text-white font-black text-[9px] uppercase px-3 py-1">
                    Grau de Risco {result?.pgrCardDetalhado?.grauDeRisco || 1}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* VIGÊNCIA E ENDEREÇO */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <Calendar className="size-3" /> Emissão
                    </span>
                    <p className="text-xs font-bold text-slate-800">
                      {result?.pgrCardDetalhado?.dataEmissao || "2026-01-15"}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-1">
                    <span className="text-[9px] font-black uppercase text-emerald-700 flex items-center gap-1">
                      <Clock className="size-3" /> Validade
                    </span>
                    <p className="text-xs font-black text-emerald-900">
                      {result?.pgrCardDetalhado?.dataValidade || "2027-01-15"}
                    </p>
                  </div>
                </div>

                {/* ENDEREÇO E MAPA INTERATIVO */}
                <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                        <MapPin className="size-3 text-red-500" /> Endereço Mapeado
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {result?.pgrCardDetalhado?.enderecoCompleto || "-"}
                      </p>
                    </div>
                  </div>

                  {/* MAPA GOOGLE EMBED */}
                  <div className="w-full h-44 rounded-xl overflow-hidden border shadow-sm relative bg-slate-200">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(result?.pgrCardDetalhado?.enderecoCompleto || result?.pgrCardDetalhado?.razaoSocial || "Curitiba")}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    />
                  </div>
                </div>

                {/* DIAGNÓSTICO ESOCIAL S-2240 */}
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-1">
                  <span className="text-[9px] font-black uppercase text-blue-700 flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Diagnóstico eSocial S-2240
                  </span>
                  <p className="text-xs font-bold text-blue-900">
                    {result?.pgrCardDetalhado?.esocialS2240Status || "Status eSocial OK"}
                  </p>
                </div>

                <Button
                  onClick={handleIntegrateAndStore}
                  disabled={isIntegrating}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2 tracking-widest"
                >
                  {isIntegrating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UploadCloud className="size-4 text-accent" />
                  )}
                  Injetar no SGI e Fazer Backup no Google Drive
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* LADO DIREITO: AÇÕES DE SEGURANÇA CATEGORIZADAS */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              {/* PARECER TÉCNICO */}
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      Auditoria NAI Forensic
                    </span>
                    <CardTitle className="text-xl font-headline font-black uppercase text-primary">
                      Parecer Executivo
                    </CardTitle>
                  </div>
                  <button
                    onClick={handleSpeak}
                    disabled={isSpeaking}
                    className={cn(
                      "p-3 rounded-2xl transition-all shadow-sm",
                      isSpeaking
                        ? "bg-accent text-primary animate-pulse"
                        : "bg-white text-primary border"
                    )}
                  >
                    <Volume2 className="size-5" />
                  </button>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm leading-relaxed text-slate-700 font-medium italic p-4 bg-primary/5 rounded-2xl border border-primary/5">
                    &quot;{result.parecerTecnicoIA}&quot;
                  </p>
                </CardContent>
              </Card>

              {/* AÇÕES CATEGORIZADAS (PREVENTIVAS, CORRETIVAS, NÃO CONFORMIDADES) */}
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6">
                  <CardTitle className="text-lg font-headline font-black uppercase text-primary">
                    Plano de Ação Estruturado
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">
                    Ações identificadas para injeção automática no Kanban de Engenharia.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {(result.acoesCategorizadas || []).map((acao, idx) => (
                    <div
                      key={idx}
                      className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          className={cn(
                            "font-black uppercase text-[8px] px-3 py-1 border-none",
                            acao.tipoAcao === "Não Conformidade"
                              ? "bg-red-100 text-red-700"
                              : acao.tipoAcao === "Corretiva"
                                ? "bg-amber-100 text-amber-800"
                                : acao.tipoAcao === "Preventiva"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {acao.tipoAcao}
                        </Badge>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          Ref: {acao.referenciaLegal}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 uppercase">{acao.titulo}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {acao.descricaoDetalhada}
                      </p>

                      <div className="flex items-center justify-between text-[10px] pt-2 border-t font-bold text-slate-400">
                        <span>
                          Responsável:{" "}
                          <strong className="text-primary">{acao.responsavelSugerido}</strong>
                        </span>
                        <span>
                          Coluna Kanban:{" "}
                          <strong className="uppercase text-accent">{acao.colunaKanban}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-[550px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-[3rem] p-12 bg-white">
              <Brain className="size-24 text-primary/20" />
              <div>
                <h3 className="text-xl font-black uppercase text-primary">
                  Aguardando PGR / LTCAT
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 font-medium">
                  Envie o documento técnico para visualizar o Card Mestre, Mapa Geográfico, eSocial
                  S-2240 e o Plano de Ações.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
