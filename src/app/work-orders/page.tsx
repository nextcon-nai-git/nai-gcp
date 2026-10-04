"use client";

import * as React from "react";
import {
  FileText,
  Download,
  Share2,
  Printer,
  LifeBuoy,
  Ship,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  HardHat,
  Anchor,
  Droplets,
  Zap,
  RotateCcw,
  Building2,
  Calendar,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  getDefaultConstrufamOsData,
  generateConstrufamOsPdf,
  downloadConstrufamOsPdf,
  getWhatsAppOsDispatchMessage,
} from "@/services/documents/construfam-os-pdf-generator";
import { WorkOrderConstrufamData } from "@/types/work-order";

const PRESET_CARGOS = [
  {
    cargo: "HIDROMETRISTA",
    descricao: "Coordenação de medição de vazão e operação de barco na calha do rio",
    ghe: "GES 02 - HIDROMETRIA (TRABALHO EMBARCADO)",
    arrais: "381P2021004562 (Arrais-Amador)",
  },
  {
    cargo: "AUXILIAR DE HIDROMETRISTA",
    descricao: "Apoio no transporte do barco, lançamento, coleta e ancoragem de cabo de aço",
    ghe: "GES 02 - HIDROMETRIA (TRABALHO EMBARCADO)",
    arrais: "Tripulante Operacional",
  },
  {
    cargo: "TOPÓGRAFO / HIDRÓGRAFO",
    descricao: "Levantamento batimétrico de leito e nivelamento topohidrográfico",
    ghe: "GES 02 - HIDROMETRIA (TRABALHO EMBARCADO)",
    arrais: "Habilitado Náutico",
  },
  {
    cargo: "OPERADOR DE EMBARCAÇÃO (ARRAIS)",
    descricao: "Piloto dedicado para condução de barco com motor de popa e segurança da tripulação",
    ghe: "GES 02 - NAVEGAÇÃO FLUVIAL E SALVATAGEM",
    arrais: "Habilitação Obrigatória DPC",
  },
];

export default function WorkOrdersPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<WorkOrderConstrufamData>(() =>
    getDefaultConstrufamOsData()
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [whatsappPhone, setWhatsappPhone] = React.useState("55");

  // Atualiza campos do colaborador
  const handleEmployeeChange = (
    field: keyof WorkOrderConstrufamData["colaborador"],
    value: string
  ) => {
    setData((prev) => ({
      ...prev,
      colaborador: {
        ...prev.colaborador,
        [field]: value,
      },
    }));
  };

  // Aplica preset de função
  const applyPreset = (preset: (typeof PRESET_CARGOS)[0]) => {
    setData((prev) => ({
      ...prev,
      colaborador: {
        ...prev.colaborador,
        cargo: preset.cargo,
        ghe: preset.ghe,
        registroArrais: preset.arrais,
      },
    }));
    toast({
      title: "Preset Aplicado",
      description: `Função configurada para: ${preset.cargo}`,
    });
  };

  // Download do PDF oficial
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      downloadConstrufamOsPdf(data);
      toast({
        title: "PDF Oficial Emitido!",
        description: `O arquivo da Ordem de Serviço foi gerado com sucesso para ${data.colaborador.nome}.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar PDF",
        description: err?.message || "Não foi possível compilar o documento PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Enviar via WhatsApp
  const handleSendWhatsApp = () => {
    const message = getWhatsAppOsDispatchMessage(data);
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    const url =
      cleanPhone.length > 5
        ? `https://wa.me/${cleanPhone}?text=${message}`
        : `https://wa.me/?text=${message}`;
    window.open(url, "_blank");
    toast({
      title: "WhatsApp Disparado",
      description: "Link do WhatsApp gerado com os termos e notificação da Ordem de Serviço.",
    });
  };

  // Imprimir diretamente (Print CSS)
  const handlePrint = () => {
    window.print();
  };

  // Restaurar padrão
  const handleReset = () => {
    setData(getDefaultConstrufamOsData());
    toast({
      title: "Padrão Restaurado",
      description: "Dados resetados com as informações canônicas do PGR Construfam.",
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
              <LifeBuoy className="w-6 h-6 text-blue-700" />
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-headline">
              Ordem de Serviço de SST — NR-01
            </h1>
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs font-semibold">
              Trabalho Embarcado
            </Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Emissão obrigatória segundo o <strong>item 1.4.1 da NR-01</strong> e{" "}
            <strong>Art. 157 da CLT</strong>, calibrada com o PGR da{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              CONSTRUFAM ENGENHARIA LTDA
            </span>{" "}
            (Contrato CHESF / STATKRAFT).
          </p>
        </div>

        {/* Botões de Ação no Topo */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium shadow-sm transition-all"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {isGeneratingPdf ? "Gerando PDF..." : "Baixar PDF Oficial"}
          </Button>

          <Button
            onClick={handleSendWhatsApp}
            variant="outline"
            className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            Enviar WhatsApp
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-slate-300 dark:border-slate-700"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Grid Principal: Formulário / Parâmetros à Esquerda e Preview Oficial à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel Lateral de Configuração (4 colunas) */}
        <div className="lg:col-span-4 space-y-5 print:hidden">
          {/* Card: Dados do Colaborador */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 bg-slate-50/60 dark:bg-slate-900/40 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Dados do Colaborador
              </CardTitle>
              <CardDescription className="text-xs">
                Preencha os dados do empregado que assinará a OS.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4 text-xs">
              {/* Presets Rápidos */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Função Rápida (PGR Construfam):
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_CARGOS.map((p) => (
                    <Button
                      key={p.cargo}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyPreset(p)}
                      className={`h-auto py-1 px-2 text-[11px] justify-start text-left truncate ${
                        data.colaborador.cargo === p.cargo
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40"
                          : ""
                      }`}
                    >
                      {p.cargo.split(" ")[0]}...
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label htmlFor="nome" className="text-xs">
                  Nome Completo
                </Label>
                <Input
                  id="nome"
                  value={data.colaborador.nome}
                  onChange={(e) => handleEmployeeChange("nome", e.target.value)}
                  placeholder="Ex: João Carlos da Silva"
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="cpf" className="text-xs">
                    CPF
                  </Label>
                  <Input
                    id="cpf"
                    value={data.colaborador.cpf}
                    onChange={(e) => handleEmployeeChange("cpf", e.target.value)}
                    placeholder="000.000.000-00"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="matricula" className="text-xs">
                    Matrícula
                  </Label>
                  <Input
                    id="matricula"
                    value={data.colaborador.matricula || ""}
                    onChange={(e) => handleEmployeeChange("matricula", e.target.value)}
                    placeholder="CFM-0000"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cargo" className="text-xs">
                  Função / Cargo
                </Label>
                <Input
                  id="cargo"
                  value={data.colaborador.cargo}
                  onChange={(e) => handleEmployeeChange("cargo", e.target.value)}
                  className="mt-1 h-8 text-xs font-semibold"
                />
              </div>

              <div>
                <Label
                  htmlFor="colete"
                  className="text-xs flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  Nº do Colete Salva-Vidas Designado
                </Label>
                <Input
                  id="colete"
                  value={data.colaborador.numeroColeteSalvaVidas || ""}
                  onChange={(e) => handleEmployeeChange("numeroColeteSalvaVidas", e.target.value)}
                  placeholder="Ex: CV-NAI-084"
                  className="mt-1 h-8 text-xs border-red-300 dark:border-red-900"
                />
              </div>

              <div>
                <Label
                  htmlFor="arrais"
                  className="text-xs flex items-center gap-1 text-blue-700 dark:text-blue-400"
                >
                  <Ship className="w-3.5 h-3.5" />
                  Carteira de Arrais / Habilitação Marítima
                </Label>
                <Input
                  id="arrais"
                  value={data.colaborador.registroArrais || ""}
                  onChange={(e) => handleEmployeeChange("registroArrais", e.target.value)}
                  placeholder="Ex: 381P2021004562 ou Tripulante"
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="dataAdmissao" className="text-xs">
                    Data Admissão
                  </Label>
                  <Input
                    id="dataAdmissao"
                    value={data.colaborador.dataAdmissao || ""}
                    onChange={(e) => handleEmployeeChange("dataAdmissao", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="dataEmissao" className="text-xs">
                    Data Emissão OS
                  </Label>
                  <Input
                    id="dataEmissao"
                    value={data.colaborador.dataEmissaoOs}
                    onChange={(e) => handleEmployeeChange("dataEmissaoOs", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              <Separator />

              {/* Envio Direto via WhatsApp */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="phone" className="text-xs text-slate-600 dark:text-slate-400">
                  Telefone WhatsApp do Colaborador (com DDD):
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id="phone"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="5541999998888"
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    Disparar
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="w-full text-slate-500 hover:text-slate-800 text-xs h-7"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restaurar Padrão PGR Construfam
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card: Metadados Normativos */}
          <Card className="border bg-slate-900 text-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm">Conformidade Regulatória</h3>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
              <p>
                • <strong>NR-01 Item 1.4.1:</strong> Instrução formal das medidas de prevenção da
                empresa ao empregado.
              </p>
              <p>
                • <strong>CLT Art. 158:</strong> A recusa injustificada ao cumprimento da OS ou ao
                uso de EPIs configura falta grave.
              </p>
              <p>
                • <strong>NR-01 Item 1.4.3:</strong> Garantia do <em>Direito de Recusa</em> em
                iminência de perigo grave (temporal ou avaria no barco).
              </p>
            </div>
          </Card>
        </div>

        {/* Visualizador da Ordem de Serviço Formatada (8 colunas) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-slate-950 border rounded-xl shadow-md p-6 md:p-8 space-y-6 text-slate-900 dark:text-slate-100 font-sans print:shadow-none print:border-none print:p-0">
            {/* Banner Institucional Superior */}
            <div className="border-b-2 border-blue-950 pb-4 text-center space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-bold text-blue-900 dark:text-blue-400">
                  {data.empresa.razaoSocial}
                </span>
                <span className="font-mono">Controle: {data.numeroControle}</span>
              </div>
              <h2 className="text-lg md:text-xl font-extrabold uppercase tracking-wide text-blue-950 dark:text-blue-200">
                ORDEM DE SERVIÇO DE SEGURANÇA E SAÚDE NO TRABALHO (OS)
              </h2>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                NR-01 (ITEM 1.4.1) | CLT ART. 157 | OPERAÇÕES DE CAMPO E TRABALHO EMBARCADO
              </p>
              <p className="text-[11px] text-slate-500">
                PGR Revisão 03 (Vigência 2026-2028) | Contrato CHESF - Bacia do Rio Piranhas-Açu /
                STATKRAFT
              </p>
            </div>

            {/* Quadro 1: Identificação da Empresa e Contratante */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-lg border text-xs space-y-1">
              <div className="font-bold text-blue-900 dark:text-blue-400 uppercase text-[11px] mb-1">
                1. Identificação do Empregador e Local de Operação
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div>
                  <strong>Razão Social:</strong> {data.empresa.razaoSocial}
                </div>
                <div>
                  <strong>CNPJ:</strong> {data.empresa.cnpj} (Grau de Risco {data.empresa.grauRisco}
                  )
                </div>
                <div>
                  <strong>CNAE:</strong> {data.empresa.cnae}
                </div>
                <div>
                  <strong>Endereço:</strong> {data.empresa.endereco} - {data.empresa.cidadeUf}
                </div>
                <div className="md:col-span-2">
                  <strong>Contratante / Unidade:</strong> {data.empresa.contratante} (
                  {data.empresa.unidadeOperacional})
                </div>
              </div>
            </div>

            {/* Quadro 2: Dados do Colaborador */}
            <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3.5 rounded-lg border border-blue-200 dark:border-blue-900 text-xs space-y-1">
              <div className="font-bold text-blue-900 dark:text-blue-300 uppercase text-[11px] mb-1">
                2. Identificação do Colaborador
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <strong>Nome:</strong>{" "}
                  <span className="text-blue-950 dark:text-blue-100 font-bold">
                    {data.colaborador.nome}
                  </span>
                </div>
                <div>
                  <strong>CPF:</strong> {data.colaborador.cpf}
                </div>
                <div>
                  <strong>Cargo / Função:</strong>{" "}
                  <span className="font-semibold">{data.colaborador.cargo}</span>
                </div>
                <div>
                  <strong>Matrícula:</strong> {data.colaborador.matricula || "N/A"}
                </div>
                <div>
                  <strong>Setor / GHE:</strong> {data.colaborador.ghe}
                </div>
                <div>
                  <strong>Data de Emissão:</strong> {data.colaborador.dataEmissaoOs}
                </div>
                <div className="text-red-700 dark:text-red-400 font-semibold">
                  <strong>Colete Salva-Vidas Designado:</strong>{" "}
                  {data.colaborador.numeroColeteSalvaVidas}
                </div>
                <div>
                  <strong>Habilitação Náutica / Arrais:</strong> {data.colaborador.registroArrais}
                </div>
              </div>
            </div>

            {/* Quadro 3: Descrição das Atividades */}
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs border-b pb-1">
                3. Descrição das Atividades Operacionais e Trabalho Embarcado
              </div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
                {data.descricaoAtividades.map((atv, i) => (
                  <li key={i}>{atv}</li>
                ))}
              </ul>
            </div>

            {/* Quadro 4: Matriz de Riscos Ocupacionais (PGR) */}
            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs border-b pb-1 flex items-center justify-between">
                <span>4. Reconhecimento de Riscos Ocupacionais (PGR Construfam)</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Avaliação segundo NR-01
                </span>
              </div>
              <div className="space-y-2">
                {data.riscosIdentificados.map((risco, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                      risco.grupo === "Acidente"
                        ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                        : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                      <span
                        className={
                          risco.grupo === "Acidente"
                            ? "text-red-800 dark:text-red-300"
                            : "text-blue-900 dark:text-blue-300"
                        }
                      >
                        [{risco.grupo.toUpperCase()}] {risco.fatorRisco}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 bg-white dark:bg-slate-950"
                      >
                        {risco.nivelRisco}
                      </Badge>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[10.5px]">
                      <strong>Causas:</strong> {risco.fontes} | <strong>Danos:</strong>{" "}
                      {risco.possiveisDanos}
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 font-medium text-[10.5px]">
                      <strong>Medidas Preventivas:</strong> {risco.medidasPrevenconais}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quadro 5: EPIs de Uso Obrigatório */}
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs border-b pb-1">
                5. Equipamentos de Proteção Individual (EPIs) & Salvatagem
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.episObrigatorios.map((epi, idx) => (
                  <div
                    key={idx}
                    className="p-2 border rounded bg-slate-50/50 dark:bg-slate-900/30 text-[11px]"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {epi.equipamento}
                    </div>
                    <div className="text-slate-500 flex justify-between">
                      <span>{epi.ca}</span>
                      <span className="text-blue-700 dark:text-blue-400 font-semibold">
                        {epi.obrigatoriedade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quadro 6: Regras de Ouro Náuticas */}
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 text-xs">
                <LifeBuoy className="w-4 h-4 text-amber-600" />
                6. REGRAS DE OURO DA CONSTRUFAM PARA TRABALHO EMBARCADO
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                {data.regrasOuroEmbarcado.map((r, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{r.titulo}</div>
                    <div className="text-slate-600 dark:text-slate-400 leading-tight">
                      {r.descricao}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quadro 7: Proibições Expressas */}
            <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 text-xs space-y-1.5">
              <div className="font-bold text-red-800 dark:text-red-300 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                7. Proibições Expressas (Atos Inseguros Proibidos a Bordo e em Campo)
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[10.5px] text-red-900 dark:text-red-200 list-disc list-inside">
                {data.proibicoesExpressas.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            {/* Quadro 8: Procedimento Homem ao Mar */}
            <div className="p-3.5 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 text-xs space-y-1.5">
              <div className="font-bold text-sky-900 dark:text-sky-300 text-xs flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-sky-600" />
                8. Procedimento Imediato — Homem ao Mar (NORMAM / Marinha)
              </div>
              <div className="text-[10.5px] text-sky-950 dark:text-sky-200 space-y-1">
                {data.procedimentoHomemAoMar.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            {/* Quadro 9: Disposições CLT & Assinaturas */}
            <div className="border-t pt-4 space-y-4 text-xs">
              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10.5px] text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed">
                <p>
                  <strong>Artigo 158 da CLT:</strong> Constitui ato faltoso do empregado a recusa
                  injustificada ao cumprimento das ordens de serviço de segurança expedidas pelo
                  empregador e ao uso dos equipamentos de proteção individual (EPIs).
                </p>
                <p>
                  <strong>NR-01 Item 1.4.3 (Direito de Recusa):</strong> O colaborador tem o dever
                  de interromper a atividade caso constate risco grave e iminente à sua vida ou à
                  integridade física de sua equipe.
                </p>
              </div>

              {/* Termo de Compromisso */}
              <p className="text-[11px] text-slate-700 dark:text-slate-300 italic text-justify leading-relaxed">
                "Declaro que recebi da CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA a presente Ordem
                de Serviço de NR-01 referente às atividades operacionais e embarcadas em bacias
                hidrográficas/PCHs, tendo sido treinado e orientado acerca de todos os riscos,
                especialmente o risco de afogamento e uso do colete salva-vidas. Comprometo-me a
                cumpri-la integralmente sob as penas da lei."
              </p>

              {/* Assinaturas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                <div className="text-center space-y-1 border-t border-slate-400 pt-2">
                  <div className="font-bold text-xs">{data.colaborador.nome}</div>
                  <div className="text-[10px] text-slate-500">
                    CPF: {data.colaborador.cpf} | {data.colaborador.cargo}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Assinatura do Empregado — Data: ____/____/2026
                  </div>
                </div>

                <div className="text-center space-y-1 border-t border-slate-400 pt-2">
                  <div className="font-bold text-xs">{data.responsavelSst.nome}</div>
                  <div className="text-[10px] text-slate-500">
                    {data.responsavelSst.cargo} - {data.responsavelSst.registroProfissional}
                  </div>
                  <div className="text-[10px] text-slate-400">{data.empresa.razaoSocial}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
