"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Filter,
  Compass,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Layers,
  Users,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Globe,
  Activity,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Navigation,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import {
  aggregateAvpLocalities,
  AvpLocalityAggregate,
  ASO_STATUS_CONFIG,
} from "@/lib/avp-geo-data";
import {
  BRAZIL_STATES_PATHS,
  BrazilStatePath,
  BRAZIL_STATE_VIEWBOXES,
  getStateViewBox,
  getCityViewBox,
  StateViewBoxData,
} from "@/lib/brazil-states-paths";
import { avpCostSummary, formatBrlCents } from "@/lib/avp-costs";
import { AvpClinicAlternatives } from "./avp-clinic-alternatives";
import { buildAvpKml } from "@/lib/avp-kml-export";
import { GLOBAL_CLINICS_CATALOG } from "@/lib/avp-clinics-data";
import {
  parseClinicAndPhoneCells,
  generateWhatsAppAppointmentMessage,
  generateWhatsAppCredenciamentoMessage,
} from "@/lib/avp-clinic-intelligence";

interface GrupoAvpQueueMapProps {
  asos: GrupoAvpAso[];
  onSelectCityFilter?: (cityName: string) => void;
  selectedCityFilter?: string;
}

// Bounding boxes das Macro-Regiões para Auto-Zoom
const REGION_VIEWBOXES: Record<
  string,
  { x: number; y: number; w: number; h: number; viewBox: string; label: string }
> = {
  TODOS: { x: 0, y: 0, w: 800, h: 800, viewBox: "0 0 800 800", label: "Brasil Completo" },
  Nordeste: {
    x: 460,
    y: 140,
    w: 330,
    h: 360,
    viewBox: "460 140 330 360",
    label: "Nordeste (42 Polos)",
  },
  Sudeste: {
    x: 380,
    y: 370,
    w: 340,
    h: 280,
    viewBox: "380 370 340 280",
    label: "Sudeste (28 Polos)",
  },
  Sul: { x: 300, y: 540, w: 260, h: 260, viewBox: "300 540 260 260", label: "Sul (12 Polos)" },
  Norte: { x: 30, y: 20, w: 560, h: 410, viewBox: "30 20 560 410", label: "Norte (19 Polos)" },
  "Centro-Oeste": {
    x: 230,
    y: 240,
    w: 360,
    h: 380,
    viewBox: "230 240 360 380",
    label: "Centro-Oeste (3 Polos)",
  },
};

export function GrupoAvpQueueMap({
  asos,
  onSelectCityFilter,
  selectedCityFilter,
}: GrupoAvpQueueMapProps) {
  const { toast } = useToast();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Modos de visualização do mapa:
  // "STATUS" = Cores por status da fila (Urgente, Não Iniciado, Agendado, etc.)
  // "REDUNDANCY" = Radar de contingência de clínicas (0 = Crítico, 1 = Vulnerável, 2+ = Resiliente)
  const [mapMode, setMapMode] = useState<"STATUS" | "REDUNDANCY" | "COST">("COST");
  const [showNetworkArcs, setShowNetworkArcs] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("TODOS");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeLocalityKey, setActiveLocalityKey] = useState<string | null>(null);
  const [hoveredLocality, setHoveredLocality] = useState<AvpLocalityAggregate | null>(null);
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // VIEWPORT DINÂMICO DE ZOOM E PAN
  const [viewport, setViewport] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 800,
    h: 800,
  });

  // Estado de Arrastar (Pan) com Mouse
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    clientX: number;
    clientY: number;
    vx: number;
    vy: number;
  } | null>(null);

  // Agrega todas as localidades
  const aggregates = useMemo(() => aggregateAvpLocalities(asos), [asos]);
  const allAggregates = useMemo(() => aggregates.filter((loc) => loc.geoKnown), [aggregates]);
  const unmapped = useMemo(() => aggregates.filter((loc) => !loc.geoKnown), [aggregates]);
  const downloadKml = () => {
    const url = URL.createObjectURL(
      new Blob([buildAvpKml(asos)], { type: "application/vnd.google-earth.kml+xml" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "AVP_Custos_e_Clinicas.kml";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Contagem de ASOs e polos por UF para Heatmap nos Estados
  const ufStats = useMemo(() => {
    const asosByUf: Record<string, number> = {};
    const polesByUf: Record<string, number> = {};
    asos.forEach((a) => {
      if (a.uf) {
        asosByUf[a.uf] = (asosByUf[a.uf] || 0) + 1;
      }
    });
    allAggregates.forEach((loc) => {
      if (loc.uf) {
        polesByUf[loc.uf] = (polesByUf[loc.uf] || 0) + 1;
      }
    });
    return { asosByUf, polesByUf };
  }, [asos, allAggregates]);

  // Mapeia clínicas por localidade e calcula índice de contingência (0, 1 ou 2+ clínicas)
  const localityClinicsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        clinics: string[];
        count: number;
        status: "CRITICO" | "VULNERAVEL" | "RESILIENTE";
        color: string;
        label: string;
      }
    >();

    allAggregates.forEach((loc) => {
      const clinicNames = new Set<string>();
      // 1. Clínicas citadas nos ASOs da comarca
      loc.asos.forEach((a) => {
        if (a.nomeClinica && a.nomeClinica.trim()) {
          const parsed = parseClinicAndPhoneCells(a.nomeClinica, a.telefoneClinica);
          parsed.forEach((p) => {
            if (p.nome) clinicNames.add(p.nome.toUpperCase());
          });
        }
      });
      // 2. Clínicas credenciadas no catálogo global com abrangência para esta cidade
      GLOBAL_CLINICS_CATALOG.forEach((gc) => {
        if (gc.cities.some((c) => c.toLowerCase() === loc.cidade.toLowerCase())) {
          clinicNames.add(gc.displayName.toUpperCase());
        }
      });

      const uniqueCount = clinicNames.size;
      let status: "CRITICO" | "VULNERAVEL" | "RESILIENTE" = "CRITICO";
      let color = "#ef4444"; // Vermelho
      let label = "0 Clínicas (Crítico)";

      if (uniqueCount === 1) {
        status = "VULNERAVEL";
        color = "#f59e0b"; // Âmbar
        label = "1 Clínica (Sem Suplente)";
      } else if (uniqueCount >= 2) {
        status = "RESILIENTE";
        color = "#10b981"; // Esmeralda
        label = `${uniqueCount} Clínicas (Resiliente)`;
      }

      map.set(loc.key, {
        clinics: Array.from(clinicNames),
        count: uniqueCount,
        status,
        color,
        label,
      });
    });

    return map;
  }, [allAggregates]);

  // Se houver um filtro de cidade vindo de fora, ativa a localidade e dá zoom
  useEffect(() => {
    if (selectedCityFilter) {
      const match = allAggregates.find(
        (a) => a.cidade.toLowerCase() === selectedCityFilter.toLowerCase()
      );
      if (match) {
        setActiveLocalityKey(match.key);
        if (match.uf) setSelectedState(match.uf);
        const cityVb = getCityViewBox(match.x, match.y, 95);
        setViewport({ x: cityVb.x, y: cityVb.y, w: cityVb.w, h: cityVb.h });
      }
    }
  }, [selectedCityFilter, allAggregates]);

  // Localidade ativa detalhada (default: Fortaleza - CE com maior volume de ASOs)
  const activeLocality = useMemo(() => {
    if (activeLocalityKey) {
      return allAggregates.find((a) => a.key === activeLocalityKey) || allAggregates[0];
    }
    return allAggregates[0] || null;
  }, [activeLocalityKey, allAggregates]);

  // Cidades do mesmo estado da localidade ativa (para navegação ← →)
  const stateSiblings = useMemo(() => {
    if (!activeLocality || !activeLocality.uf) return [];
    return allAggregates.filter((a) => a.uf === activeLocality.uf);
  }, [activeLocality, allAggregates]);

  const siblingIndex = useMemo(() => {
    if (!activeLocality) return -1;
    return stateSiblings.findIndex((a) => a.key === activeLocality.key);
  }, [activeLocality, stateSiblings]);

  // Contatos de clínicas parseados para a localidade ativa
  const activeLocalityClinics = useMemo(() => {
    if (!activeLocality) return [];
    const clinicsList: { nome: string; telefone?: string; whatsappUrl?: string }[] = [];
    const seen = new Set<string>();

    activeLocality.asos.forEach((a) => {
      if (a.nomeClinica) {
        const msg = generateWhatsAppAppointmentMessage(a);
        const parsed = parseClinicAndPhoneCells(a.nomeClinica, a.telefoneClinica, msg);
        parsed.forEach((p) => {
          if (!seen.has(p.nome)) {
            seen.add(p.nome);
            clinicsList.push(p);
          }
        });
      }
    });

    return clinicsList;
  }, [activeLocality]);

  // Hubs principais para arcos de conexão tática
  const primaryHub = useMemo(() => {
    return allAggregates.find((a) => a.cidade === "Fortaleza" && a.uf === "CE") || allAggregates[0];
  }, [allAggregates]);

  // Filtra as localidades conforme busca, região e status
  const filteredLocalities = useMemo(() => {
    return allAggregates.filter((loc) => {
      // Filtro de Estado Específico (se selecionado via dropdown/zoom)
      if (selectedState && loc.uf !== selectedState) {
        return false;
      }

      // Filtro de Região
      if (!selectedState && selectedRegion !== "TODOS" && loc.region !== selectedRegion) {
        return false;
      }

      // Filtro de Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchCity = loc.cidade.toLowerCase().includes(term);
        const matchUf = loc.uf.toLowerCase().includes(term);
        const matchAsos = loc.asos.some(
          (a) =>
            a.colaborador.toLowerCase().includes(term) ||
            a.nomeClinica.toLowerCase().includes(term) ||
            a.numero.includes(term)
        );
        if (!matchCity && !matchUf && !matchAsos) return false;
      }

      // Filtro de Status (se ativo)
      if (selectedStatus) {
        if (selectedStatus === "URGENTE") {
          return loc.hasUrgente;
        }
        return (loc.statusCounts[selectedStatus] || 0) > 0;
      }

      return true;
    });
  }, [allAggregates, selectedState, selectedRegion, searchTerm, selectedStatus]);

  // Nível de Zoom Atual e Fator Óptico
  const zoomFactor = useMemo(() => (800 / viewport.w).toFixed(1), [viewport.w]);

  const zoomLevelName = useMemo(() => {
    if (viewport.w <= 140) return "CIDADE";
    if (viewport.w <= 300) return "ESTADO";
    if (viewport.w <= 550) return "REGIAO";
    return "BRASIL";
  }, [viewport.w]);

  // Fator de escala dinâmica dos Pins para ficarem perfeitos em qualquer zoom
  const pinScale = useMemo(() => {
    return Math.max(0.35, Math.min(1.0, Math.pow(viewport.w / 800, 0.55)));
  }, [viewport.w]);

  // Contadores globais dos status para a legenda
  const globalStatusCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    let urgent = 0;
    asos.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
      if (a.urgencia === "URGENTE") urgent++;
    });
    return { ...counts, URGENTE: urgent };
  }, [asos]);

  // FUNÇÕES DE ZOOM
  const handleZoomToBrasil = () => {
    setViewport({ x: 0, y: 0, w: 800, h: 800 });
    setSelectedRegion("TODOS");
    setSelectedState(null);
  };

  const handleZoomToRegion = (regKey: string) => {
    setSelectedRegion(regKey);
    setSelectedState(null);
    if (regKey === "TODOS") {
      setViewport({ x: 0, y: 0, w: 800, h: 800 });
    } else {
      const vb = REGION_VIEWBOXES[regKey];
      if (vb) {
        setViewport({ x: vb.x, y: vb.y, w: vb.w, h: vb.h });
      }
    }
  };

  const handleZoomToState = (uf: string) => {
    const stateData = getStateViewBox(uf);
    if (stateData) {
      setSelectedState(uf);
      const stateObj = BRAZIL_STATES_PATHS[uf];
      if (stateObj) setSelectedRegion(stateObj.regiao);
      setViewport({ x: stateData.x, y: stateData.y, w: stateData.w, h: stateData.h });

      const firstCityInState = allAggregates.find((a) => a.uf === uf);
      if (firstCityInState) {
        setActiveLocalityKey(firstCityInState.key);
      }

      toast({
        title: `Zoom no Estado: ${stateObj?.nome || uf} (${uf})`,
        description: `Visualizando polos e municípios de ${uf} em alta definição.`,
      });
    }
  };

  const handleZoomToCity = (loc: AvpLocalityAggregate) => {
    setActiveLocalityKey(loc.key);
    if (loc.uf) {
      setSelectedState(loc.uf);
      setSelectedRegion(loc.region);
    }
    const cityVb = getCityViewBox(loc.x, loc.y, 90);
    setViewport({ x: cityVb.x, y: cityVb.y, w: cityVb.w, h: cityVb.h });
    toast({
      title: `Zoom na Cidade: ${loc.cidade} / ${loc.uf}`,
      description: `${loc.totalAsos} solicitação(ões) de ASO nesta comarca.`,
    });
  };

  const handleStepZoom = (direction: "IN" | "OUT") => {
    setViewport((prev) => {
      const factor = direction === "IN" ? 0.7 : 1.42;
      const newW = Math.max(45, Math.min(800, prev.w * factor));
      const newH = Math.max(45, Math.min(800, prev.h * factor));
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      const newX = Math.max(0, Math.min(800 - newW, cx - newW / 2));
      const newY = Math.max(0, Math.min(800 - newH, cy - newH / 2));
      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  // INTERAÇÃO COM RODA DO MOUSE (WHEEL ZOOM)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    setViewport((prev) => {
      const factor = e.deltaY < 0 ? 0.82 : 1.22;
      const newW = Math.max(40, Math.min(800, prev.w * factor));
      const newH = Math.max(40, Math.min(800, prev.h * factor));

      const cursorX = prev.x + relX * prev.w;
      const cursorY = prev.y + relY * prev.h;

      const newX = Math.max(0, Math.min(800 - newW, cursorX - relX * newW));
      const newY = Math.max(0, Math.min(800 - newH, cursorY - relY * newH));

      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  // INTERAÇÃO DE ARRASTAR O MAPA (PAN)
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      vx: viewport.x,
      vy: viewport.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = viewport.w / rect.width;
    const dx = (e.clientX - dragStart.clientX) * scale;
    const dy = (e.clientY - dragStart.clientY) * scale;

    const newX = Math.max(0, Math.min(800 - viewport.w, dragStart.vx - dx));
    const newY = Math.max(0, Math.min(800 - viewport.h, dragStart.vy - dy));

    setViewport((prev) => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // DUPLO CLIQUE PARA APROXIMAR
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    setViewport((prev) => {
      const newW = Math.max(40, prev.w * 0.55);
      const newH = Math.max(40, prev.h * 0.55);
      const ptX = prev.x + relX * prev.w;
      const ptY = prev.y + relY * prev.h;
      const newX = Math.max(0, Math.min(800 - newW, ptX - newW / 2));
      const newY = Math.max(0, Math.min(800 - newH, ptY - newH / 2));
      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  const handleCopyLocalityInfo = (loc: AvpLocalityAggregate) => {
    const clinicInfo = localityClinicsMap.get(loc.key);
    const lines = [
      `*NAI - GRUPO AVP | Telemetria do Polo ${loc.cidade} / ${loc.uf}*`,
      `• Total de ASOs: ${loc.totalAsos}`,
      `• Região: ${loc.region}`,
      `• Urgentes: ${loc.urgentCount}`,
      `• Cobertura de Clínicas: ${clinicInfo?.label || "Não avaliado"}`,
      `• Status: ${Object.entries(loc.statusCounts)
        .map(([st, qtd]) => `${st}: ${qtd}`)
        .join(", ")}`,
      `• Colaboradores:`,
      ...loc.asos.map(
        (a) =>
          `  - Nº ${a.numero} | ${a.colaborador} (${a.tipoExame}) - Status: ${a.status} - Resp: ${a.responsavel}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedText(loc.key);
    toast({
      title: "Resumo Copiado!",
      description: `Telemetria de ${loc.cidade}/${loc.uf} copiada com sucesso.`,
    });
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleCopyCredenciamento = (cidade: string, uf: string) => {
    const msg = generateWhatsAppCredenciamentoMessage(cidade, uf);
    navigator.clipboard.writeText(msg);
    toast({
      title: "Proposta B2B Copiada!",
      description: `Mensagem de credenciamento copiada para envio às clínicas de ${cidade}/${uf}.`,
    });
  };

  const currentViewBoxString = `${viewport.x.toFixed(1)} ${viewport.y.toFixed(1)} ${viewport.w.toFixed(1)} ${viewport.h.toFixed(1)}`;

  return (
    <Card className="border-2 border-slate-800 bg-slate-950 text-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
      {/* CABEÇALHO DO RESUMO EXECUTIVO COM MAPA */}
      <CardHeader className="border-b border-slate-800/80 bg-slate-900/60 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 h-6">
                <Sparkles size={12} className="mr-1 text-emerald-400" /> Resumo Cartográfico NAI 3.8
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 h-6">
                Zoom em 4 Níveis: Brasil • Região • Estado • Cidade
              </Badge>
              <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 h-6">
                {allAggregates.length} Polos Mapeados
              </Badge>
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 h-6">
                Zoom Atual: {zoomFactor}x ({zoomLevelName})
              </Badge>
            </div>

            <CardTitle className="text-xl md:text-2xl font-black font-headline uppercase tracking-tight text-white flex items-center gap-2.5">
              <Activity className="text-cyan-400 size-6 animate-pulse" />
              Centro de Comando Tático Nacional — Zoom Estado & Cidades
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 font-medium max-w-3xl">
              Navegue com scroll wheel, arraste com o mouse ou use os seletores para aproximar a
              nível de cada estado ou cidade da fila AVP.
            </CardDescription>
          </div>

          {/* CONTROLES DE MODO DO MAPA & ZOOM */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {/* TOGGLE ENTRE FILA DE ASOS E RADAR DE CONTINGÊNCIA */}
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl">
              <button
                onClick={() => setMapMode("STATUS")}
                className={cn(
                  "px-3 h-8 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5",
                  mapMode === "STATUS"
                    ? "bg-blue-600 text-white shadow-md font-bold"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Layers size={13} /> Fila de ASOs
              </button>
              <button
                onClick={() => setMapMode("REDUNDANCY")}
                className={cn(
                  "px-3 h-8 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5",
                  mapMode === "REDUNDANCY"
                    ? "bg-amber-600 text-white shadow-md font-bold"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <ShieldAlert size={13} /> Radar Clínicas (2+)
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setMapMode("COST")}
              className="text-slate-900"
            >
              Cores por custo
            </Button>
            <Button size="sm" variant="outline" onClick={downloadKml} className="text-slate-900">
              Baixar KML
            </Button>
            {/* TOGGLE DOS ARCOS DE CONEXÃO TÁTICA */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNetworkArcs(!showNetworkArcs)}
              className={cn(
                "h-10 text-[10px] font-black uppercase tracking-wider rounded-xl border-slate-800 transition-all gap-1.5",
                showNetworkArcs
                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40"
                  : "bg-slate-900 text-slate-500"
              )}
              title="Exibir ou ocultar linhas de fluxo corporativo"
            >
              <Globe size={13} /> {showNetworkArcs ? "Arcos Ativos" : "Arcos Ocultos"}
            </Button>
          </div>
        </div>

        {/* BARRA DE ZOOM A NÍVEL DE ESTADO E CIDADES COM DROPDOWNS E BREADCRUMBS */}
        <div className="pt-4 mt-3 border-t border-slate-800/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* BREADCRUMBS TÁTICOS HIERÁRQUICOS */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={handleZoomToBrasil}
              className={cn(
                "px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1",
                zoomLevelName === "BRASIL"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              🇧🇷 Brasil
            </button>

            <ChevronRight size={13} className="text-slate-600" />

            {/* Região */}
            <button
              onClick={() =>
                handleZoomToRegion(selectedRegion === "TODOS" ? "Nordeste" : selectedRegion)
              }
              className={cn(
                "px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1",
                zoomLevelName === "REGIAO"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              🗺️ {selectedRegion === "TODOS" ? "Regiões" : selectedRegion}
            </button>

            {selectedState && (
              <>
                <ChevronRight size={13} className="text-slate-600" />
                <button
                  onClick={() => handleZoomToState(selectedState)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1",
                    zoomLevelName === "ESTADO"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  📍 Estado: {selectedState} ({ufStats.asosByUf[selectedState] || 0} ASOs)
                </button>
              </>
            )}

            {activeLocality && zoomLevelName === "CIDADE" && (
              <>
                <ChevronRight size={13} className="text-slate-600" />
                <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider px-2 h-6 animate-pulse">
                  🎯 {activeLocality.cidade} / {activeLocality.uf}
                </Badge>
              </>
            )}
          </div>

          {/* SELETORES DIRETOS: DROPDOWN DE ESTADO (UF) E DE CIDADE */}
          <div className="flex flex-wrap items-center gap-2">
            {/* SELETOR DE ESTADO */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                UF:
              </span>
              <select
                value={selectedState || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    handleZoomToState(val);
                  } else {
                    handleZoomToBrasil();
                  }
                }}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-950 text-slate-300">
                  Todos os Estados (27)
                </option>
                {Object.values(BRAZIL_STATES_PATHS)
                  .sort(
                    (a, b) => (ufStats.asosByUf[b.sigla] || 0) - (ufStats.asosByUf[a.sigla] || 0)
                  )
                  .map((st) => (
                    <option key={st.sigla} value={st.sigla} className="bg-slate-950 text-white">
                      {st.sigla} - {st.nome} ({ufStats.asosByUf[st.sigla] || 0} ASOs)
                    </option>
                  ))}
              </select>
            </div>

            {/* SELETOR DE CIDADE (POLO) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Cidade:
              </span>
              <select
                value={activeLocalityKey || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const match = allAggregates.find((a) => a.key === val);
                    if (match) handleZoomToCity(match);
                  }
                }}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer max-w-[160px] truncate"
              >
                <option value="" className="bg-slate-950 text-slate-300">
                  Escolher Cidade...
                </option>
                {allAggregates.map((loc) => (
                  <option key={loc.key} value={loc.key} className="bg-slate-950 text-white">
                    {loc.cidade} / {loc.uf} ({loc.totalAsos})
                  </option>
                ))}
              </select>
            </div>

            {/* BOTÃO RESETAR BRASIL */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleZoomToBrasil}
              className="h-8 px-2.5 text-[10px] font-black uppercase rounded-xl border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Resetar para visão de todo o Brasil"
            >
              <RotateCcw size={12} className="mr-1" /> Resetar
            </Button>
          </div>
        </div>

        {/* BARRA DE LEGENDA INTERATIVA DE CORES DE STATUS */}
        {mapMode === "COST" ? (
          <div className="flex flex-wrap gap-4 pt-4 text-xs text-white">
            <span>🟢 Até R$40</span>
            <span>🔴 Algum custo acima de R$40</span>
            <span>⚪ Sem preço único confirmado</span>
            <span>🔷 Opções para credenciamento</span>
          </div>
        ) : mapMode === "STATUS" ? (
          <div className="pt-4 mt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2 flex items-center gap-1.5">
              <Layers size={13} className="text-primary" /> Cores por Status da Fila:
            </span>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedStatus(null)}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase rounded-lg transition-all",
                selectedStatus === null
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              Todos ({asos.length})
            </Button>

            {Object.entries(ASO_STATUS_CONFIG).map(([statusKey, config]) => {
              const count = globalStatusCounts[statusKey] || 0;
              if (count === 0) return null;
              const isSelected = selectedStatus === statusKey;

              return (
                <button
                  key={statusKey}
                  onClick={() => setSelectedStatus(isSelected ? null : statusKey)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border",
                    isSelected
                      ? "scale-105 shadow-md ring-2 ring-white/40 font-bold"
                      : "opacity-85 hover:opacity-100 hover:scale-102"
                  )}
                  style={{
                    backgroundColor: isSelected ? config.color : `${config.color}20`,
                    color: isSelected ? "#ffffff" : config.color,
                    borderColor: isSelected ? "#ffffff" : `${config.color}60`,
                  }}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: config.color }} />
                  <span>{config.label}</span>
                  <span className="px-1 py-0.2 text-[9px] rounded-md bg-black/30 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="pt-4 mt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2 flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-amber-400" /> Saúde da Rede Credenciada:
            </span>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase">
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              <span>0 Clínicas (Gargalo Crítico de SLA)</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>1 Clínica (Sem Suplente de Contingência)</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>2+ Clínicas (Meta Resiliente Atingida)</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 md:p-8 space-y-6">
        {unmapped.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {unmapped.length} cidades aguardam confirmação geográfica:{" "}
            {unmapped.map((loc) => `${loc.cidade}/${loc.uf}`).join(", ")}. As solicitações continuam
            na fila.
          </div>
        )}
        {/* BUSCA RÁPIDA E CONTROLES DE MACRO-REGIÃO */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <Input
              placeholder="Buscar Município, UF, Colaborador ou Clínica..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl text-xs focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* CONTROLES DE ZOOM REGIONAL */}
          <div className="flex flex-wrap items-center gap-1.5">
            {Object.entries(REGION_VIEWBOXES).map(([regKey, { label }]) => {
              const isSelected =
                selectedRegion === regKey && !selectedState && zoomLevelName !== "CIDADE";
              return (
                <Button
                  key={regKey}
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleZoomToRegion(regKey)}
                  className={cn(
                    "h-8 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all",
                    isSelected
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                      : "border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  {label.split(" ")[0]}
                </Button>
              );
            })}
          </div>
        </div>

        {/* GRID PRINCIPAL: MAPA CARTOGRÁFICO INTERATIVO (ESQ) + PAINEL DE TELEMETRIA LOCAL (DIR) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* MAPA CARTOGRÁFICO VETORIAL INTERATIVO (7 COLUNAS) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 md:p-6 shadow-inner relative overflow-hidden select-none">
            {/* Tag Superior de Telemetria de Zoom & Nível Geográfico */}
            <div className="absolute top-6 left-6 z-10 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800 text-[10px] font-black uppercase text-slate-300 shadow-md">
              <Compass
                size={14}
                className="text-cyan-400 animate-spin"
                style={{ animationDuration: "12s" }}
              />
              <span>Nível: {zoomLevelName}</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-mono font-bold">{zoomFactor}x</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono text-[9px]">
                {filteredLocalities.length} Polos Visíveis
              </span>
            </div>

            {/* BOTÕES FLUTUANTES DE CONTROLE DE ZOOM (+ / - / CENTRO / BRASIL) */}
            <div className="absolute bottom-16 right-6 z-20 flex flex-col items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleStepZoom("IN")}
                className="size-8 p-0 rounded-xl text-white hover:bg-blue-600 transition-colors"
                title="Aproximar Zoom (+)"
              >
                <ZoomIn size={16} />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleStepZoom("OUT")}
                className="size-8 p-0 rounded-xl text-white hover:bg-blue-600 transition-colors"
                title="Afastar Zoom (-)"
              >
                <ZoomOut size={16} />
              </Button>

              <div className="w-5 h-px bg-slate-800 my-0.5" />

              {activeLocality && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleZoomToCity(activeLocality)}
                  className="size-8 p-0 rounded-xl text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  title="Centralizar na Cidade Selecionada"
                >
                  <Crosshair size={16} />
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomToBrasil}
                className="size-8 p-0 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Resetar Zoom para Brasil Completo"
              >
                <Maximize2 size={15} />
              </Button>
            </div>

            {/* BARRA SUPERIOR DIREITA COM NAVEGAÇÃO DE CIDADES VIZINHAS (QUANDO NO ZOOM DE CIDADE) */}
            {zoomLevelName === "CIDADE" && activeLocality && stateSiblings.length > 1 && (
              <div className="absolute top-6 right-6 z-10 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800 text-[10px] font-black uppercase text-slate-300 shadow-md">
                <button
                  onClick={() => {
                    const prevIdx =
                      (siblingIndex - 1 + stateSiblings.length) % stateSiblings.length;
                    handleZoomToCity(stateSiblings[prevIdx]);
                  }}
                  className="p-1 hover:text-cyan-400 transition-colors"
                  title="Cidade anterior deste estado"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-mono text-cyan-400">
                  {siblingIndex + 1}/{stateSiblings.length} em {activeLocality.uf}
                </span>
                <button
                  onClick={() => {
                    const nextIdx = (siblingIndex + 1) % stateSiblings.length;
                    handleZoomToCity(stateSiblings[nextIdx]);
                  }}
                  className="p-1 hover:text-cyan-400 transition-colors"
                  title="Próxima cidade deste estado"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* SVG CARTOGRÁFICO DE ALTA DEFINIÇÃO COM SUPORTE A PAN E WHEEL ZOOM */}
            <div
              className={cn(
                "w-full aspect-square max-h-[640px] mx-auto relative flex items-center justify-center transition-all",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
            >
              <svg
                ref={svgRef}
                viewBox={currentViewBoxString}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                className="w-full h-full select-none"
                style={{ filter: "drop-shadow(0 15px 35px rgba(0,0,0,0.6))" }}
              >
                <defs>
                  {/* Gradiente do Oceano / Malha de Fundo */}
                  <radialGradient id="cyberGlow" cx="50%" cy="50%" r="75%">
                    <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#090d16" stopOpacity="0.95" />
                  </radialGradient>

                  {/* Gradiente para Arcos de Conexão Tática */}
                  <linearGradient id="networkArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#818cf8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.1" />
                  </linearGradient>

                  {/* Filtros de Glow Neon */}
                  <filter id="neonPinGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>

                  <filter id="stateHoverGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Grade Geográfica Cartográfica Tática */}
                <g
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={viewport.w > 300 ? "1" : "0.5"}
                  strokeDasharray="3 3"
                >
                  <line x1="0" y1="119" x2="800" y2="119" />
                  <text
                    x="15"
                    y="115"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    0° Equador
                  </text>

                  <line x1="0" y1="316" x2="800" y2="316" />
                  <text
                    x="15"
                    y="312"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    10°S
                  </text>

                  <line x1="0" y1="514" x2="800" y2="514" />
                  <text
                    x="15"
                    y="510"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    20°S Trópico
                  </text>

                  <line x1="0" y1="711" x2="800" y2="711" />
                  <text
                    x="15"
                    y="707"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    30°S
                  </text>

                  <line x1="286" y1="0" x2="286" y2="800" />
                  <text
                    x="290"
                    y="20"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    60°W
                  </text>

                  <line x1="484" y1="0" x2="484" y2="800" />
                  <text
                    x="488"
                    y="20"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    50°W
                  </text>

                  <line x1="681" y1="0" x2="681" y2="800" />
                  <text
                    x="685"
                    y="20"
                    fill="rgba(255,255,255,0.2)"
                    fontSize={viewport.w > 300 ? "8" : "4"}
                    fontFamily="monospace"
                  >
                    40°W
                  </text>
                </g>

                {/* 1. CAMADA CARTOGRÁFICA OFICIAL DO IBGE: TODOS OS 27 ESTADOS BRASILEIROS */}
                <g id="ibge-brazil-states">
                  {Object.values(BRAZIL_STATES_PATHS).map((state: BrazilStatePath) => {
                    const stateUf = state.sigla;
                    const stateAsos = ufStats.asosByUf[stateUf] || 0;
                    const statePoles = ufStats.polesByUf[stateUf] || 0;
                    const isHovered = hoveredUf === stateUf;
                    const isSelected = selectedState === stateUf;

                    // Heatmap sutil: tonalidade proporcional ao volume de ASOs na UF
                    let stateFill = "rgba(15, 23, 42, 0.75)";
                    if (isSelected) {
                      stateFill = "rgba(59, 130, 246, 0.4)";
                    } else if (stateAsos >= 20) {
                      stateFill = isHovered ? "rgba(37, 99, 235, 0.45)" : "rgba(30, 58, 138, 0.35)";
                    } else if (stateAsos >= 5) {
                      stateFill = isHovered ? "rgba(37, 99, 235, 0.35)" : "rgba(30, 41, 59, 0.45)";
                    } else if (stateAsos > 0) {
                      stateFill = isHovered ? "rgba(59, 130, 246, 0.25)" : "rgba(30, 41, 59, 0.3)";
                    } else if (isHovered) {
                      stateFill = "rgba(71, 85, 105, 0.25)";
                    }

                    const stateStroke = isSelected
                      ? "#38bdf8"
                      : isHovered
                        ? "#67e8f9"
                        : stateAsos > 0
                          ? "rgba(100, 116, 139, 0.6)"
                          : "rgba(51, 65, 85, 0.35)";

                    const strokeWidth =
                      (isSelected ? 2.5 : isHovered ? 2.0 : 1.0) * (viewport.w / 800);

                    return (
                      <path
                        key={stateUf}
                        d={state.path}
                        fill={stateFill}
                        stroke={stateStroke}
                        strokeWidth={Math.max(0.6, strokeWidth)}
                        className="transition-colors duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredUf(stateUf)}
                        onMouseLeave={() => setHoveredUf(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomToState(stateUf);
                        }}
                      >
                        <title>{`${state.nome} (${stateUf}) • ${stateAsos} ASOs • Clique para dar zoom no estado`}</title>
                      </path>
                    );
                  })}
                </g>

                {/* 2. RÓTULOS E CENTROIDES DAS UFs NO MAPA (VISÍVEIS ATÉ O ZOOM REGIONAL/ESTADUAL) */}
                {viewport.w >= 180 && (
                  <g id="state-labels" pointerEvents="none">
                    {Object.values(BRAZIL_STATES_PATHS).map((state: BrazilStatePath) => {
                      const stateAsos = ufStats.asosByUf[state.sigla] || 0;
                      const isHovered = hoveredUf === state.sigla;
                      const isSelected = selectedState === state.sigla;
                      const fontSize = Math.max(
                        5,
                        (stateAsos >= 10 ? 10 : 8.5) * (viewport.w / 800)
                      );

                      return (
                        <g key={`lbl-${state.sigla}`}>
                          <text
                            x={state.centerX}
                            y={state.centerY}
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill={
                              isSelected || isHovered
                                ? "#38bdf8"
                                : stateAsos > 0
                                  ? "rgba(226, 232, 240, 0.8)"
                                  : "rgba(100, 116, 139, 0.35)"
                            }
                            fontSize={fontSize}
                            fontWeight="800"
                            fontFamily="sans-serif"
                          >
                            {state.sigla}
                          </text>

                          {stateAsos > 0 && (
                            <text
                              x={state.centerX}
                              y={state.centerY + fontSize * 0.9}
                              textAnchor="middle"
                              fill={
                                isSelected || isHovered ? "#67e8f9" : "rgba(56, 189, 248, 0.85)"
                              }
                              fontSize={fontSize * 0.75}
                              fontWeight="900"
                              fontFamily="monospace"
                            >
                              {stateAsos}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* 3. ARCOS TÁTICOS DE CONEXÃO OPERACIONAL (SE ATIVOS E EM VISÕES AMPLAS) */}
                {showNetworkArcs && primaryHub && viewport.w >= 250 && (
                  <g id="tactical-network-arcs" pointerEvents="none">
                    {filteredLocalities.map((loc) => {
                      if (loc.key === primaryHub.key) return null;
                      if (loc.totalAsos < 2 && !loc.hasUrgente) return null;

                      const midX = (primaryHub.x + loc.x) / 2;
                      const midY = (primaryHub.y + loc.y) / 2 - 25;

                      return (
                        <path
                          key={`arc-${loc.key}`}
                          d={`M ${primaryHub.x} ${primaryHub.y} Q ${midX} ${midY} ${loc.x} ${loc.y}`}
                          fill="none"
                          stroke="url(#networkArcGrad)"
                          strokeWidth={loc.hasUrgente ? 1.5 : 1.0}
                          strokeDasharray={loc.hasUrgente ? "4 3" : "2 4"}
                          opacity={activeLocality?.key === loc.key ? 0.9 : 0.35}
                        />
                      );
                    })}
                  </g>
                )}

                {/* 4. ELEMENTOS ESPECIAIS DE MIRA HOLOGRÁFICA NO NÍVEL DE CIDADE (ZOOM <= 140) */}
                {zoomLevelName === "CIDADE" && activeLocality && (
                  <g id="city-level-hud" pointerEvents="none">
                    {/* Eixos Cartesianos Pontilhados */}
                    <line
                      x1={viewport.x}
                      y1={activeLocality.y}
                      x2={viewport.x + viewport.w}
                      y2={activeLocality.y}
                      stroke="rgba(56, 189, 248, 0.25)"
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1={activeLocality.x}
                      y1={viewport.y}
                      x2={activeLocality.x}
                      y2={viewport.y + viewport.h}
                      stroke="rgba(56, 189, 248, 0.25)"
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                    />

                    {/* Anel de Escala Holográfico em volta da Cidade Ativa */}
                    <circle
                      cx={activeLocality.x}
                      cy={activeLocality.y}
                      r="16"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.4)"
                      strokeWidth="0.8"
                      strokeDasharray="3 3"
                      className="animate-spin"
                      style={{
                        animationDuration: "10s",
                        transformOrigin: `${activeLocality.x}px ${activeLocality.y}px`,
                      }}
                    />
                    <circle
                      cx={activeLocality.x}
                      cy={activeLocality.y}
                      r="26"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.2)"
                      strokeWidth="0.6"
                      strokeDasharray="5 5"
                    />

                    {/* Indicadores Cardeais */}
                    <text
                      x={activeLocality.x}
                      y={activeLocality.y - 18}
                      textAnchor="middle"
                      fill="rgba(56, 189, 248, 0.7)"
                      fontSize="3.5"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      N
                    </text>
                    <text
                      x={activeLocality.x}
                      y={activeLocality.y + 21}
                      textAnchor="middle"
                      fill="rgba(56, 189, 248, 0.7)"
                      fontSize="3.5"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      S
                    </text>
                    <text
                      x={activeLocality.x + 20}
                      y={activeLocality.y + 1.2}
                      textAnchor="start"
                      fill="rgba(56, 189, 248, 0.7)"
                      fontSize="3.5"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      L
                    </text>
                    <text
                      x={activeLocality.x - 20}
                      y={activeLocality.y + 1.2}
                      textAnchor="end"
                      fill="rgba(56, 189, 248, 0.7)"
                      fontSize="3.5"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      O
                    </text>
                  </g>
                )}

                {/* 5. PINS DOS POLOS MUNICIPAIS VETORIAIS */}
                <g id="locality-pins">
                  {filteredLocalities.map((loc) => {
                    const isActive = activeLocality?.key === loc.key;
                    const clinicData = localityClinicsMap.get(loc.key);

                    // Determina cor do pin dependendo do modo ativo
                    let pinColor = loc.primaryColor;
                    if (mapMode === "REDUNDANCY") {
                      pinColor = clinicData?.color || "#ef4444";
                    }

                    const costs = avpCostSummary(loc.asos);
                    if (mapMode === "COST")
                      pinColor = costs.aboveTarget
                        ? "#ef4444"
                        : costs.missing
                          ? "#64748b"
                          : "#10b981";
                    // Raio proporcional adaptado dinamicamente ao zoom
                    const rawRadius =
                      loc.totalAsos >= 15
                        ? 12
                        : loc.totalAsos >= 8
                          ? 9.5
                          : loc.totalAsos >= 3
                            ? 7.5
                            : 5.5;
                    const baseRadius = Math.max(2.8, rawRadius * pinScale);

                    return (
                      <g
                        key={loc.key}
                        transform={`translate(${loc.x}, ${loc.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoomToCity(loc);
                        }}
                        onMouseEnter={() => setHoveredLocality(loc)}
                        onMouseLeave={() => setHoveredLocality(null)}
                        className="cursor-pointer transition-transform duration-200 group"
                      >
                        {/* ANEL DE PULSO RADAR PARA CASOS URGENTES OU MUNICÍPIOS COM ZERO CLÍNICAS */}
                        {(loc.hasUrgente ||
                          (mapMode === "REDUNDANCY" && clinicData?.status === "CRITICO")) && (
                          <circle
                            r={baseRadius + (viewport.w > 300 ? 8 : 4)}
                            fill="none"
                            stroke={pinColor}
                            strokeWidth={viewport.w > 300 ? "2" : "1"}
                            opacity="0.8"
                            className="animate-ping"
                            style={{ transformOrigin: "center" }}
                          />
                        )}

                        {/* ANEL GIRATÓRIO QUANDO SELECIONADO */}
                        {isActive && (
                          <circle
                            r={baseRadius + (viewport.w > 300 ? 5 : 2.5)}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={viewport.w > 300 ? "2.5" : "1.2"}
                            strokeDasharray="3 3"
                            className="animate-spin"
                            style={{ animationDuration: "8s", transformOrigin: "center" }}
                          />
                        )}

                        {/* PIN PRINCIPAL */}
                        <circle
                          r={baseRadius}
                          fill={pinColor}
                          stroke={isActive ? "#ffffff" : "rgba(15, 23, 42, 0.95)"}
                          strokeWidth={
                            isActive ? Math.max(1.5, 3 * pinScale) : Math.max(1, 1.8 * pinScale)
                          }
                          filter="url(#neonPinGlow)"
                          className={cn(
                            "transition-all duration-200 group-hover:scale-130",
                            isActive && "scale-120"
                          )}
                        />

                        {costs.aboveTarget > 0 && (
                          <g
                            role="button"
                            aria-label={`Opções de clínicas em ${loc.cidade}`}
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleZoomToCity(loc);
                              }
                            }}
                          >
                            <rect
                              x={baseRadius + 5 * pinScale}
                              y={-4 * pinScale}
                              width={8 * pinScale}
                              height={8 * pinScale}
                              fill="#2563eb"
                              stroke="#fff"
                              strokeWidth={Math.max(0.7, pinScale)}
                              transform={`rotate(45 ${baseRadius + 9 * pinScale} 0)`}
                            />
                            <title>Buscar até 3 clínicas e negociar o valor do ASO</title>
                          </g>
                        )}
                        {/* NÚMERO DE ASOs OU SÍMBOLO DENTRO DO PIN */}
                        {loc.totalAsos > 1 ? (
                          <text
                            y={baseRadius * 0.35}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize={Math.max(3, (baseRadius >= 7 ? 8.5 : 6.5) * pinScale)}
                            fontWeight="900"
                            fontFamily="monospace"
                            pointerEvents="none"
                          >
                            {loc.totalAsos}
                          </text>
                        ) : (
                          <circle
                            r={Math.max(1, 1.8 * pinScale)}
                            fill="#ffffff"
                            pointerEvents="none"
                          />
                        )}

                        {/* RÓTULO FLUTUANTE DA CIDADE (SELECIONADO, HOVER OU EM ZOOM DE ESTADO/CIDADE) */}
                        {(isActive ||
                          loc.totalAsos >= 10 ||
                          hoveredLocality?.key === loc.key ||
                          viewport.w <= 160) && (
                          <g
                            transform={`translate(0, ${-(baseRadius + (viewport.w > 300 ? 7 : 4))})`}
                            pointerEvents="none"
                          >
                            <rect
                              x={-Math.max(25, 42 * pinScale)}
                              y={-Math.max(9, 15 * pinScale)}
                              width={Math.max(50, 84 * pinScale)}
                              height={Math.max(10, 17 * pinScale)}
                              rx={Math.max(5, 8.5 * pinScale)}
                              fill="rgba(10, 15, 28, 0.95)"
                              stroke={pinColor}
                              strokeWidth={Math.max(0.6, 1.2 * pinScale)}
                              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
                            />
                            <text
                              y={-Math.max(2.5, 3.5 * pinScale)}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={Math.max(4, 8 * pinScale)}
                              fontWeight="800"
                              fontFamily="sans-serif"
                            >
                              {loc.cidade.length > 12
                                ? `${loc.cidade.slice(0, 11)}...`
                                : loc.cidade}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* HUD FLUTUANTE INFERIOR COM DICAS DE NAVEGAÇÃO E TELEMETRIA */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-medium">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>86 Agendados</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>88 Não Iniciados</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>44 Urgentes</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <Navigation size={11} className="text-cyan-400" />
                Dica: Use a rodinha do mouse ou arraste para navegar pelo mapa
              </span>
            </div>
          </div>

          {/* PAINEL DE TELEMETRIA OPERACIONAL DA LOCALIDADE SELECIONADA (5 COLUNAS) */}
          <div className="lg:col-span-5 space-y-4">
            {activeLocality ? (
              <Card className="border-2 border-slate-800 bg-slate-900/90 text-slate-100 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                {/* Glow decorativo de fundo */}
                <div
                  className="absolute -right-10 -top-10 size-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: activeLocality.primaryColor }}
                />

                {/* TOPO DA CIDADE SELECIONADA */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        className="text-[9px] font-black uppercase px-2 h-5 border-none"
                        style={{
                          backgroundColor: `${activeLocality.primaryColor}25`,
                          color: activeLocality.primaryColor,
                        }}
                      >
                        Polo Regional • {activeLocality.region}
                      </Badge>

                      {activeLocality.hasUrgente && (
                        <Badge className="bg-rose-600 text-white border-none text-[8px] font-black uppercase tracking-wider px-2 h-5 animate-pulse">
                          <AlertTriangle size={10} className="mr-1" /> {activeLocality.urgentCount}{" "}
                          Urgência(s)
                        </Badge>
                      )}

                      {/* STATUS DE CONTINGÊNCIA DA CIDADE */}
                      {(() => {
                        const clinicInfo = localityClinicsMap.get(activeLocality.key);
                        if (!clinicInfo) return null;
                        return (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-black uppercase px-2 h-5 border"
                            style={{
                              backgroundColor: `${clinicInfo.color}15`,
                              color: clinicInfo.color,
                              borderColor: `${clinicInfo.color}50`,
                            }}
                          >
                            {clinicInfo.status === "RESILIENTE" ? (
                              <ShieldCheck size={11} className="mr-1" />
                            ) : (
                              <ShieldAlert size={11} className="mr-1" />
                            )}
                            {clinicInfo.count} Clínica(s)
                          </Badge>
                        );
                      })()}
                    </div>

                    <h3 className="text-xl font-headline font-black uppercase text-white tracking-tight flex items-center gap-2">
                      <MapPin size={18} style={{ color: activeLocality.primaryColor }} />
                      {activeLocality.cidade} / {activeLocality.uf}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Coordenadas: {activeLocality.lat.toFixed(4)}°, {activeLocality.lng.toFixed(4)}
                      °
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black font-mono text-white">
                      {activeLocality.totalAsos}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {activeLocality.totalAsos === 1 ? "Solicitação" : "Solicitações"}
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE ZOOM RÁPIDO PARA ESTA CIDADE OU ESTADO */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleZoomToCity(activeLocality)}
                    className="h-8 text-[10px] font-black uppercase tracking-wider rounded-xl border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 gap-1.5"
                  >
                    <Crosshair size={12} /> Focar nesta Cidade
                  </Button>

                  {activeLocality.uf && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleZoomToState(activeLocality.uf)}
                      className="h-8 text-[10px] font-black uppercase tracking-wider rounded-xl border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 gap-1.5"
                    >
                      <Layers size={12} /> Ver Estado ({activeLocality.uf})
                    </Button>
                  )}
                </div>

                {/* SEÇÃO DE CLÍNICAS E CONTINGÊNCIA OPERACIONAL */}
                <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Building2 size={13} className="text-amber-400" /> Rede de Clínicas no Polo:
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: localityClinicsMap.get(activeLocality.key)?.color }}
                    >
                      {localityClinicsMap.get(activeLocality.key)?.label}
                    </span>
                  </div>

                  {/* BOTÕES DE WHATSAPP DAS CLÍNICAS DO POLO */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeLocalityClinics.map((clinic, idx) =>
                      clinic.whatsappUrl ? (
                        <Button
                          key={idx}
                          asChild
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 text-[11px] gap-1.5 font-bold"
                        >
                          <a href={clinic.whatsappUrl} target="_blank" rel="noopener noreferrer">
                            <MessageSquare size={13} />
                            WhatsApp: {clinic.nome || "Clínica"}
                          </a>
                        </Button>
                      ) : null
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="rounded-xl h-8 text-[11px] gap-1.5 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    >
                      <a
                        href={`https://www.google.com/maps/search/clinica+medicina+do+trabalho+saude+ocupacional+aso+${encodeURIComponent(activeLocality.cidade)}+${encodeURIComponent(activeLocality.uf)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={12} />
                        Buscar no Maps
                      </a>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyCredenciamento(activeLocality.cidade, activeLocality.uf)
                      }
                      className="rounded-xl h-8 text-[11px] gap-1.5 text-amber-400 hover:bg-amber-500/10"
                      title="Copiar mensagem B2B para credenciamento de nova clínica"
                    >
                      <Copy size={12} /> Proposta B2B
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 p-3 text-sm">
                  <strong>Custos por ASO</strong>
                  <p>
                    {avpCostSummary(activeLocality.asos).aboveTarget} acima de R$40 ·{" "}
                    {avpCostSummary(activeLocality.asos).missing} sem cotação única
                  </p>
                  <p>
                    Maior custo:{" "}
                    {avpCostSummary(activeLocality.asos).maximumCostCents === null
                      ? "Não informado"
                      : formatBrlCents(avpCostSummary(activeLocality.asos).maximumCostCents!)}
                  </p>
                </div>
                {avpCostSummary(activeLocality.asos).aboveTarget > 0 && (
                  <AvpClinicAlternatives
                    cidade={activeLocality.asos[0].cidade}
                    uf={activeLocality.uf}
                  />
                )}
                {/* DISTRIBUIÇÃO DE STATUS NA LOCALIDADE */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Layers size={12} className="text-blue-400" /> Distribuição de Exames no Polo:
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(activeLocality.statusCounts).map(([status, count]) => {
                      const cfg = ASO_STATUS_CONFIG[status] || { color: "#94a3b8", label: status };
                      return (
                        <Badge
                          key={status}
                          variant="outline"
                          className="text-[10px] font-bold px-2 py-0.5 border"
                          style={{
                            backgroundColor: `${cfg.color}15`,
                            color: cfg.color,
                            borderColor: `${cfg.color}50`,
                          }}
                        >
                          <span
                            className="size-1.5 rounded-full mr-1"
                            style={{ backgroundColor: cfg.color }}
                          />
                          {status}: <strong>{count}</strong>
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* AÇÕES DE FILTRO RÁPIDO */}
                <div className="flex items-center gap-2 pt-1">
                  {onSelectCityFilter && (
                    <Button
                      onClick={() => onSelectCityFilter(activeLocality.cidade)}
                      className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <Filter size={14} /> Filtrar na Fila Abaixo
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => handleCopyLocalityInfo(activeLocality)}
                    className="h-10 px-3.5 border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl gap-1.5 text-xs font-bold"
                    title="Copiar dados desta cidade"
                  >
                    {copiedText === activeLocality.key ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copiedText === activeLocality.key ? "Copiado!" : "Copiar"}
                  </Button>
                </div>

                {/* LISTAGEM DOS COLABORADORES DA CIDADE */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Users size={12} className="text-emerald-400" /> Colaboradores em{" "}
                      {activeLocality.cidade}:
                    </h4>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {activeLocality.asos.length} registro(s)
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                    {activeLocality.asos.map((aso) => {
                      const cfg = ASO_STATUS_CONFIG[aso.status] || { color: "#94a3b8" };
                      return (
                        <div
                          key={aso.id}
                          className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs hover:border-slate-700 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-slate-400 text-[10px]">
                                  #{aso.numero}
                                </span>
                                <span className="font-bold text-white text-xs truncate max-w-[200px]">
                                  {aso.colaborador}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {aso.tipoExame} • Resp: <strong>{aso.responsavel}</strong>
                              </p>
                            </div>

                            <Badge
                              className="text-[8px] font-black uppercase px-2 h-5 border-none shrink-0"
                              style={{
                                backgroundColor: `${cfg.color}25`,
                                color: cfg.color,
                              }}
                            >
                              {aso.status}
                            </Badge>
                          </div>

                          {/* Detalhes de Clínica & Agendamento */}
                          <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                            {aso.dataAgendada ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 size={11} /> Agendado: {aso.dataAgendada}
                              </span>
                            ) : (
                              <span className="text-amber-400 font-medium flex items-center gap-1">
                                <Clock size={11} /> Pedido: {aso.dataPedido} ({aso.diasParado}d
                                parado)
                              </span>
                            )}

                            {aso.nomeClinica && (
                              <span className="text-slate-300 truncate max-w-[220px]">
                                🏥 {aso.nomeClinica}
                              </span>
                            )}

                            {aso.valorAso && (
                              <span className="font-mono text-emerald-400 font-bold ml-auto">
                                {aso.valorAso}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800">
                Selecione uma localidade no mapa para visualizar a telemetria.
              </div>
            )}

            {/* CARD EXECUTIVO: TOP 5 POLOS POR VOLUME DE ASOS */}
            <Card className="border border-slate-800 bg-slate-900/60 p-5 rounded-3xl space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Building2 size={12} className="text-purple-400" /> Top 5 Polos com Maior Volume de
                ASOs:
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {allAggregates.slice(0, 5).map((topLoc, idx) => (
                  <button
                    key={topLoc.key}
                    onClick={() => handleZoomToCity(topLoc)}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all",
                      activeLocality?.key === topLoc.key
                        ? "bg-blue-600/30 border-blue-500 text-white"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                    )}
                  >
                    <div className="text-[9px] font-black text-slate-500 uppercase">#{idx + 1}</div>
                    <div className="font-bold text-xs truncate mt-0.5">{topLoc.cidade}</div>
                    <div className="text-sm font-black font-mono text-blue-400 mt-1">
                      {topLoc.totalAsos}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
