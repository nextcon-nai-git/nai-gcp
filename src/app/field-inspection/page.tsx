"use client";

import * as React from "react";
import {
  Camera,
  UploadCloud,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Share2,
  BrainCircuit,
  Send,
  Clock,
  User,
  MapPin,
  FileText,
  RefreshCw,
  Building2,
  HardHat,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Image as ImageIcon,
  Compass,
  Check,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES } from "@/lib/real-data";
import {
  analyzeFieldInspectionPhoto,
  FieldInspectionReport,
} from "@/ai/flows/field-inspection-flow";
import { offlineStorage } from "@/lib/offline-storage";
import { useToast } from "@/hooks/use-toast";

export default function FieldInspectionPage() {
  const { activeClientId } = useSgi();
  const { toast } = useToast();

  // Referências para Câmera Direta e Galeria (compatibilidade total Android + iOS)
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [locationName, setLocationName] = React.useState("Canteiro de Obras Principal");
  const [notes, setNotes] = React.useState("");
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [report, setReport] = React.useState<FieldInspectionReport | null>(null);
  const [expandedPlanId, setExpandedPlanId] = React.useState<string | null>(null);

  // Detecção de Dispositivo (Android, iOS ou Desktop)
  const [devicePlatform, setDevicePlatform] = React.useState<"Android" | "iOS" | "Desktop">(
    "Desktop"
  );

  // Coordenadas GPS
  const [gpsCoords, setGpsCoords] = React.useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent || "";
      if (/android/i.test(ua)) {
        setDevicePlatform("Android");
      } else if (/iphone|ipad|ipod/i.test(ua)) {
        setDevicePlatform("iOS");
      } else {
        setDevicePlatform("Desktop");
      }
    }
  }, []);

  const currentCompany = React.useMemo(() => {
    if (!activeClientId || activeClientId === "all") {
      return REAL_COMPANIES[0] || { name: "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA" };
    }
    const found = REAL_COMPANIES.find((c) => c.id === activeClientId);
    return found || { name: activeClientId };
  }, [activeClientId]);

  // Capturar coordenadas GPS do dispositivo
  const handleGetGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "GPS Indisponível",
        description: "Geolocalização não suportada neste dispositivo.",
      });
      return;
    }

    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setGpsCoords(coords);
        setIsCapturingGps(false);
        toast({
          title: "Coordenadas GPS Vinculadas! 📍",
          description: `Lat: ${coords.latitude.toFixed(5)}, Long: ${coords.longitude.toFixed(5)} (Precisão: ${coords.accuracy}m)`,
        });
      },
      (err) => {
        setIsCapturingGps(false);
        toast({
          variant: "destructive",
          title: "Permissão de GPS",
          description:
            "Não foi possível obter a localização. Habilite o GPS no navegador do Android/iPhone.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Compressão inteligente de imagem no Canvas para fotos de celular (alta resolução)
  const compressImage = (dataUrl: string, maxWidth = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Capturar foto da câmera ou arquivo
  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const rawData = reader.result as string;
      const optimized = await compressImage(rawData);
      setSelectedImage(optimized);
      setReport(null);
    };
    reader.readAsDataURL(file);

    // Tentar obter GPS automaticamente se ainda não tiver
    if (!gpsCoords && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  // Disparar análise visual pelo Gemini 3.8
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeFieldInspectionPhoto({
        imageBase64: selectedImage || undefined,
        notes,
        location: locationName,
        companyName: currentCompany.name,
        gpsCoordinates: gpsCoords || undefined,
        devicePlatform,
      });

      setReport(result);
      if (result.findings.length > 0) {
        setExpandedPlanId(result.findings[0].id);
      }

      // Salvar cópia local no storage offline (resiliência para canteiros sem sinal)
      offlineStorage.addItem("FIELD_INSPECTION", {
        report: result,
        companyName: currentCompany.name,
        location: locationName,
        gps: gpsCoords,
        device: devicePlatform,
      });

      toast({
        title: "Vistoria Processada via Gemini 3.8! 📸",
        description: `Índice de Segurança: ${result.safetyIndex}% | ${result.findings.length} itens analisados.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro na vistoria",
        description: err.message || "Não foi possível analisar a imagem.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Compartilhar no WhatsApp do Mestre de Obras
  const handleShareWhatsapp = () => {
    if (!report) return;

    let text = `🚨 *RELATÓRIO TÉCNICO DE INSPEÇÃO DE CAMPO - NAI*\n`;
    text += `🏢 *Empresa:* ${currentCompany.name}\n`;
    text += `📍 *Local:* ${report.locationDetected}\n`;
    if (gpsCoords) {
      text += `🗺️ *GPS:* ${gpsCoords.latitude.toFixed(5)}, ${gpsCoords.longitude.toFixed(5)} (±${gpsCoords.accuracy}m)\n`;
    }
    text += `📱 *Dispositivo de Campo:* ${devicePlatform}\n`;
    text += `📊 *Índice de Segurança:* ${report.safetyIndex}%\n`;
    text += `⚠️ *Status Geral:* ${report.overallSafetyStatus}\n\n`;
    text += `*NÃO-CONFORMIDADES IDENTIFICADAS:*\n`;

    report.findings.forEach((f, i) => {
      text += `\n${i + 1}. *[${f.severity}]* ${f.title}\n`;
      text += `   • *Norma:* ${f.applicableStandard}\n`;
      text += `   • *Ação (O que):* ${f.actionPlan.what}\n`;
      text += `   • *Prazo (Quando):* ${f.actionPlan.when}\n`;
      text += `   • *Responsável:* ${f.actionPlan.who}\n`;
    });

    text += `\n_Emitido automaticamente pelo Co-piloto Gemini 3.8 Neural (NextCon SST)_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-mono">
            <BrainCircuit className="size-3.5 mr-1" /> Visão Multimodal Gemini 3.8
          </Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs">
            NR-06 • NR-10 • NR-18 • NR-35
          </Badge>
          <Badge
            className={
              devicePlatform === "Android"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold"
                : devicePlatform === "iOS"
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs font-bold"
                  : "bg-slate-800 text-slate-300 border-slate-700 text-xs"
            }
          >
            <Smartphone className="size-3 mr-1" />
            {devicePlatform === "Android"
              ? "Dispositivo Android Conectado 🤖"
              : devicePlatform === "iOS"
                ? "Apple iPhone / iOS Conectado 🍎"
                : "Web / Desktop"}
          </Badge>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <HardHat className="size-8 text-amber-400" />
          Inspeção de Campo (Android & iPhone)
        </h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1">
          Aponte a câmera do seu smartphone (Android ou iPhone) para o canteiro. O Gemini 3.8 audita
          EPIs, andaimes, instalações e riscos com plano 5W2H imediato.
        </p>
      </div>

      {/* Seletor de Câmera e Captura */}
      <Card className="bg-slate-900 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <CardContent className="p-6 space-y-5">
          {/* Inputs invisíveis: Câmera Nativa (capture) e Galeria de Fotos */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleImageCapture}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={galleryInputRef}
            onChange={handleImageCapture}
            className="hidden"
          />

          {!selectedImage ? (
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 md:p-8 text-center bg-slate-950/40 space-y-5">
              <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <Camera className="size-8" />
              </div>

              <div className="space-y-1">
                <p className="font-bold text-white text-base">Capturar Foto do Canteiro de Obras</p>
                <p className="text-xs text-slate-400">
                  Compatível com todos os smartphones{" "}
                  <strong>Android (Samsung, Motorola, Xiaomi)</strong> e{" "}
                  <strong>Apple iPhone</strong>
                </p>
              </div>

              {/* Botões Duplos: Câmera Direta e Galeria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-11 rounded-xl shadow-lg gap-2"
                >
                  <Camera className="size-4" />
                  Abrir Câmera do Celular
                </Button>

                <Button
                  onClick={() => galleryInputRef.current?.click()}
                  variant="outline"
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs h-11 rounded-xl shadow gap-2"
                >
                  <ImageIcon className="size-4 text-sky-400" />
                  Galeria de Fotos
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-80 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Foto capturada do canteiro"
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    className="bg-slate-900/90 text-white border-slate-700 text-xs font-bold rounded-xl shadow-lg gap-1.5"
                  >
                    <Camera className="size-3.5" />
                    Nova Foto
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedImage(null);
                      setReport(null);
                    }}
                    className="text-xs font-bold rounded-xl shadow-lg"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Dados do Local, Observação e GPS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-bold">
                  Local / Frente de Serviço:
                </label>
                <button
                  type="button"
                  onClick={handleGetGps}
                  disabled={isCapturingGps}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition"
                >
                  <Compass className={`size-3 ${isCapturingGps ? "animate-spin" : ""}`} />
                  {isCapturingGps
                    ? "Obtendo GPS..."
                    : gpsCoords
                      ? "GPS Atualizado ✓"
                      : "📍 Obter GPS do Celular"}
                </button>
              </div>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Ex: Torre 2 - Andaime Fachada Norte"
                className="bg-slate-950 border-slate-800 text-white text-xs h-10"
              />
              {gpsCoords && (
                <p className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                  <Check className="size-3" />
                  GPS: {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)} (Precisão:{" "}
                  {gpsCoords.accuracy}m)
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-bold">
                Anotações do Técnico de Segurança (Opcional):
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Colaboradores da empreiteira de pintura sem trava-quedas..."
                className="bg-slate-950 border-slate-800 text-white text-xs h-10"
              />
            </div>
          </div>

          <Button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg gap-2"
          >
            <Sparkles className={`size-4 ${isAnalyzing ? "animate-spin" : ""}`} />
            {isAnalyzing
              ? "Gemini 3.8 Analisando Normas Regulamentadoras..."
              : "Auditar Imagem com IA Gemini 3.8"}
          </Button>
        </CardContent>
      </Card>

      {/* Relatório Fotográfico Gerado */}
      {report && (
        <div className="space-y-6">
          {/* Card Resumo do Laudo */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    report.overallSafetyStatus === "SEGURO"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : report.overallSafetyStatus === "ATENCAO"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                  }
                >
                  Status Geral: {report.overallSafetyStatus}
                </Badge>
                <span className="text-xs text-slate-400 font-mono">
                  Data: {report.inspectionDate}
                </span>
                {report.gpsLocation && (
                  <Badge
                    variant="outline"
                    className="border-slate-700 text-slate-300 text-[10px] font-mono"
                  >
                    📍 {report.gpsLocation}
                  </Badge>
                )}
                {report.deviceSource && (
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                    📱 {report.deviceSource}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-black text-white">{report.inspectionTitle}</h2>
              <p className="text-xs text-slate-300 italic max-w-2xl leading-relaxed">
                "{report.executiveSummary}"
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono pt-1">
                <Save className="size-3.5" />
                Cópia gravada no armazenamento offline do smartphone.
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 shrink-0">
              <div className="text-center md:text-right">
                <div className="text-[10px] text-slate-400 uppercase font-mono">
                  Índice de Segurança
                </div>
                <div
                  className={`text-3xl font-black ${
                    report.safetyIndex >= 85
                      ? "text-emerald-400"
                      : report.safetyIndex >= 70
                        ? "text-amber-400"
                        : "text-rose-400"
                  }`}
                >
                  {report.safetyIndex}%
                </div>
              </div>

              <Button
                onClick={handleShareWhatsapp}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 rounded-xl shadow-lg"
              >
                <Share2 className="size-4" />
                Compartilhar no WhatsApp
              </Button>
            </div>
          </div>

          {/* Lista de Não-Conformidades e Planos 5W2H */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-400" />
              Não-Conformidades & Planos de Ação 5W2H
            </h3>

            {report.findings.map((f) => {
              const isExpanded = expandedPlanId === f.id;
              return (
                <Card
                  key={f.id}
                  className="bg-slate-900/80 border-slate-800 rounded-2xl overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedPlanId(isExpanded ? null : f.id)}
                    className="p-5 cursor-pointer hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            f.severity === "RISCO_IMINENTE"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                              : f.severity === "GRAVE"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                          }
                        >
                          {f.severity.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-slate-400 font-mono">
                          {f.applicableStandard}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-base">{f.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1">{f.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400 hidden sm:inline">Plano 5W2H</span>
                      {isExpanded ? (
                        <ChevronUp className="size-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="size-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 pt-0 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
                      <p className="text-xs text-slate-300 pt-3">
                        <strong>Detalhamento Pericial:</strong> {f.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-amber-400 font-bold block mb-1">
                            🎯 O que fazer (What):
                          </span>
                          <span className="text-slate-200">{f.actionPlan.what}</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-amber-400 font-bold block mb-1">
                            ⚖️ Por que fazer (Why):
                          </span>
                          <span className="text-slate-200">{f.actionPlan.why}</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-amber-400 font-bold block mb-1">
                            👤 Quem fará (Who):
                          </span>
                          <span className="text-slate-200">{f.actionPlan.who}</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-amber-400 font-bold block mb-1">
                            📍 Onde (Where):
                          </span>
                          <span className="text-slate-200">{f.actionPlan.where}</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-amber-400 font-bold block mb-1">
                            ⏰ Quando (When):
                          </span>
                          <span className="text-rose-400 font-bold">{f.actionPlan.when}</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-amber-400 font-bold block mb-1">
                            🛠️ Como (How):
                          </span>
                          <span className="text-slate-200">{f.actionPlan.how}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
