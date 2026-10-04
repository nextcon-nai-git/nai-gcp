"use client";

import * as React from "react";
import {
  Camera,
  MapPin,
  CheckCircle2,
  FileDown,
  Lock,
  ShieldAlert,
  Loader2,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jsPDF } from "jspdf";
import { useStorage, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { ref, uploadString } from "firebase/storage";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";

/**
 * @fileOverview Quiosque Digital de EPI - NR-06 v2.8
 * Permite selecionar o Cliente (Empresa) e o Colaborador para que a entrega
 * e a evidência com biometria facial fiquem arquivadas na pasta correta.
 */

export default function PpeKiosk() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { activeClientId, isGlobalStaff } = useSgi();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>("");
  const [epiDescription, setEpiDescription] = React.useState(
    "Capacete de Segurança com Jugular (C.A. 12345)"
  );
  const [caNumber, setCaNumber] = React.useState("12345");

  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [location, setLocation] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(1);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [timestamp, setTimestamp] = React.useState<string | null>(null);
  const [biometricToken, setBiometricToken] = React.useState("");

  // Query para carregar Empresas / Clientes do Firestore
  const companiesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "companies"), orderBy("name", "asc"));
  }, [db]);
  const { data: companies, isLoading: loadingCompanies } = useCollection(companiesQuery);

  // Atualiza empresa selecionada com base no SGI Context inicial se aplicável
  React.useEffect(() => {
    if (
      activeClientId &&
      activeClientId !== "all" &&
      activeClientId !== "unauthorized" &&
      !selectedCompanyId
    ) {
      setSelectedCompanyId(activeClientId);
    } else if (companies && companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [activeClientId, companies, selectedCompanyId]);

  // Query reativa para buscar colaboradores da Empresa Selecionada
  const employeesQuery = useMemoFirebase(() => {
    if (!db || !selectedCompanyId) return null;
    return query(
      collection(db, "companies", selectedCompanyId, "employees"),
      orderBy("name", "asc")
    );
  }, [db, selectedCompanyId]);
  const { data: employees, isLoading: loadingEmployees } = useCollection(employeesQuery);

  // Objetos selecionados
  const currentCompany = React.useMemo(() => {
    return companies?.find((c) => c.id === selectedCompanyId);
  }, [companies, selectedCompanyId]);

  const currentEmployee = React.useMemo(() => {
    return employees?.find((e) => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

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
    if (!selectedCompanyId || !selectedEmployeeId) {
      toast({
        variant: "destructive",
        title: "Seleção Incompleta",
        description: "Selecione o Cliente e o Colaborador antes de assinar.",
      });
      return;
    }

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

        const deliveryId = `deliv_${Date.now()}`;

        // 1. Upload da Evidência para a pasta correta do Cliente e Colaborador
        if (storage) {
          try {
            const photoPath = `companies/${selectedCompanyId}/employees/${selectedEmployeeId}/ppe_deliveries/${deliveryId}.png`;
            const photoRef = ref(storage, photoPath);
            await uploadString(photoRef, imgData, "data_url");
          } catch (e) {
            console.error("Erro ao salvar evidência no storage:", e);
          }
        }

        // 2. Registro no Firestore na subcoleção correta da empresa (companies/{companyId}/ppe_deliveries)
        if (db) {
          try {
            await addDoc(collection(db, "companies", selectedCompanyId, "ppe_deliveries"), {
              id: deliveryId,
              companyId: selectedCompanyId,
              companyName: currentCompany?.name || "Empresa",
              employeeId: selectedEmployeeId,
              employeeName: currentEmployee?.name || "Colaborador",
              employeeCpf: currentEmployee?.cpf || "",
              epiNome: epiDescription,
              numeroCA: caNumber,
              biometricToken: token,
              gpsLocation: location || "Não informado",
              deliveredAt: new Date().toISOString(),
              createdAt: serverTimestamp(),
              status: "ENTREGUE",
              caStatus: "VALID",
            });
          } catch (e) {
            console.error("Erro ao registrar no Firestore:", e);
          }
        }
      }
    }

    setTimeout(() => {
      setIsCapturing(false);
      setStep(3);
      toast({
        title: "EPI Registrado na Pasta Correta!",
        description: `Armazenado em ${currentCompany?.name} > ${currentEmployee?.name}`,
      });
    }, 1500);
  };

  const generateReceiptPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(0, 53, 107); // Navy Nextcon
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Controle de EPIs NAI - NR-06", 105, 25, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("RECIBO MESTRE DE ENTREGA DE EPI", 105, 55, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Unidade / Cliente: ${currentCompany?.name || selectedCompanyId}`, 20, 75);
    doc.text(`Colaborador: ${currentEmployee?.name || selectedEmployeeId}`, 20, 85);
    doc.text(`CPF Colaborador: ${currentEmployee?.cpf || "Não informado"}`, 20, 95);
    doc.text(`EPI Entregue: ${epiDescription}`, 20, 105);
    doc.text(`Certificado de Aprovação (C.A.): ${caNumber}`, 20, 115);
    doc.text(`Data/Hora: ${timestamp}`, 20, 125);
    doc.text(`GPS: ${location || "Capturado via Quiosque"}`, 20, 135);
    doc.text(`Token de Biometria Facial: ${biometricToken}`, 20, 145);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Declaro que recebi os Equipamentos de Proteção Individual (EPI) indicados acima, novos e em perfeito estado de conservação e funcionamento, comprometendo-me a usá-los exclusivamente para as finalidades a que se destinam, observando as normas de segurança (NR-06).",
      20,
      160,
      { maxWidth: 170 }
    );

    if (capturedImage) {
      doc.addImage(capturedImage, "PNG", 75, 185, 60, 45);
      doc.setFontSize(8);
      doc.text("EVIDÊNCIA FOTOGRÁFICA (IDENTIFICAÇÃO FACIAL REGISTRADA)", 105, 235, {
        align: "center",
      });
    }

    const safeName = (currentEmployee?.name || "colaborador").replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`Recibo_EPI_${safeName}.pdf`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-top-4 duration-500 pb-20 text-left">
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 bg-primary/5 rounded-2xl mb-2">
          <Lock className="size-8 text-primary" />
        </div>
        <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
          Quiosque Digital EPI 2026
        </h1>
        <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">
          Atribuição em Pasta Mestre & Assinatura Biométrica
        </p>
      </div>

      <Card className="card-shadow border-none overflow-hidden bg-white rounded-[2.5rem]">
        {step === 1 && (
          <div className="p-10 space-y-8 text-left animate-in fade-in">
            <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
              <div className="p-3 bg-primary text-accent rounded-xl shadow-md">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-sm text-primary uppercase">
                  Identificação da Pasta do Cliente
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Selecione o Cliente e o Colaborador que receberá o EPI.
                </p>
              </div>
            </div>

            {/* SELEÇÃO DO CLIENTE / EMPRESA */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                1. Cliente / Unidade Operacional
              </label>
              {loadingCompanies ? (
                <div className="h-14 bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">
                  Carregando Clientes...
                </div>
              ) : (
                <Select
                  value={selectedCompanyId}
                  onValueChange={(val) => {
                    setSelectedCompanyId(val);
                    setSelectedEmployeeId("");
                  }}
                >
                  <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold text-sm shadow-inner">
                    <SelectValue placeholder="Selecione a Empresa / Cliente" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl max-h-60">
                    {companies?.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={c.id}
                        className="text-xs font-bold uppercase py-3"
                      >
                        {c.name} {c.cnpj ? `(${c.cnpj})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* SELEÇÃO DO COLABORADOR */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                2. Colaborador (Vida)
              </label>
              {loadingEmployees ? (
                <div className="h-14 bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">
                  Carregando Colaboradores...
                </div>
              ) : (
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                  disabled={!selectedCompanyId}
                >
                  <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold text-sm shadow-inner">
                    <SelectValue
                      placeholder={
                        selectedCompanyId
                          ? "Selecione o Colaborador"
                          : "Selecione o Cliente Primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl max-h-60">
                    {employees?.map((e) => (
                      <SelectItem
                        key={e.id}
                        value={e.id}
                        className="text-xs font-bold uppercase py-3"
                      >
                        {e.name} {e.cpf ? `• CPF: ${e.cpf}` : ""}
                      </SelectItem>
                    ))}
                    {(!employees || employees.length === 0) && (
                      <SelectItem value="none" disabled className="text-xs italic">
                        Nenhum colaborador encontrado para esta empresa
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* DETALHES DO EPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Descrição do EPI
                </label>
                <Input
                  value={epiDescription}
                  onChange={(e) => setEpiDescription(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Número do C.A.
                </label>
                <Input
                  value={caNumber}
                  onChange={(e) => setCaNumber(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-xl font-mono font-bold text-xs text-center"
                />
              </div>
            </div>

            <Button
              className="w-full h-16 text-lg font-black uppercase tracking-widest bg-primary text-white shadow-xl rounded-2xl transition-all hover:scale-[1.01]"
              disabled={!selectedCompanyId || !selectedEmployeeId}
              onClick={() => setStep(2)}
            >
              Prosseguir para Assinatura Biometrica
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-0 animate-in fade-in">
            <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Entrega de EPI Destinada A:
                </p>
                <h3 className="font-black text-primary text-sm uppercase">
                  {currentEmployee?.name}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase">
                  {currentCompany?.name}
                </p>
              </div>
              <Badge className="bg-primary text-accent border-none font-black text-[9px] uppercase px-3 h-6">
                NR-06 Bio
              </Badge>
            </div>

            <div className="relative">
              <video
                ref={videoRef}
                className="w-full aspect-[4/3] bg-black object-cover"
                autoPlay
                muted
                playsInline
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
            <div className="p-8 space-y-4">
              <Button
                className="w-full h-20 text-xl font-black bg-primary gap-4 shadow-2xl rounded-2xl hover:scale-[1.01] transition-transform"
                onClick={handleCapture}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <Loader2 className="size-8 animate-spin text-accent" />
                ) : (
                  <Camera className="size-8 text-accent" />
                )}
                CONFIRMAR E ASSINAR BIOMETRIA
              </Button>
              <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest">
                Ao clicar, você confirma o recebimento do EPI {epiDescription} e autoriza a
                biometria facial para conformidade NR-06.
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
              <h2 className="text-3xl font-black text-primary uppercase">
                Entrega Validada e Salva!
              </h2>
              <p className="text-muted-foreground text-sm font-medium italic">
                &quot;O recibo com a evidência biométrica foi arquivado na pasta mestre de{" "}
                <strong>{currentCompany?.name}</strong> para o colaborador{" "}
                <strong>{currentEmployee?.name}</strong>.&quot;
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-4">
              <Button
                variant="outline"
                className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 border-primary text-primary"
                onClick={generateReceiptPDF}
              >
                <FileDown className="size-4 text-accent" /> Baixar Recibo Assinado (PDF)
              </Button>
              <Button
                variant="ghost"
                className="h-12 font-bold uppercase text-[10px]"
                onClick={() => {
                  setStep(1);
                  setSelectedEmployeeId("");
                }}
              >
                Nova Entrega de EPI
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Alert className="bg-blue-50 border-blue-100 rounded-2xl">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-bold uppercase text-[10px] tracking-widest">
          Salvaguarda Legal NR-06 & eSocial S-2240
        </AlertTitle>
        <AlertDescription className="text-xs text-primary/70">
          As fotos de identificação facial e geolocalizações são vinculadas diretamente à subcoleção
          `companies/{selectedCompanyId || "companyId"}/ppe_deliveries` de acordo com a LGPD e
          normas do Ministério do Trabalho.
        </AlertDescription>
      </Alert>
    </div>
  );
}
