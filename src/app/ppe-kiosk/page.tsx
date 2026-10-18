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
  Loader2,
  Building2,
  HardHat,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { STORAGE_PATHS } from "@/lib/storage-paths";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { cn } from "@/lib/utils";
import { useCompanyDirectory } from "@/hooks/use-company-directory";

/**
 * @fileOverview Quiosque Digital de EPI - NR-06 v2.8
 * Permite selecionar o Cliente (Empresa) e o Colaborador para que a entrega
 * e a evidência com biometria facial fiquem arquivadas na pasta correta.
 */

export default function PpeKiosk() {
  const { user } = useUser();
  const { activeClientId, authorizedCompanies, canBrowseAllCompanies } = useSgi();
  return (
    <PpeKioskSession
      key={JSON.stringify([user?.uid, activeClientId, authorizedCompanies, canBrowseAllCompanies])}
    />
  );
}

function PpeKioskSession() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { activeClientId, authorizedCompanies, canBrowseAllCompanies } = useSgi();
  const active = React.useRef(true);
  const capturePending = React.useRef(false);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>("");
  const [epiDescription, setEpiDescription] = React.useState("");
  const [caNumber, setCaNumber] = React.useState("");

  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [location, setLocation] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(1);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [timestamp, setTimestamp] = React.useState<string | null>(null);
  const [biometricToken, setBiometricToken] = React.useState("");

  // Query para carregar Empresas / Clientes do Firestore
  const {
    data: companies,
    isLoading: loadingCompanies,
    error: companiesError,
  } = useCompanyDirectory(db, user?.uid, canBrowseAllCompanies, authorizedCompanies);

  // Atualiza empresa selecionada com base no SGI Context inicial se aplicável
  React.useEffect(() => {
    if (
      activeClientId &&
      activeClientId !== "all" &&
      activeClientId !== "unauthorized" &&
      !selectedCompanyId &&
      companies.some((c) => c.id === activeClientId)
    ) {
      setSelectedCompanyId(activeClientId);
    }
  }, [activeClientId, companies, selectedCompanyId]);

  // Query reativa para buscar colaboradores da Empresa Selecionada
  const employeesQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedCompanyId || !companies.some((c) => c.id === selectedCompanyId))
      return null;
    return query(
      collection(db, "companies", selectedCompanyId, "employees"),
      orderBy("name", "asc")
    );
  }, [db, user, selectedCompanyId, companies]);
  const {
    data: employees,
    isLoading: loadingEmployees,
    error: employeesError,
  } = useCollection(employeesQuery);

  // Objetos selecionados
  const currentCompany = React.useMemo(() => {
    return companies?.find((c) => c.id === selectedCompanyId);
  }, [companies, selectedCompanyId]);

  const currentEmployee = React.useMemo(() => {
    return employees?.find((e) => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  React.useEffect(() => {
    let closed = false;
    let cameraStream: MediaStream | undefined;
    if (step === 2) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });
          if (closed) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          cameraStream = stream;
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          if (closed) return;
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
            if (closed) return;
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
    return () => {
      closed = true;
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [step, toast]);

  const handleCapture = async () => {
    if (capturePending.current) return;
    if (
      !selectedCompanyId ||
      !selectedEmployeeId ||
      !user ||
      !db ||
      !storage ||
      !currentCompany ||
      !currentEmployee ||
      !epiDescription.trim() ||
      !caNumber.trim()
    ) {
      toast({
        variant: "destructive",
        title: "Registro incompleto",
        description:
          "Selecione empresa e colaborador, informe o EPI e o CA e confirme sua conexão.",
      });
      return;
    }
    capturePending.current = true;
    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight || !hasCameraPermission)
        throw new Error("A câmera precisa estar ativa para registrar a evidência.");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível capturar a imagem.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = canvas.toDataURL("image/png");
      const deliveryId = crypto.randomUUID();
      const evidencePath = STORAGE_PATHS.CLIENT_PPE(
        selectedCompanyId,
        selectedEmployeeId,
        `${deliveryId}.png`
      );
      await uploadString(ref(storage, evidencePath), imgData, "data_url");
      if (!active.current) return;
      await addDoc(collection(db, "companies", selectedCompanyId, "ppe_deliveries"), {
        id: deliveryId,
        companyId: selectedCompanyId,
        companyName: currentCompany?.name || "",
        employeeId: selectedEmployeeId,
        employeeName: currentEmployee?.name || "",
        employeeCpf: currentEmployee?.cpf || "",
        epiNome: epiDescription,
        numeroCA: caNumber,
        evidenceId: deliveryId,
        evidencePath,
        evidenceType: "PHOTO",
        gpsLocation: location || "Não informado",
        deliveredAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        status: "ENTREGUE",
        caStatus: "PENDENTE_VERIFICACAO",
      });
      if (!active.current) return;
      setCapturedImage(imgData);
      setBiometricToken(deliveryId);
      setStep(3);
      toast({
        title: "Entrega de EPI registrada",
        description:
          "Registro e evidência fotográfica salvos. A validade do CA precisa ser verificada.",
      });
    } catch (error) {
      if (!active.current) return;
      toast({
        variant: "destructive",
        title: "A entrega não foi confirmada",
        description: error instanceof Error ? error.message : "Revise a conexão e tente novamente.",
      });
    } finally {
      capturePending.current = false;
      if (active.current) setIsCapturing(false);
    }
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
    doc.text(`GPS: ${location || "Não informado"}`, 20, 135);
    doc.text(`ID da evidência fotográfica: ${biometricToken}`, 20, 145);

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
      doc.text("EVIDÊNCIA FOTOGRÁFICA (REGISTRO DA ENTREGA)", 105, 235, {
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
          Registro de entrega com evidência fotográfica
        </p>
      </div>
      {(companiesError || employeesError) && (
        <p role="alert">Não foi possível consultar os dados. Atualize e tente novamente.</p>
      )}

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
                        {c.name}
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
              disabled={
                !user ||
                !currentCompany ||
                !currentEmployee ||
                !epiDescription.trim() ||
                !caNumber.trim() ||
                !!companiesError ||
                !!employeesError
              }
              onClick={() => setStep(2)}
            >
              Prosseguir para Registro Fotográfico
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
                Evidência fotográfica
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
                CONFIRMAR ENTREGA COM FOTO
              </Button>
              <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest">
                Ao clicar, você confirma o recebimento do EPI {epiDescription} e autoriza a
                evidência fotográfica da entrega.
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
                Entrega registrada e salva!
              </h2>
              <p className="text-muted-foreground text-sm font-medium italic">
                "O registro com a evidência fotográfica foi arquivado para{" "}
                <strong>{currentCompany?.name}</strong> para o colaborador{" "}
                <strong>{currentEmployee?.name}</strong>."
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-4">
              <Button
                variant="outline"
                className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 border-primary text-primary"
                onClick={generateReceiptPDF}
              >
                <FileDown className="size-4 text-accent" /> Baixar Recibo da Entrega (PDF)
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
          Registro da entrega
        </AlertTitle>
        <AlertDescription className="text-xs text-primary/70">
          A fotografia documenta a entrega. Ela não realiza autenticação biométrica. A validade do
          CA exige conferência própria; este fluxo não transmite eventos ao eSocial.
        </AlertDescription>
      </Alert>
    </div>
  );
}
