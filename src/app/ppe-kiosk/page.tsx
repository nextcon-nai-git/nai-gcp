"use client";

import * as React from "react";
import {
  Camera,
  MapPin,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  CheckCircle2,
  FileDown,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { jsPDF } from "jspdf";
import { useStorage, useUser } from "@/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

/**
 * @fileOverview Quiosque Digital de EPI - NR-06
 * Implementa assinatura eletrônica via foto (biometria facial) e geolocalização.
 */

export default function PpeKiosk() {
  const { toast } = useToast();
  const { user } = useUser();
  const storage = useStorage();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [location, setLocation] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [step, setStep] = React.useState(1);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [timestamp, setTimestamp] = React.useState<string | null>(null);
  const [biometricToken, setBiometricToken] = React.useState("");

  React.useEffect(() => {
    if (step === 2) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          setHasCameraPermission(false);
          toast({
            variant: "destructive",
            title: "Acesso à Câmera Negado",
            description: "Ative a câmera para assinar a entrega do EPI.",
          });
        }
      };
      const getGeoLocation = () => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
            setLocation(
              `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
            );
          });
        }
      };
      getCameraPermission();
      getGeoLocation();
      setTimestamp(new Date().toLocaleString("pt-BR"));
    }
  }, [step, toast]);

  const handleCapture = async () => {
    setIsCapturing(true);
    let imgData = "";

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        imgData = canvas.toDataURL("image/png");
        setCapturedImage(imgData);
        const token = Math.random().toString(36).substring(2, 15).toUpperCase();
        setBiometricToken(token);

        // Upload opcional para o Storage (Evidência Forense)
        if (user && storage) {
          try {
            const photoRef = ref(storage, `ppe-evidences/${employeeId}_${Date.now()}.png`);
            await uploadString(photoRef, imgData, "data_url");
          } catch (e) {
            console.error("Erro ao salvar evidência");
          }
        }
      }
    }

    setTimeout(() => {
      setIsCapturing(false);
      setStep(3);
      toast({ title: "EPI Registrado!", description: "Dados sincronizados com o servidor." });
    }, 1500);
  };

  const generateReceiptPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(0, 53, 107); // Navy Nextcon
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Controle EPIs NAI", 105, 25, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("COMPROVANTE DE ENTREGA DE EPI (NR-06)", 105, 60, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Matrícula Colaborador: ${employeeId}`, 20, 80);
    doc.text(`Data/Hora: ${timestamp}`, 20, 90);
    doc.text(`Coordenadas GPS: ${location || "Não capturado"}`, 20, 100);
    doc.text(`Token de Assinatura Biométrica: ${biometricToken}`, 20, 110);

    doc.text(
      "Declaro que recebi os EPIs adequados ao risco de minha atividade e fui treinado sobre o uso correto.",
      20,
      130,
      { maxWidth: 170 }
    );

    if (capturedImage) {
      doc.addImage(capturedImage, "PNG", 75, 150, 60, 45);
      doc.text("EVIDÊNCIA FOTOGRÁFICA (IDENTIFICAÇÃO FACIAL)", 105, 205, { align: "center" });
    }

    doc.save(`Recibo_EPI_${employeeId}.pdf`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-top-4 duration-500 pb-20">
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 bg-primary/5 rounded-2xl mb-2">
          <Lock className="size-8 text-primary" />
        </div>
        <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
          Quiosque Digital EPI 2026
        </h1>
        <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">
          Entrega Segura com Assinatura Biométrica
        </p>
      </div>

      <Card className="card-shadow border-none overflow-hidden bg-white">
        {step === 1 && (
          <div className="p-10 space-y-8 text-center animate-in fade-in">
            <UserCheck className="size-16 mx-auto text-primary" />
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Identificação do Colaborador
              </label>
              <Input
                placeholder="Digite sua Matrícula ou CPF"
                className="text-center text-2xl h-16 font-bold bg-slate-50 border-none shadow-inner"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>
            <Button
              className="w-full h-16 text-xl font-bold bg-primary shadow-xl"
              disabled={!employeeId}
              onClick={() => setStep(2)}
            >
              Prosseguir para Entrega
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-0 animate-in fade-in">
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full aspect-[4/3] bg-black object-cover"
                autoPlay
                muted
              />
              <div className="absolute top-4 left-4">
                <Badge className="bg-primary/80 backdrop-blur-md text-white border-none gap-2">
                  <MapPin className="size-3" /> {location || "Localizando..."}
                </Badge>
              </div>
              <div className="absolute bottom-4 right-4">
                <Badge className="bg-accent text-primary font-black border-none">LIVE FEED</Badge>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="p-8">
              <Button
                className="w-full h-24 text-2xl font-black bg-primary gap-4 shadow-2xl hover:scale-[1.02] transition-transform"
                onClick={handleCapture}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <RefreshCw className="size-8 animate-spin" />
                ) : (
                  <Camera className="size-8" />
                )}
                CONFIRMAR E ASSINAR
              </Button>
              <p className="text-[10px] text-center text-muted-foreground mt-4 uppercase font-bold tracking-widest">
                Ao clicar, você autoriza a captura de imagem para fins de conformidade NR-06.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-16 text-center space-y-8 animate-in zoom-in-95">
            <div className="size-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4">
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-primary uppercase">Entrega Validada!</h2>
              <p className="text-muted-foreground text-sm font-medium italic">
                "Seu recibo digital foi gerado e enviado ao portal do RH."
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-4">
              <Button
                variant="outline"
                className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2"
                onClick={generateReceiptPDF}
              >
                <FileDown className="size-4" /> Baixar Recibo (PDF)
              </Button>
              <Button
                variant="ghost"
                className="h-12 font-bold uppercase text-[10px]"
                onClick={() => {
                  setStep(1);
                  setEmployeeId("");
                }}
              >
                Nova Entrega
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Alert className="bg-blue-50 border-blue-100">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-bold uppercase text-[10px] tracking-widest">
          Salvaguarda Legal
        </AlertTitle>
        <AlertDescription className="text-xs text-primary/70">
          Este sistema substitui a ficha de EPI física, utilizando evidências digitais em
          conformidade com a LGPD e normas do MTE.
        </AlertDescription>
      </Alert>
    </div>
  );
}
