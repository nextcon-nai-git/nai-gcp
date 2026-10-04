"use client";

import * as React from "react";
import {
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  FileUp,
  Plus,
  Fingerprint,
  Search,
  Loader2,
  Zap,
  Building2,
  CheckCircle2,
  Brain,
  Sparkles,
  FileText,
  Save,
  Check,
  Award,
  RefreshCw,
  Clock,
  Layers,
  XCircle,
  HelpCircle,
  Hash,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  collectionGroup,
  writeBatch,
  doc,
  addDoc,
} from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { useToast } from "@/hooks/use-toast";
import { extractPpeSheetData, ExtractPpeSheetOutput } from "@/ai/flows/ppe-sheet-ocr-flow";
import { PpeCatalogItem, PpeDeliveryReceipt, CaStatus } from "@/types/schema";
import { PpeCatalogService, INITIAL_PPE_CATALOG } from "@/services/ppe/ppe-catalog-service";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function PpeManagement() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { activeClientId } = useSgi();

  const [activeTab, setActiveTab] = React.useState<"deliveries" | "catalog">("deliveries");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [catalogRoleFilter, setCatalogRoleFilter] = React.useState("");

  // Modais
  const [isScanOpen, setIsScanOpen] = React.useState(false);
  const [isNewDeliveryOpen, setIsNewDeliveryOpen] = React.useState(false);
  const [isNewPpeOpen, setIsNewPpeOpen] = React.useState(false);

  // OCR
  const [rawPpeInput, setRawPpeInput] = React.useState("");
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [extractedData, setExtractedData] = React.useState<ExtractPpeSheetOutput | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Catálogo em memória (iniciado com o catálogo oficial NR-06)
  const [catalog, setCatalog] = React.useState<PpeCatalogItem[]>(INITIAL_PPE_CATALOG);

  // Novo formulário de entrega
  const [deliveryForm, setDeliveryForm] = React.useState({
    employeeName: "",
    cpfMatricula: "",
    roleName: "Operador de Máquinas",
    selectedPpeId: INITIAL_PPE_CATALOG[0].id,
    quantity: 1,
    reason: "NOVA_ADMISSAO" as const,
    deliveryDate: new Date().toISOString().split("T")[0],
    termAccepted: false,
  });

  // Novo EPI pro catálogo
  const [newPpeForm, setNewPpeForm] = React.useState({
    name: "",
    category: "CABECA" as const,
    caNumber: "",
    caExpirationDate: "",
    manufacturer: "",
    compatibleRoles: "Geral",
    durabilityDays: 180,
  });

  // Consulta reativa Firestore isolada por tenant
  const deliveriesQuery = useMemoFirebase(() => {
    if (!db || activeClientId === "unauthorized" || !activeClientId) return null;
    if (activeClientId === "all") {
      return query(collectionGroup(db, "ppe_deliveries"), orderBy("deliveredAt", "desc"));
    }
    return query(
      collection(db, "companies", activeClientId, "ppe_deliveries"),
      orderBy("deliveredAt", "desc")
    );
  }, [db, activeClientId]);

  const { data: rawDeliveries, isLoading } = useCollection(deliveriesQuery);

  const deliveries = React.useMemo(() => {
    if (!rawDeliveries) return [];
    return rawDeliveries.filter((d: any) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        d.employeeName?.toLowerCase().includes(term) ||
        d.epiNome?.toLowerCase().includes(term) ||
        d.ppeName?.toLowerCase().includes(term) ||
        d.numeroCA?.toString().includes(term) ||
        d.caNumber?.toString().includes(term)
      );
    });
  }, [rawDeliveries, searchTerm]);

  const selectedPpe = React.useMemo(() => {
    return catalog.find((p) => p.id === deliveryForm.selectedPpeId) || catalog[0];
  }, [catalog, deliveryForm.selectedPpeId]);

  const selectedPpeStatus = React.useMemo(() => {
    if (!selectedPpe) return "VALIDO";
    return PpeCatalogService.checkCaStatus(selectedPpe.caExpirationDate);
  }, [selectedPpe]);

  const filteredCatalog = React.useMemo(() => {
    if (!catalogRoleFilter.trim()) return catalog;
    return PpeCatalogService.getRecommendedPpeByRole(catalogRoleFilter, catalog);
  }, [catalog, catalogRoleFilter]);

  const catalogStats = React.useMemo(() => {
    return PpeCatalogService.calculatePpeAlerts(catalog);
  }, [catalog]);

  const stats = React.useMemo(() => {
    if (!rawDeliveries) return { total: 0, caValid: 0, caWarning: 0 };
    return {
      total: rawDeliveries.length,
      caValid: rawDeliveries.filter(
        (d: any) => d.caStatus === "VALID" || d.caStatus === "VALIDO" || !d.caStatus
      ).length,
      caWarning: rawDeliveries.filter(
        (d: any) =>
          d.caStatus === "WARNING" || d.caStatus === "VENCENDO_30D" || d.caStatus === "VENCIDO"
      ).length,
    };
  }, [rawDeliveries]);

  // Submissão de entrega digital NR-06
  const handleCreateDigitalDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeClientId || activeClientId === "all" || activeClientId === "unauthorized") {
      toast({
        variant: "destructive",
        title: "Empresa não selecionada",
        description:
          "Selecione uma empresa específica no seletor do topo para registrar a entrega.",
      });
      return;
    }

    const payloadCheck = {
      employeeName: deliveryForm.employeeName,
      cpfMatricula: deliveryForm.cpfMatricula,
      caNumber: selectedPpe.caNumber,
      caExpirationDate: selectedPpe.caExpirationDate,
      termAccepted: deliveryForm.termAccepted,
    };

    const validation = PpeCatalogService.validateDeliveryCompliance(payloadCheck);
    if (!validation.valid) {
      toast({
        variant: "destructive",
        title: "Bloqueio de Conformidade NR-06",
        description: validation.issues[0],
      });
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const signatureHash = PpeCatalogService.generateDigitalSignatureHash({
        companyId: activeClientId,
        employeeCpf: deliveryForm.cpfMatricula,
        ppeName: selectedPpe.name,
        caNumber: selectedPpe.caNumber,
        deliveryDate: deliveryForm.deliveryDate,
        quantity: deliveryForm.quantity,
        timestamp: now,
      });

      const newRecord = {
        companyId: activeClientId,
        employeeName: deliveryForm.employeeName,
        cpfMatricula: deliveryForm.cpfMatricula,
        setorFuncao: deliveryForm.roleName,
        epiNome: selectedPpe.name,
        numeroCA: selectedPpe.caNumber,
        caExpirationDate: selectedPpe.caExpirationDate,
        caStatus: selectedPpeStatus,
        fabricanteMarca: selectedPpe.manufacturer,
        deliveredAt: deliveryForm.deliveryDate,
        quantity: Number(deliveryForm.quantity),
        signed: true,
        signatureType: "DIGITAL",
        signatureHash,
        termAccepted: true,
        reason: deliveryForm.reason,
        createdVia: "NR06_DIGITAL_ENGINE",
        createdAt: now,
      };

      await addDoc(collection(db, "companies", activeClientId, "ppe_deliveries"), newRecord);

      toast({
        title: "Ficha de EPI Assinada Digitalmente!",
        description: `Termo registrado com Hash SHA-256: ${signatureHash.substring(0, 16)}...`,
      });

      setIsNewDeliveryOpen(false);
      setDeliveryForm({
        ...deliveryForm,
        employeeName: "",
        cpfMatricula: "",
        termAccepted: false,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao gravar entrega", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Cadastro de novo EPI no catálogo
  const handleAddNewPpe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPpeForm.name || !newPpeForm.caNumber || !newPpeForm.caExpirationDate) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios." });
      return;
    }

    const status = PpeCatalogService.checkCaStatus(newPpeForm.caExpirationDate);
    const newItem: PpeCatalogItem = {
      id: `ppe_custom_${Date.now()}`,
      name: newPpeForm.name,
      category: newPpeForm.category,
      caNumber: newPpeForm.caNumber,
      caExpirationDate: newPpeForm.caExpirationDate,
      caStatus: status,
      manufacturer: newPpeForm.manufacturer || "Fabricante Certificado",
      compatibleRoles: newPpeForm.compatibleRoles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      durabilityDays: Number(newPpeForm.durabilityDays) || 180,
      active: true,
    };

    setCatalog((prev) => [newItem, ...prev]);
    toast({
      title: "EPI Cadastrado no Catálogo",
      description: `C.A. nº ${newItem.caNumber} associado com status ${status}.`,
    });
    setIsNewPpeOpen(false);
    setNewPpeForm({
      name: "",
      category: "CABECA",
      caNumber: "",
      caExpirationDate: "",
      manufacturer: "",
      compatibleRoles: "Geral",
      durabilityDays: 180,
    });
  };

  // Scanner OCR de Ficha
  const handleAnalyzePpeSheet = async () => {
    if (!rawPpeInput.trim()) {
      toast({
        variant: "destructive",
        title: "Entrada vazia",
        description: "Insira ou cole o texto da Ficha de EPI.",
      });
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await extractPpeSheetData(rawPpeInput);
      setExtractedData(result);
      toast({
        title: "Ficha Leitora Concluída",
        description: `A NAI identificou ${result.itens.length} EPIs para ${result.nomeColaborador}.`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro na Análise de IA",
        description: e.message || "Não foi possível ler os dados da ficha.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveDeliveries = async () => {
    if (
      !db ||
      !extractedData ||
      !activeClientId ||
      activeClientId === "all" ||
      activeClientId === "unauthorized"
    ) {
      toast({
        variant: "destructive",
        title: "Selecione uma empresa específica no topo para registrar as entregas.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      extractedData.itens.forEach((item) => {
        const docRef = doc(collection(db, "companies", activeClientId, "ppe_deliveries"));
        batch.set(docRef, {
          companyId: activeClientId,
          employeeName: extractedData.nomeColaborador,
          cpfMatricula: extractedData.cpfMatricula || "",
          setorFuncao: extractedData.setorFuncao || "GERAL",
          epiNome: item.epiNome,
          numeroCA: item.numeroCA,
          fabricanteMarca: item.fabricanteMarca || "PADRÃO",
          deliveredAt: item.dataEntrega || now.split("T")[0],
          quantity: item.quantidade || 1,
          signed: item.assinado,
          caStatus: "VALIDO",
          createdAt: now,
          createdVia: "NAI_VISION_AI",
        });
      });

      await batch.commit();
      toast({
        title: "Ficha Sincronizada",
        description: `${extractedData.itens.length} EPIs gravados com sucesso no banco e eSocial S-2240.`,
      });
      setIsScanOpen(false);
      setExtractedData(null);
      setRawPpeInput("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao Salvar", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const renderCaBadge = (status?: string) => {
    switch (status) {
      case "VALIDO":
      case "VALID":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[8px] font-black uppercase">
            C.A. Válido (MTE)
          </Badge>
        );
      case "VENCENDO_30D":
      case "WARNING":
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[8px] font-black uppercase">
            Vence em &lt;30d
          </Badge>
        );
      case "VENCIDO":
        return (
          <Badge className="bg-red-100 text-red-900 border-red-300 text-[8px] font-black uppercase">
            C.A. Vencido
          </Badge>
        );
      case "CANCELADO":
        return (
          <Badge className="bg-rose-900 text-white border-none text-[8px] font-black uppercase">
            C.A. Cancelado MTE
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 text-[8px] font-black uppercase">
            C.A. Regular
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.3em] mb-1 px-3 h-5 uppercase">
            NR-06 & S-2240 COMPLIANCE ENGINE
          </Badge>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Controle Digital de EPI/EPC
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2 mt-1">
            <ShieldCheck className="size-3 text-emerald-500" /> Catálogo Estruturado de C.A.s,
            Assinatura Digital e Rastreio MTE
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Modal Nova Entrega com Assinatura Digital */}
          <Dialog open={isNewDeliveryOpen} onOpenChange={setIsNewDeliveryOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
                <Plus className="size-4" /> Nova Entrega Digital
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
              <DialogHeader className="p-6 bg-emerald-700 text-white relative">
                <DialogTitle className="text-xl font-black uppercase font-headline flex items-center gap-2">
                  <ShieldCheck className="size-5 text-accent" /> Ficha de Entrega de EPI (NR-06)
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs">
                  Registro de entrega com validação em tempo real de C.A. e termo digital de guarda
                  e conservação.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateDigitalDelivery} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Nome do Colaborador *
                    </label>
                    <Input
                      required
                      placeholder="Ex: Carlos Eduardo Silva"
                      value={deliveryForm.employeeName}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, employeeName: e.target.value })
                      }
                      className="rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      CPF ou Matrícula *
                    </label>
                    <Input
                      required
                      placeholder="000.000.000-00"
                      value={deliveryForm.cpfMatricula}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, cpfMatricula: e.target.value })
                      }
                      className="rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Função / Cargo
                    </label>
                    <Input
                      placeholder="Ex: Soldador, Eletricista"
                      value={deliveryForm.roleName}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, roleName: e.target.value })
                      }
                      className="rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Data da Entrega
                    </label>
                    <Input
                      type="date"
                      value={deliveryForm.deliveryDate}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, deliveryDate: e.target.value })
                      }
                      className="rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Seleção do EPI a partir do Catálogo Estruturado */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Selecione o EPI Certificado (NR-06) *
                  </label>
                  <select
                    className="w-full h-11 px-3 border rounded-xl text-xs font-bold bg-white text-slate-800"
                    value={deliveryForm.selectedPpeId}
                    onChange={(e) =>
                      setDeliveryForm({ ...deliveryForm, selectedPpeId: e.target.value })
                    }
                  >
                    {catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — C.A. {item.caNumber} ({item.manufacturer})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card de Detalhes do C.A. selecionado */}
                {selectedPpe && (
                  <div className="p-4 rounded-xl bg-slate-50 border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-500">
                        Validação Oficial do MTE:
                      </span>
                      {renderCaBadge(selectedPpeStatus)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">
                          Nº C.A.:
                        </span>
                        <strong className="text-primary font-mono">{selectedPpe.caNumber}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">
                          Fabricante:
                        </span>
                        <strong className="text-slate-700">{selectedPpe.manufacturer}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">
                          Validade MTE:
                        </span>
                        <strong className="text-slate-700 font-mono">
                          {selectedPpe.caExpirationDate}
                        </strong>
                      </div>
                    </div>
                    {selectedPpeStatus === "VENCIDO" && (
                      <p className="text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded-lg">
                        ⚠️ ATENÇÃO: Fornecimento impedido. O C.A. deste EPI está vencido perante o
                        Ministério do Trabalho.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Quantidade
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={deliveryForm.quantity}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, quantity: Number(e.target.value) })
                      }
                      className="rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Motivo do Fornecimento
                    </label>
                    <select
                      className="w-full h-10 px-3 border rounded-xl text-xs font-bold bg-white"
                      value={deliveryForm.reason}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, reason: e.target.value as any })
                      }
                    >
                      <option value="NOVA_ADMISSAO">Nova Admissão</option>
                      <option value="SUBSTITUICAO_DESGASTE">Substituição por Desgaste</option>
                      <option value="EXTRAVIO">Extravio / Perda</option>
                      <option value="PERIODICA">Troca Periódica Programada</option>
                      <option value="MUDANCA_FUNCAO">Mudança de Função / Riscos</option>
                    </select>
                  </div>
                </div>

                {/* Termo de Compromisso e Guarda NR-06 item 6.6.1 */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryForm.termAccepted}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, termAccepted: e.target.checked })
                      }
                      className="mt-1 size-4 text-emerald-600 rounded"
                    />
                    <span className="text-[10px] text-amber-950 font-medium leading-tight">
                      <strong>Termo de Responsabilidade (NR-06 Item 6.6.1):</strong> Declaro ter
                      recebido os EPIs relacionados acima em perfeito estado de conservação,
                      comprometendo-me a utilizá-los exclusivamente para o desempenho de minhas
                      funções, responsabilizando-me por sua guarda e comunicando qualquer alteração
                      que o torne impróprio para uso.
                    </span>
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewDeliveryOpen(false)}
                    className="flex-1 rounded-xl text-xs font-bold uppercase"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSaving ||
                      !deliveryForm.termAccepted ||
                      selectedPpeStatus === "VENCIDO" ||
                      selectedPpeStatus === "CANCELADO"
                    }
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Assinar e Registrar Entrega
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            asChild
            variant="outline"
            className="h-11 px-5 border-primary text-primary font-black uppercase text-[10px] gap-2 rounded-xl"
          >
            <Link href="/ppe-kiosk">
              <Fingerprint className="size-4 text-accent" /> Quiosque Biométrico
            </Link>
          </Button>

          {/* Scanner de Ficha Impressa via OCR */}
          <Dialog open={isScanOpen} onOpenChange={setIsScanOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
                <Sparkles className="size-4 text-accent" /> Scanner Neural OCR
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
              <DialogHeader className="p-8 bg-primary text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Brain className="size-32 text-accent" />
                </div>
                <div className="relative z-10 space-y-1">
                  <DialogTitle className="text-2xl font-black uppercase font-headline">
                    Scanner de Ficha de EPI via Gemini 3.8
                  </DialogTitle>
                  <DialogDescription className="text-white/60 font-medium text-xs">
                    Cole o texto ou insira os dados da ficha impressa para extração de C.A. e
                    vinculação NR-06.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="p-8 space-y-6">
                {!extractedData ? (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Texto da Ficha de EPI / Transcrição de C.A.:
                    </label>
                    <Textarea
                      placeholder="Ex: FICHA DE EPI - COLABORADOR: CARLOS EDUARDO SILVA (CPF 000.000.000-00)
10/01/2026 - CAPACETE DE SEGURANÇA COM JUGULAR - CA 45678 - QTD 1
10/01/2026 - PROTETOR AUDITIVO TIPO CONCHA - CA 12345 - QTD 1"
                      className="min-h-[160px] bg-slate-50 border-none rounded-2xl p-4 text-xs font-mono shadow-inner"
                      value={rawPpeInput}
                      onChange={(e) => setRawPpeInput(e.target.value)}
                    />
                    <Button
                      onClick={handleAnalyzePpeSheet}
                      disabled={isAnalyzing || !rawPpeInput.trim()}
                      className="w-full h-14 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-xl gap-3"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="size-5 animate-spin text-accent" />
                      ) : (
                        <Sparkles className="size-5 text-accent" />
                      )}
                      Analisar Ficha e Validar C.A. com NAI Vision AI
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in zoom-in-95 text-left">
                    <Card className="border-none bg-slate-50 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <Badge className="bg-primary text-accent font-black uppercase text-[8px] h-5 px-2">
                          Colaborador Identificado
                        </Badge>
                        <span className="text-[9px] font-bold uppercase text-slate-400">
                          Setor: {extractedData.setorFuncao || "Geral"}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-primary uppercase">
                        {extractedData.nomeColaborador}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium italic">
                        "{extractedData.parecerCompliance}"
                      </p>
                    </Card>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        EPIs e C.A.s Extraídos ({extractedData.itens.length}):
                      </h4>
                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                        {extractedData.itens.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white border rounded-xl flex items-center justify-between gap-4 shadow-sm"
                          >
                            <div className="space-y-0.5">
                              <p className="text-xs font-black text-primary uppercase">
                                {item.epiNome}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">
                                Entrega: {item.dataEntrega}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant="outline"
                                className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 border-emerald-200"
                              >
                                C.A. {item.numeroCA}
                              </Badge>
                              <Badge className="bg-slate-100 text-slate-600 border-none text-[8px] font-black uppercase">
                                Qtd: {item.quantidade}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl font-bold uppercase text-[10px] h-12"
                        onClick={() => setExtractedData(null)}
                      >
                        Refazer Análise
                      </Button>
                      <Button
                        onClick={handleSaveDeliveries}
                        disabled={isSaving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] h-12 rounded-xl shadow-lg gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Salvar e Sincronizar eSocial
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Alerta de C.A.s em Risco (MTE) se houver */}
      {catalogStats.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200 rounded-xl text-amber-900">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-950">
                Aviso do Ministério do Trabalho (NR-06)
              </p>
              <p className="text-[11px] text-amber-800 font-medium">
                Existe <strong>{catalogStats.expiringSoon} EPI</strong> com Certificado de Aprovação
                vencendo nos próximos 30 dias. Providencie a substituição do lote junto aos
                fornecedores.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setActiveTab("catalog")}
            className="border-amber-400 text-amber-900 font-black text-[9px] uppercase h-9 rounded-xl hover:bg-amber-100"
          >
            Ver Catálogo
          </Button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-shadow border-none bg-white rounded-3xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="p-2.5 bg-blue-50 rounded-xl w-fit text-blue-600">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total de Entregas</p>
              <h3 className="text-2xl font-black text-primary">{stats.total} Fichas</h3>
            </div>
          </div>
          <Badge className="mt-3 bg-blue-50 text-blue-700 border-none text-[8px] font-black uppercase w-fit">
            Rastreio Jurídico
          </Badge>
        </Card>

        <Card className="card-shadow border-none bg-white rounded-3xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="p-2.5 bg-purple-50 rounded-xl w-fit text-purple-600">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">
                Catálogo de EPIs (NR-06)
              </p>
              <h3 className="text-2xl font-black text-primary">{catalogStats.total} Modelos</h3>
            </div>
          </div>
          <Badge className="mt-3 bg-purple-50 text-purple-700 border-none text-[8px] font-black uppercase w-fit">
            Por Função
          </Badge>
        </Card>

        <Card className="card-shadow border-none bg-emerald-50 rounded-3xl p-5 flex flex-col justify-between border border-emerald-100">
          <div className="space-y-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl w-fit text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-800">
                C.A.s Válidos no MTE
              </p>
              <h3 className="text-2xl font-black text-emerald-900">
                {catalogStats.valid} Conformes
              </h3>
            </div>
          </div>
          <Badge className="mt-3 bg-white text-emerald-700 border-none text-[8px] font-black uppercase w-fit">
            Conformidade NR-06
          </Badge>
        </Card>

        <Card className="card-shadow border-none bg-amber-50 rounded-3xl p-5 flex flex-col justify-between border border-amber-100">
          <div className="space-y-3">
            <div className="p-2.5 bg-amber-100 rounded-xl w-fit text-amber-700">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-800">
                C.A.s em Alerta (&lt;30d)
              </p>
              <h3 className="text-2xl font-black text-amber-900">
                {catalogStats.expiringSoon} Atenção
              </h3>
            </div>
          </div>
          <Badge className="mt-3 bg-white text-amber-800 border-none text-[8px] font-black uppercase w-fit">
            Alerta Ativo
          </Badge>
        </Card>
      </div>

      {/* Tabs: Entregas vs Catálogo */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
            <TabsTrigger
              value="deliveries"
              className="rounded-xl px-5 text-xs font-black uppercase data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <FileText className="size-4 mr-2" /> Fichas de Entrega & Assinaturas
            </TabsTrigger>
            <TabsTrigger
              value="catalog"
              className="rounded-xl px-5 text-xs font-black uppercase data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Briefcase className="size-4 mr-2" /> Catálogo Normativo de EPIs (NR-06)
            </TabsTrigger>
          </TabsList>

          {activeTab === "deliveries" ? (
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 size-4 text-slate-300" />
              <Input
                placeholder="Buscar colaborador, EPI ou C.A..."
                className="pl-10 h-11 border-none bg-white shadow-sm text-xs rounded-xl font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Filtrar por função (ex: Soldador, Eletricista)..."
                className="w-64 h-11 border-none bg-white shadow-sm text-xs rounded-xl font-bold"
                value={catalogRoleFilter}
                onChange={(e) => setCatalogRoleFilter(e.target.value)}
              />
              <Dialog open={isNewPpeOpen} onOpenChange={setIsNewPpeOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white h-11 px-4 rounded-xl font-black uppercase text-[10px] gap-2">
                    <Plus className="size-4" /> Cadastrar EPI
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] rounded-[2rem] bg-white p-6">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-black uppercase">
                      Novo EPI no Catálogo
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Cadastre o EPI com o número de C.A. oficial e validade.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddNewPpe} className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500">
                        Descrição do Equipamento *
                      </label>
                      <Input
                        required
                        placeholder="Ex: Óculos de Proteção Ampla Visão"
                        value={newPpeForm.name}
                        onChange={(e) => setNewPpeForm({ ...newPpeForm, name: e.target.value })}
                        className="rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">
                          Nº do C.A. (MTE) *
                        </label>
                        <Input
                          required
                          placeholder="Ex: 45678"
                          value={newPpeForm.caNumber}
                          onChange={(e) =>
                            setNewPpeForm({ ...newPpeForm, caNumber: e.target.value })
                          }
                          className="rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">
                          Validade do C.A. *
                        </label>
                        <Input
                          required
                          type="date"
                          value={newPpeForm.caExpirationDate}
                          onChange={(e) =>
                            setNewPpeForm({ ...newPpeForm, caExpirationDate: e.target.value })
                          }
                          className="rounded-xl text-xs font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">
                          Fabricante
                        </label>
                        <Input
                          placeholder="Ex: 3M, Danny"
                          value={newPpeForm.manufacturer}
                          onChange={(e) =>
                            setNewPpeForm({ ...newPpeForm, manufacturer: e.target.value })
                          }
                          className="rounded-xl text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">
                          Categoria
                        </label>
                        <select
                          className="w-full h-10 px-2 border rounded-xl text-xs font-bold bg-white"
                          value={newPpeForm.category}
                          onChange={(e) =>
                            setNewPpeForm({ ...newPpeForm, category: e.target.value as any })
                          }
                        >
                          <option value="CABECA">Cabeça</option>
                          <option value="OLHOS_FACE">Olhos e Face</option>
                          <option value="AUDITIVO">Auditivo</option>
                          <option value="RESPIRATORIO">Respiratório</option>
                          <option value="TRONCO">Tronco</option>
                          <option value="MEMBROS_SUPERIORES">Membros Superiores</option>
                          <option value="MEMBROS_INFERIORES">Membros Inferiores</option>
                          <option value="QUEDA">Proteção Contra Quedas</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500">
                        Funções Compatíveis (separadas por vírgula)
                      </label>
                      <Input
                        placeholder="Ex: Soldador, Caldeireiro, Mecânico"
                        value={newPpeForm.compatibleRoles}
                        onChange={(e) =>
                          setNewPpeForm({ ...newPpeForm, compatibleRoles: e.target.value })
                        }
                        className="rounded-xl text-xs font-bold"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary text-white font-black text-xs uppercase h-11 rounded-xl"
                    >
                      Salvar no Catálogo
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Tab 1: Fichas de Entrega */}
        <TabsContent value="deliveries" className="mt-4">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-base font-black text-primary uppercase">
                Histórico de Entregas e Fichas Assinadas
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                Rastreabilidade digital com autenticação biométrica e hash imutável de assinatura
                perante o MTE.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4 text-primary">
                  <Loader2 className="size-12 animate-spin opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Carregando Fichas de EPI...
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50 text-[9px] uppercase font-black tracking-wider">
                    <TableRow>
                      <TableHead className="pl-8">Data Entrega</TableHead>
                      <TableHead>Colaborador / Função</TableHead>
                      <TableHead>Equipamento / Marca</TableHead>
                      <TableHead className="text-center">C.A. (MTE) & Validade</TableHead>
                      <TableHead className="pr-8 text-right">Autenticidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((del: any) => (
                      <TableRow key={del.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="pl-8 py-4">
                          <p className="text-xs font-bold text-primary">{del.deliveredAt}</p>
                          <Badge
                            variant="outline"
                            className="text-[7px] font-black uppercase border-none bg-slate-100 mt-1"
                          >
                            Qtd: {del.quantity || 1} {del.reason ? `• ${del.reason}` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-black text-xs text-primary uppercase">
                            {del.employeeName}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">
                            {del.setorFuncao || "OPERACIONAL"}{" "}
                            {del.cpfMatricula ? `• CPF: ${del.cpfMatricula}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-bold text-slate-800 uppercase">
                            {del.epiNome || del.ppeName}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">
                            MARCA: {del.fabricanteMarca || "CERTIFICADO"}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge
                              variant="outline"
                              className="font-mono text-emerald-700 bg-emerald-50 border-emerald-200 text-xs font-black px-2.5 py-0.5"
                            >
                              C.A. {del.numeroCA || del.caNumber}
                            </Badge>
                            {renderCaBadge(del.caStatus)}
                          </div>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {del.createdVia === "NR06_DIGITAL_ENGINE" ? (
                              <Badge className="bg-emerald-600 text-white border-none text-[8px] font-black uppercase gap-1 px-2 h-5">
                                <Check className="size-3" /> Assinatura Digital NR-06
                              </Badge>
                            ) : del.createdVia === "NAI_VISION_AI" ? (
                              <Badge className="bg-primary text-accent border-none text-[8px] font-black uppercase gap-1 px-2 h-5">
                                <Brain className="size-3" /> NAI Vision AI
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 border-none text-[8px] font-black uppercase gap-1 px-2 h-5">
                                <Zap className="size-3" /> Biometria Digital
                              </Badge>
                            )}
                            {del.signatureHash && (
                              <span
                                className="text-[8px] font-mono text-slate-400"
                                title={del.signatureHash}
                              >
                                HASH: {del.signatureHash.substring(0, 12)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!deliveries || deliveries.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-20 text-center opacity-40 font-black uppercase text-xs tracking-widest"
                        >
                          Nenhuma entrega de EPI registrada nesta unidade
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Catálogo Normativo de EPIs */}
        <TabsContent value="catalog" className="mt-4">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-base font-black text-primary uppercase">
                Catálogo de EPIs Certificados por Função (NR-06)
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                EPIs cadastrados com número de C.A., status de validade perante o MTE e cargos
                habilitados.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 text-[9px] uppercase font-black tracking-wider">
                  <TableRow>
                    <TableHead className="pl-8">Equipamento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>C.A. (MTE)</TableHead>
                    <TableHead>Validade MTE</TableHead>
                    <TableHead>Funções Recomendadas</TableHead>
                    <TableHead className="pr-8 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCatalog.map((item) => {
                    const status = PpeCatalogService.checkCaStatus(item.caExpirationDate);
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="pl-8 py-4">
                          <p className="font-black text-xs text-primary uppercase">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">
                            Fabricante: {item.manufacturer}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[8px] font-bold uppercase border-slate-200"
                          >
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono text-emerald-800 bg-emerald-50 border-emerald-200 text-xs font-black"
                          >
                            C.A. {item.caNumber}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-mono font-bold text-slate-700">
                              {item.caExpirationDate}
                            </span>
                            {renderCaBadge(status)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="flex flex-wrap gap-1">
                            {item.compatibleRoles.map((role, idx) => (
                              <Badge
                                key={idx}
                                className="bg-slate-100 text-slate-600 border-none text-[8px] font-medium"
                              >
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeliveryForm({
                                ...deliveryForm,
                                selectedPpeId: item.id,
                              });
                              setIsNewDeliveryOpen(true);
                            }}
                            className="h-8 px-3 text-[9px] font-black uppercase rounded-lg border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          >
                            Registrar Entrega
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
