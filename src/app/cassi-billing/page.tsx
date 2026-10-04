"use client";

import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  Upload,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Stethoscope,
  Building2,
  Layers,
  FileSpreadsheet,
  HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CASSI_COMMON_PROCEDURES,
  CassiGuideData,
  CassiProcedureItem,
  CassiExpenseItem,
  CassiAttachmentItem,
  generateCassiRpaScript,
  generateTissXml,
} from "@/lib/cassi-automation";
import { REAL_PROVIDERS } from "@/lib/real-data";

export default function CassiBillingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("preenchimento");

  // Formulário da Guia CASSI
  const [guideType, setGuideType] = useState<"SP_SADT" | "INTERNACAO" | "HONORARIOS">("SP_SADT");
  const [authNumber, setAuthNumber] = useState("9847291034");
  const [authDate, setAuthDate] = useState("2026-09-04");
  const [providerGuideNumber, setProviderGuideNumber] = useState(
    `NXC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [passwordValidity, setPasswordValidity] = useState("2026-10-04");

  // Beneficiário
  const [cardNumber, setCardNumber] = useState("1029384756001");
  const [cardValidity, setCardValidity] = useState("2028-12-31");
  const [beneficiaryName, setBeneficiaryName] = useState("MARCOS AURÉLIO DA SILVA");
  const [cns, setCns] = useState("700001234567890");
  const [isNewborn] = useState(false);

  // Executante & Solicitante
  const [selectedProviderId, setSelectedProviderId] = useState("50917337000136");
  const [operatorCode, setOperatorCode] = useState("44.337.647/0001-89");
  const [cnesCode, setCnesCode] = useState("9384721");
  const [contractedName] = useState("NXC SAÚDE EMPRESARIAL LTDA");

  const [doctorName, setDoctorName] = useState("DR. CAIO VINICIUS DE CASTRO LIMA MARTINS");
  const [councilType, setCouncilType] = useState("CRM");
  const [councilNumber, setCouncilNumber] = useState("30470");
  const [councilUf, setCouncilUf] = useState("DF");
  const [cboCode, setCboCode] = useState("225125");

  // Atendimento & CID
  const [attendanceType, setAttendanceType] = useState("01 - Consulta");
  const [careCharacter, setCareCharacter] = useState<"1" | "2">("1");
  const [consultationType] = useState("1 - Primeira Consulta");
  const [accidentIndication] = useState("0 - Não Acidente");
  const [primaryCid, setPrimaryCid] = useState("Z10.0");
  const [secondaryCid, setSecondaryCid] = useState("");

  // Procedimentos
  const [procedures, setProcedures] = useState<CassiProcedureItem[]>([
    {
      id: "proc_1",
      code: "10101012",
      description: "Consulta em consultório (no horário normal ou preestabelecido)",
      isPackage: false,
      date: "2026-09-04",
      quantity: 1,
      unitValue: 120.0,
      totalValue: 120.0,
    },
  ]);

  // Despesas adicionais
  const [expenses] = useState<CassiExpenseItem[]>([]);

  // Anexos
  const [attachments] = useState<CassiAttachmentItem[]>([
    {
      id: "att_1",
      docType: "Laudo Médico",
      fileName: "laudo_medico_ocupacional.pdf",
      fileSize: "1.2 MB",
      description: "Laudo Clínico Ocupacional e Atestado de Aptidão",
    },
    {
      id: "att_2",
      docType: "Nota Fiscal",
      fileName: "nfe_servico_cassi_092026.pdf",
      fileSize: "850 KB",
      description: "Nota Fiscal de Prestação de Serviços ref. Consulta",
    },
  ]);

  // Lista de guias em acompanhamento (Workflow CASSI)
  const [trackedGuides] = useState([
    {
      id: "G-1029",
      providerGuideNumber: "NXC-2026-8912",
      beneficiaryName: "CARLOS ALBERTO NOGUEIRA",
      guideType: "SP/SADT",
      authNumber: "84729104",
      status: "PENDENTE_TRANSMISSAO",
      daysRemaining: 7,
      total: 240.0,
      date: "01/09/2026",
      hasPendingDocs: false,
    },
    {
      id: "G-1028",
      providerGuideNumber: "NXC-2026-8845",
      beneficiaryName: "ANA PAULA FERREIRA",
      guideType: "SP/SADT",
      authNumber: "84729011",
      status: "PENDENTE_REGULARIZACAO",
      daysRemaining: 4,
      total: 350.0,
      date: "28/08/2026",
      hasPendingDocs: true,
    },
    {
      id: "G-1027",
      providerGuideNumber: "NXC-2026-8790",
      beneficiaryName: "JULIANA PARENTE MACEDO",
      guideType: "Internação",
      authNumber: "17106509",
      status: "TRANSMITIDO",
      daysRemaining: 0,
      total: 10000.0,
      date: "15/08/2026",
      hasPendingDocs: false,
    },
  ]);

  const handleSelectProvider = (provId: string) => {
    setSelectedProviderId(provId);
    const prov = REAL_PROVIDERS.find((p) => p.id === provId);
    if (prov) {
      setDoctorName(prov.displayName || prov.name);
      setCouncilNumber(prov.councilNumber?.replace(/\D/g, "") || "30470");
      setCouncilUf((prov as any).ufCouncil || prov.state || "DF");
      if (prov.profession?.includes("Fisioterap")) {
        setCouncilType("CREFITO");
        setCboCode("223605");
      } else if (prov.profession?.includes("Psicól")) {
        setCouncilType("CRP");
        setCboCode("251510");
      } else if (prov.profession?.includes("Enferm")) {
        setCouncilType("COREN");
        setCboCode("223505");
      } else {
        setCouncilType("CRM");
        setCboCode("225125");
      }
    }
  };

  const handleAddProcedure = (proc: (typeof CASSI_COMMON_PROCEDURES)[0]) => {
    const newItem: CassiProcedureItem = {
      id: `proc_${Date.now()}`,
      code: proc.code,
      description: proc.description,
      isPackage: false,
      date: authDate || "2026-09-04",
      quantity: 1,
      unitValue: proc.defaultPrice,
      totalValue: proc.defaultPrice,
    };
    setProcedures([...procedures, newItem]);
    toast({
      title: "Procedimento Adicionado!",
      description: `${proc.code} - ${proc.description}`,
    });
  };

  const handleRemoveProcedure = (id: string) => {
    setProcedures(procedures.filter((p) => p.id !== id));
  };

  const handleQuantityChange = (id: string, qty: number) => {
    setProcedures(
      procedures.map((p) => {
        if (p.id === id) {
          const total = qty * p.unitValue;
          return { ...p, quantity: qty, totalValue: total };
        }
        return p;
      })
    );
  };

  const totalValue =
    procedures.reduce((acc, p) => acc + p.totalValue, 0) +
    expenses.reduce((acc, e) => acc + e.totalValue, 0);

  const guidePayload: CassiGuideData = {
    id: `cassi_${Date.now()}`,
    guideType,
    authorizationNumber: authNumber,
    authorizationDate: authDate,
    passwordValidity,
    providerGuideNumber,
    beneficiaryCardNumber: cardNumber,
    beneficiaryCardValidity: cardValidity,
    beneficiaryName,
    beneficiaryCns: cns,
    isNewbornCare: isNewborn,
    operatorCode,
    cnesCode,
    contractedName,
    attendanceType,
    accidentIndication,
    consultationType,
    careCharacter,
    attendanceEndReason: "1 - Alta / Concluído",
    requesterName: doctorName,
    requesterCouncilType: councilType,
    requesterCouncilNumber: councilNumber,
    requesterCouncilUf: councilUf,
    requesterCbo: cboCode,
    primaryCid,
    secondaryCid,
    procedures,
    otherExpenses: expenses,
    attachments,
    status: "PENDENTE_DIGITACAO",
    createdAt: new Date().toISOString(),
    totalGuideValue: totalValue,
  };

  const rpaScript = generateCassiRpaScript(guidePayload);
  const tissXml = generateTissXml(guidePayload);

  const copyRpaToClipboard = () => {
    navigator.clipboard.writeText(rpaScript);
    toast({
      title: "Script RPA Copiado! 🚀",
      description:
        "Abra a aba do Portal CASSI, abra o Console (F12) e cole o script para preencher a guia instantaneamente.",
    });
  };

  const copyBookmarklet = () => {
    const bookmarkletCode = `javascript:${encodeURIComponent(rpaScript)}`;
    navigator.clipboard.writeText(bookmarkletCode);
    toast({
      title: "Bookmarklet Copiado! 🔖",
      description:
        "Crie um favorito no seu navegador e cole como URL para autopreencher com 1 clique.",
    });
  };

  const downloadXml = () => {
    const blob = new Blob([tissXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TISS_CASSI_${providerGuideNumber}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "XML TISS Gerado com Sucesso!",
      description: `Arquivo salvo como TISS_CASSI_${providerGuideNumber}.xml`,
    });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-xl">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Automação & Digitação no Portal CASSI
                </h1>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  Manual GCM V.01
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Gerador inteligente de Guias TISS (SP/SADT, Internação e Honorários), preenchimento
                automatizado via RPA e conformidade ANS (34665-9).
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={copyBookmarklet}
            className="border-slate-300 hover:bg-slate-100 dark:border-slate-700"
          >
            <Copy className="w-4 h-4 mr-1.5 text-blue-600" />
            Copiar Bookmarklet
          </Button>

          <Button
            onClick={copyRpaToClipboard}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm shadow-blue-500/20"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Copiar Script RPA (1-Clique)
          </Button>

          <Button
            variant="secondary"
            onClick={downloadXml}
            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Baixar TISS XML
          </Button>

          <Button
            variant="outline"
            asChild
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            <a href="https://www.cassi.com.br" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Abrir Portal CASSI
            </a>
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 md:w-[480px]">
          <TabsTrigger value="preenchimento" className="text-xs sm:text-sm">
            <FileText className="w-4 h-4 mr-1.5" />
            Criador de Guia
          </TabsTrigger>
          <TabsTrigger value="workflow" className="text-xs sm:text-sm">
            <Clock className="w-4 h-4 mr-1.5" />
            Acompanhamento CASSI
          </TabsTrigger>
          <TabsTrigger value="manual" className="text-xs sm:text-sm">
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Guia Rápido (Manual)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FORMULÁRIO E AUTOMAÇÃO */}
        <TabsContent value="preenchimento" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUNA ESQUERDA & CENTRO: FORMULÁRIO COMPLETO */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Tipo de Guia & Autorização */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        1. Dados da Guia & Tipo de Faturamento
                      </CardTitle>
                      <CardDescription>
                        Conforme Item 06 do Manual: Insira o número de autorização e selecione o
                        tipo de guia.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      ANS: 34665-9 (CASSI)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">* Tipo de Guia</Label>
                      <Select value={guideType} onValueChange={(val: any) => setGuideType(val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SP_SADT">
                            Guia de SP/SADT (Consultas/Exames)
                          </SelectItem>
                          <SelectItem value="INTERNACAO">Guia de Internação</SelectItem>
                          <SelectItem value="HONORARIOS">Guia de Honorários Individuais</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Nota: Consultas eletivas (1.01.01.012) usam SP/SADT.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Nº da Autorização / Senha
                      </Label>
                      <Input
                        value={authNumber}
                        onChange={(e) => setAuthNumber(e.target.value)}
                        placeholder="Ex: 9847291034"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Nº Guia no Prestador
                      </Label>
                      <Input
                        value={providerGuideNumber}
                        onChange={(e) => setProviderGuideNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data da Autorização</Label>
                      <Input
                        type="date"
                        value={authDate}
                        onChange={(e) => setAuthDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Validade da Senha</Label>
                      <Input
                        type="date"
                        value={passwordValidity}
                        onChange={(e) => setPasswordValidity(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Beneficiário & Atendimento */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    2. Dados do Beneficiário & Detalhes do Atendimento
                  </CardTitle>
                  <CardDescription>
                    Campos obrigatórios sinalizados no Manual CASSI (Pág. 6/23).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Nº da Carteira (Participante)
                      </Label>
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="Ex: 1029384756001"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Nome do Beneficiário
                      </Label>
                      <Input
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="Nome completo do paciente"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cartão Nacional de Saúde (CNS)</Label>
                      <Input
                        value={cns}
                        onChange={(e) => setCns(e.target.value)}
                        placeholder="700000000000000"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Caráter de Atendimento
                      </Label>
                      <Select
                        value={careCharacter}
                        onValueChange={(val: any) => setCareCharacter(val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Eletivo</SelectItem>
                          <SelectItem value="2">2 - Urgência / Emergência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Tipo de Atendimento
                      </Label>
                      <Select value={attendanceType} onValueChange={setAttendanceType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01 - Consulta">01 - Consulta</SelectItem>
                          <SelectItem value="04 - Exames">04 - Exames Complementares</SelectItem>
                          <SelectItem value="07 - Pequena Cirurgia">
                            07 - Pequena Cirurgia / Procedimento
                          </SelectItem>
                          <SelectItem value="08 - Terapia">08 - Sessão Terapêutica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Diagnóstico Principal (CID-10)
                      </Label>
                      <Input
                        value={primaryCid}
                        onChange={(e) => setPrimaryCid(e.target.value)}
                        placeholder="Ex: Z10.0 ou M54.5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Diagnóstico Secundário (CID-10 Opcional)</Label>
                      <Input
                        value={secondaryCid}
                        onChange={(e) => setSecondaryCid(e.target.value)}
                        placeholder="Ex: F41.1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Prestador & Responsável Técnico */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-blue-600" />
                        3. Corpo Clínico & Profissional Executante
                      </CardTitle>
                      <CardDescription>
                        Preencha automaticamente usando a base de profissionais credenciados da
                        plataforma.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      ⚡ Selecionar Prestador Cadastrado no NAI (Auto-Preenchimento):
                    </Label>
                    <Select value={selectedProviderId} onValueChange={handleSelectProvider}>
                      <SelectTrigger className="border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20">
                        <SelectValue placeholder="Selecione um profissional..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REAL_PROVIDERS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.displayName || p.name} — {p.profession || p.specialty} (
                            {p.councilNumber || "SST"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Nome do Profissional Executante
                      </Label>
                      <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">* Conselho</Label>
                      <Select value={councilType} onValueChange={setCouncilType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Conselho" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRM">CRM (Medicina)</SelectItem>
                          <SelectItem value="CREFITO">CREFITO (Fisioterapia)</SelectItem>
                          <SelectItem value="CRP">CRP (Psicologia)</SelectItem>
                          <SelectItem value="COREN">COREN (Enfermagem)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * Nº / UF Conselho
                      </Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={councilNumber}
                          onChange={(e) => setCouncilNumber(e.target.value)}
                          placeholder="Número"
                        />
                        <Input
                          value={councilUf}
                          onChange={(e) => setCouncilUf(e.target.value)}
                          className="w-16"
                          placeholder="UF"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">* Código CBO</Label>
                      <Input
                        value={cboCode}
                        onChange={(e) => setCboCode(e.target.value)}
                        placeholder="Ex: 225125"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">* Código CNES</Label>
                      <Input
                        value={cnesCode}
                        onChange={(e) => setCnesCode(e.target.value)}
                        placeholder="Ex: 9384721"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-500 font-semibold">
                        * CNPJ / Código Operadora
                      </Label>
                      <Input
                        value={operatorCode}
                        onChange={(e) => setOperatorCode(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Procedimentos e Exames (TUSS / CASSI) */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                        4. Procedimentos e Exames Realizados (Aba Procedimentos)
                      </CardTitle>
                      <CardDescription>
                        Itens cobrados na guia com seus respectivos códigos TUSS, quantidades e
                        valores.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 mb-2 block">
                      + Inserir Procedimentos Frequentes CASSI / Ocupacionais:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {CASSI_COMMON_PROCEDURES.slice(0, 6).map((item) => (
                        <Button
                          key={item.code}
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddProcedure(item)}
                          className="text-xs h-8 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 dark:bg-slate-900"
                        >
                          <Plus className="w-3 h-3 mr-1 text-blue-600" />
                          {item.code} ({item.description.split(" ")[0]}...)
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b">
                        <tr>
                          <th className="p-2.5 text-left font-semibold">Código TUSS</th>
                          <th className="p-2.5 text-left font-semibold">
                            Descrição do Procedimento
                          </th>
                          <th className="p-2.5 text-center font-semibold w-20">Qtd</th>
                          <th className="p-2.5 text-right font-semibold w-28">Valor Unit.</th>
                          <th className="p-2.5 text-right font-semibold w-28">Total</th>
                          <th className="p-2.5 text-center w-12">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {procedures.map((proc) => (
                          <tr
                            key={proc.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="p-2.5 font-mono font-medium text-blue-600 dark:text-blue-400">
                              {proc.code}
                            </td>
                            <td className="p-2.5 text-slate-800 dark:text-slate-200">
                              {proc.description}
                            </td>
                            <td className="p-2.5 text-center">
                              <Input
                                type="number"
                                min={1}
                                value={proc.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(proc.id, parseInt(e.target.value) || 1)
                                }
                                className="w-16 h-7 text-center mx-auto text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-right font-mono">
                              R$ {proc.unitValue.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              R$ {proc.totalValue.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveProcedure(proc.id)}
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-2 px-2">
                    <span className="text-xs text-slate-500">
                      Total de procedimentos adicionados: <strong>{procedures.length}</strong>
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Subtotal Procedimentos:</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                        R$ {procedures.reduce((acc, p) => acc + p.totalValue, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 5: Anexos e Documentos Digitalizados */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="w-4 h-4 text-blue-600" />
                        5. Gestão de Anexos Obrigatórios & Opcionais (Aba Upload)
                      </CardTitle>
                      <CardDescription>
                        Manual CASSI Pág. 13-15: Laudos, Notas Fiscais e Relatórios (JPEG, PNG, GIF,
                        PDF, TIFF até 5MB).
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-900 flex items-start justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {att.docType}
                            </Badge>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                              {att.fileName}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {att.description} ({att.fileSize})
                          </p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* COLUNA DIREITA: RESUMO, RPA E CONTROLE DE PRAZOS */}
            <div className="space-y-6">
              {/* Card Resumo Financeiro */}
              <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Resumo do Lote de Faturamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Operadora:</span>
                      <span className="font-semibold">CASSI (ANS 34665-9)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Tipo de Guia:</span>
                      <span className="font-semibold">{guideType}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Beneficiário:</span>
                      <span className="font-semibold truncate max-w-[140px]">
                        {beneficiaryName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Profissional:</span>
                      <span className="font-semibold truncate max-w-[140px]">{doctorName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Total de Procedimentos:</span>
                      <span className="font-semibold">{procedures.length} item(ns)</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border shadow-sm">
                    <span className="text-xs text-muted-foreground block">
                      Valor Total da Guia:
                    </span>
                    <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      R$ {totalValue.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={copyRpaToClipboard}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Copiar Script RPA (Portal CASSI)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={copyBookmarklet}
                      className="w-full border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-800 dark:text-blue-300"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar Código Bookmarklet
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={downloadXml}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar XML TISS Oficial
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Como Funciona a Automação */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Como usar a Automação em 3 Passos:
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-3 text-slate-600 dark:text-slate-400">
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <p>
                      Clique em <strong>Copiar Script RPA</strong> acima.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <p>
                      Acesse o <strong>Portal CASSI</strong> &gt;{" "}
                      <em>Gestão de Documentos Eletrônicos</em> &gt; <em>Nova Guia</em>.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <p>
                      Pressione <strong>F12</strong> (Console do navegador) e cole (
                      <strong>Ctrl+V / Cmd+V</strong>) e tecle Enter. A guia é preenchida
                      instantaneamente!
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card Alerta de Prazos CASSI (10 dias) */}
              <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Regra Crítica de Prazos CASSI
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-amber-900/80 dark:text-amber-200/80">
                  <p>
                    <strong>Atenção (Item 29 do Manual):</strong> Guias em{" "}
                    <em>&quot;Pendentes Transmissão&quot;</em> devem ser enviadas em até{" "}
                    <strong>10 dias corridos</strong>.
                  </p>
                  <p>
                    Após este prazo, a plataforma da CASSI <strong>exclui automaticamente</strong> o
                    registro, exigindo nova digitação e autorização.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ACOMPANHAMENTO E WORKFLOW CASSI */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Painel de Monitoramento de Guias CASSI (Item 25-30 do Manual)
                  </CardTitle>
                  <CardDescription>
                    Monitore guias em regularização, pendentes de transmissão e enviadas para evitar
                    perda do prazo de 10 dias.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b">
                    <tr>
                      <th className="p-2.5 text-left font-semibold">Nº Guia Prestador</th>
                      <th className="p-2.5 text-left font-semibold">Beneficiário</th>
                      <th className="p-2.5 text-left font-semibold">Tipo</th>
                      <th className="p-2.5 text-left font-semibold">Autorização</th>
                      <th className="p-2.5 text-center font-semibold">Status CASSI</th>
                      <th className="p-2.5 text-center font-semibold">Prazo Limite</th>
                      <th className="p-2.5 text-right font-semibold">Valor Total</th>
                      <th className="p-2.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trackedGuides.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 font-mono font-medium text-blue-600">
                          {g.providerGuideNumber}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {g.beneficiaryName}
                        </td>
                        <td className="p-2.5">{g.guideType}</td>
                        <td className="p-2.5 font-mono text-slate-500">{g.authNumber}</td>
                        <td className="p-2.5 text-center">
                          {g.status === "TRANSMITIDO" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                              Transmitido
                            </Badge>
                          ) : g.status === "PENDENTE_REGULARIZACAO" ? (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                              Doc. Pendente
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                              Pendente Envio
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {g.status === "TRANSMITIDO" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className="font-bold text-amber-600">
                              {g.daysRemaining} dias restantes
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          R$ {g.total.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              setBeneficiaryName(g.beneficiaryName);
                              setAuthNumber(g.authNumber);
                              setProviderGuideNumber(g.providerGuideNumber);
                              setActiveTab("preenchimento");
                              toast({
                                title: "Guia Carregada no Editor",
                                description: `Guia ${g.providerGuideNumber} pronta para automação.`,
                              });
                            }}
                          >
                            Carregar RPA
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RESUMO E FLUXO DO MANUAL CASSI */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                Estrutura & Fluxo Oficial do Manual CASSI (GCM - 23 Páginas)
              </CardTitle>
              <CardDescription>
                Mapeamento das 10 etapas oficiais do Manual de Digitação de Contas Médicas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    Acesso e Login (Págs. 3-4)
                  </h4>
                  <p>
                    Acesso ao portal CASSI &gt; &quot;Prestador&quot; &gt; &quot;Gestão de
                    Documentos Eletrônicos de Prestador&quot; com CPF/CNPJ e Senha.
                  </p>
                </div>

                <div className="p-3.5 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    Seleção e Nova Guia (Págs. 5-8)
                  </h4>
                  <p>
                    Inserção do número de autorização e escolha entre Guia SP/SADT, Internação ou
                    Honorários (consultas eletivas termo 1.01.01.012 usam SP/SADT).
                  </p>
                </div>

                <div className="p-3.5 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    Digitação de Procedimentos & Pacotes (Págs. 9-11)
                  </h4>
                  <p>
                    Inclusão por código/descrição TUSS, quantidade, valor unitário, fator de
                    redução/acréscimo e grau de participação cirúrgica.
                  </p>
                </div>

                <div className="p-3.5 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      4
                    </span>
                    Outras Despesas e Insumos (Pág. 12)
                  </h4>
                  <p>
                    Lançamento de medicamentos, diárias, taxas, gases e materiais com código de
                    tabela, registro ANVISA e referência de fabricante.
                  </p>
                </div>

                <div className="p-3.5 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      5
                    </span>
                    Upload de Documentos Obrigatórios (Págs. 13-15)
                  </h4>
                  <p>
                    Envio de laudos médicos e notas fiscais com descrição (JPEG, PNG, GIF, PDF, TIFF
                    até 5MB por arquivo).
                  </p>
                </div>

                <div className="p-3.5 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      6
                    </span>
                    Revisão, Transmissão & 10 Dias (Págs. 16-21)
                  </h4>
                  <p>
                    Aba &quot;Resumo&quot; &gt; &quot;Confirmar Revisão&quot; &gt; &quot;Enviar
                    Guias&quot;. Monitoramento na aba Pendentes de Transmissão (limite de 10 dias).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
