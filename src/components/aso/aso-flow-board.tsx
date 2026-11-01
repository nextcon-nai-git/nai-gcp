"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Ban,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Columns3,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  FolderOpen,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AvpPeriodicMap } from "@/components/clients/avp-periodic-map";
import { periodicCityKey, type PeriodicPerson } from "@/lib/avp-periodic-control";
import { AVP_PERIODIC_PROGRESS, type PeriodicProgress } from "@/lib/avp-periodic-status";
import {
  ASO_FLOW_STATUSES,
  asoFlowMapStatus,
  type AsoFlowCard,
  type AsoFlowClinic,
  type AsoFlowPreview,
  type AsoFlowPreviewRow,
  type AsoFlowStatus,
} from "@/lib/aso-flow";
import { ASO_FLOW_BATCH_SIZE, ASO_FLOW_TEMPLATE, readAsoFlowFile } from "@/lib/aso-flow-import";
import { cn } from "@/lib/utils";
import { AsoEsocialLink } from "@/components/esocial/aso-esocial-link";

type Capabilities = {
  socGeneration: boolean;
  socHref?: string | null;
  emailSend: boolean;
  clientEmailSend?: boolean;
  emailMonitoring: boolean;
  socPdfReception: boolean;
};
type ListResponse = {
  cards: AsoFlowCard[];
  clinics?: AsoFlowClinic[];
  nextCursor?: string | null;
  capabilities: Capabilities;
};
type FlowCompany = { id: string; name: string; active: boolean };
type Operation =
  | "schedule"
  | "record_soc_kit"
  | "record_kit_delivery"
  | "waiting_aso"
  | "receive_aso"
  | "review_aso"
  | "record_delivery"
  | "cancel"
  | "email"
  | "inbox";
const columns: Array<{ id: string; label: string; statuses: AsoFlowStatus[]; color: string }> = [
  { id: "pending", label: "A preparar", statuses: ["pending"], color: "border-red-500" },
  { id: "scheduled", label: "Agendados", statuses: ["scheduled"], color: "border-green-600" },
  {
    id: "waiting",
    label: "Aguardando ASO",
    statuses: ["kit_sent", "waiting_aso"],
    color: "border-green-600",
  },
  { id: "received", label: "Conferir ASO", statuses: ["received"], color: "border-blue-500" },
  { id: "reviewed", label: "Enviar ao cliente", statuses: ["reviewed"], color: "border-blue-500" },
  { id: "delivered", label: "Encerrados", statuses: ["delivered"], color: "border-blue-500" },
  {
    id: "exception",
    label: "Faltas / cancelados",
    statuses: ["cancelled", "no_show"],
    color: "border-yellow-500",
  },
];
const emptyCapabilities: Capabilities = {
  socGeneration: false,
  emailSend: false,
  emailMonitoring: false,
  socPdfReception: false,
};
const examLabels: Record<string, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  demissional: "Demissional",
  retorno_trabalho: "Retorno",
  mudanca_funcao: "Mudança de risco",
};
const terminal = (card: AsoFlowCard) => ["delivered", "cancelled", "no_show"].includes(card.status);
function nextAction(card: AsoFlowCard): { operation: Operation; label: string } {
  if (card.status === "pending") return { operation: "schedule", label: "Agendar" };
  if (card.status === "received") return { operation: "review_aso", label: "Conferir ASO" };
  if (card.status === "reviewed") return { operation: "email", label: "Enviar ASO" };
  if (card.status === "kit_sent") return { operation: "waiting_aso", label: "Confirmar exame" };
  if (card.status === "waiting_aso") return { operation: "receive_aso", label: "Receber ASO" };
  if (!card.kit) return { operation: "record_soc_kit", label: "Anexar kit SOC" };
  return { operation: "email", label: "Enviar kit" };
}
const shortDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("/") : date;

export function asoFlowMapPeople(cards: AsoFlowCard[]): PeriodicPerson[] {
  return cards.map((card) => ({
    id: card.id,
    name: card.employeeName,
    city: card.city,
    uf: card.state,
    cityKey: periodicCityKey(card.city, card.state),
    unit: card.unit,
    status: ASO_FLOW_STATUSES[card.status],
    progress: asoFlowMapStatus(card),
    asoReceivedAt: card.aso?.receivedAt || "",
    review: "",
    phone: "",
    email: "",
    admission: "",
    classification:
      card.status === "cancelled" || card.status === "no_show" ? "cancelled" : "listed",
    duplicateRows: 0,
    sourceRows: [card.sourceRow],
  }));
}

function downloadBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export default function AsoFlowBoard({ initialCompany = "" }: { initialCompany?: string }) {
  const { user } = useUser();
  return (
    <BoardSession
      key={`${user?.uid || "signed-out"}:${initialCompany}`}
      initialCompany={initialCompany}
    />
  );
}

function BoardSession({ initialCompany }: { initialCompany: string }) {
  const { user } = useUser();
  const active = useRef(true);
  const listVersion = useRef(0);
  const busyRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<AsoFlowCard[]>([]);
  const [directory, setDirectory] = useState<FlowCompany[]>([]);
  const [requiresSelection, setRequiresSelection] = useState(false);
  const [clinics, setClinics] = useState<AsoFlowClinic[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>(emptyCapabilities);
  const [busy, setBusy] = useState(!!user);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState(initialCompany);
  const [city, setCity] = useState("");
  const [progress, setProgress] = useState<PeriodicProgress | "all">("all");
  const [view, setView] = useState<"board" | "map">("board");
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>("schedule");
  const [preview, setPreview] = useState<AsoFlowPreview | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const [batchProgress, setBatchProgress] = useState("");
  const selected = cards.find((card) => card.id === selectedId) || null;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const api = useCallback(
    async (path = "", init?: RequestInit) => {
      if (!user) throw new Error("Entre no NAI para consultar a esteira.");
      const token = await user.getIdToken();
      if (!active.current) throw new Error("Sessão encerrada.");
      const response = await fetch(`/api/aso-flow${path}`, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        if ([401, 403].includes(response.status) && active.current) {
          setCards([]);
          setDirectory([]);
          setClinics([]);
          setSelectedId(null);
          setPreview(null);
          setCapabilities(emptyCapabilities);
        }
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível concluir a ação.");
      }
      return response;
    },
    [user]
  );

  const load = useCallback(async () => {
    const run = ++listVersion.current;
    const catalog: { companies: FlowCompany[]; requiresSelection: boolean } = await (
      await api(
        `/companies${initialCompany ? `?companyId=${encodeURIComponent(initialCompany)}` : ""}`
      )
    ).json();
    if (!active.current || run !== listVersion.current) return;
    if (!Array.isArray(catalog.companies))
      throw new Error("Não foi possível carregar os clientes autorizados.");
    setDirectory(catalog.companies);
    setRequiresSelection(catalog.requiresSelection);
    if (catalog.requiresSelection && !company) {
      setCards([]);
      setClinics([]);
      setSelectedId(null);
      setMessage("Selecione um cliente para abrir os cards da sua carteira.");
      return;
    }
    const allCards: AsoFlowCard[] = [],
      allClinics = new Map<string, AsoFlowClinic>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    let latestCapabilities = emptyCapabilities;
    do {
      const params = new URLSearchParams();
      if (company) params.set("companyId", company);
      if (cursor) params.set("cursor", cursor);
      const result: ListResponse = await (
        await api(params.size ? `?${params.toString()}` : "")
      ).json();
      if (!active.current || run !== listVersion.current) return;
      allCards.push(...result.cards);
      (result.clinics || []).forEach((clinic) => allClinics.set(clinic.id, clinic));
      latestCapabilities = result.capabilities;
      cursor = result.nextCursor || null;
      if (cursor && cursors.has(cursor))
        throw new Error("A consulta repetiu uma página. Atualize a esteira.");
      if (cursor && allCards.length >= 10000) {
        if (company)
          throw new Error(
            "Este cliente excede 10.000 cards. A consulta completa precisa ser reduzida; nenhum resultado parcial foi exibido."
          );
        setRequiresSelection(true);
        setCards([]);
        setClinics([]);
        setMessage(
          "Selecione um cliente para consultar os cards; a carteira completa excede 10.000 solicitações."
        );
        return;
      }
      if (cursor) cursors.add(cursor);
    } while (cursor && active.current);
    if (active.current && run === listVersion.current) {
      setCards(allCards);
      setClinics([...allClinics.values()]);
      setCapabilities(latestCapabilities);
    }
  }, [api, initialCompany, company]);

  async function perform(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    } finally {
      busyRef.current = false;
      if (active.current) {
        setBusy(false);
        setBatchProgress("");
      }
    }
  }
  useEffect(() => {
    if (!user) return;
    busyRef.current = true;
    void (async () => {
      await Promise.resolve();
      if (!active.current) return;
      const pending = load(),
        run = listVersion.current;
      try {
        await pending;
      } catch (e: unknown) {
        if (active.current && run === listVersion.current)
          setError(e instanceof Error ? e.message : "Falha na consulta.");
      } finally {
        if (active.current && run === listVersion.current) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    })();
  }, [user, load]);

  async function inspectFile(file: File) {
    await perform(async () => {
      setPreview(null);
      setSourceName(file.name);
      setPreviewPage(0);
      const rows = await readAsoFlowFile(file);
      const combined: AsoFlowPreview = { rows: [], ready: 0, existing: 0, blocked: 0 };
      const ids = new Set<string>();
      for (let offset = 0; offset < rows.length; offset += ASO_FLOW_BATCH_SIZE) {
        if (!active.current) return;
        setBatchProgress(
          `Conferindo ${Math.min(offset + ASO_FLOW_BATCH_SIZE, rows.length)} de ${rows.length} linhas…`
        );
        const data: { preview: AsoFlowPreview } = await (
          await api("", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "preview",
              rows: rows.slice(offset, offset + ASO_FLOW_BATCH_SIZE),
              sourceName: file.name,
            }),
          })
        ).json();
        for (const item of data.preview.rows) {
          const entry =
            item.id && item.state === "ready" && ids.has(item.id)
              ? {
                  ...item,
                  state: "exists" as const,
                  errors: [...item.errors, "Repetido neste arquivo; será mantido um único card."],
                }
              : item;
          if (item.id && item.state !== "blocked") ids.add(item.id);
          combined.rows.push(entry);
          if (entry.state === "ready") combined.ready++;
          else if (entry.state === "exists") combined.existing++;
          else combined.blocked++;
        }
      }
      if (active.current) setPreview(combined);
    });
  }

  async function importPreview() {
    if (!preview) return;
    const ready = preview.rows.filter((row) => row.state === "ready");
    await perform(async () => {
      let created = 0,
        unchanged = 0;
      const completed = new Set<number>();
      try {
        for (let offset = 0; offset < ready.length; offset += ASO_FLOW_BATCH_SIZE) {
          if (!active.current) return;
          const batch = ready.slice(offset, offset + ASO_FLOW_BATCH_SIZE);
          setBatchProgress(
            `Criando cards: ${Math.min(offset + ASO_FLOW_BATCH_SIZE, ready.length)} de ${ready.length}…`
          );
          const data: { created: number; unchanged: number; cards: AsoFlowCard[] } = await (
            await api("", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "import",
                rows: batch.map((row) => row.row),
                sourceName,
              }),
            })
          ).json();
          if (!active.current) return;
          created += data.created;
          unchanged += data.unchanged;
          batch.forEach((entry) => completed.add(entry.index));
          setCards((old) => {
            const merged = new Map(old.map((card) => [card.id, card]));
            data.cards
              .filter((card) => !initialCompany || card.companyId === initialCompany)
              .forEach((card) => merged.set(card.id, card));
            return [...merged.values()];
          });
        }
        if (active.current)
          setMessage(
            `${created} cards criados; ${unchanged + preview.existing} já existentes. ${preview.blocked} linhas continuam em conferência.`
          );
      } catch (e) {
        throw new Error(
          `${created} cards criados antes da interrupção. Reimporte o arquivo para continuar sem duplicar. ${e instanceof Error ? e.message : "Falha no lote."}`
        );
      } finally {
        if (active.current)
          setPreview((old) =>
            old
              ? {
                  ...old,
                  rows: old.rows.map((entry) =>
                    completed.has(entry.index) ? { ...entry, state: "exists" } : entry
                  ),
                  ready: old.ready - completed.size,
                  existing: old.existing + completed.size,
                }
              : old
          );
      }
    });
  }

  async function mutate(payload: Record<string, unknown>, file?: File) {
    if (!selected) return;
    await perform(async () => {
      const body = { id: selected.id, version: selected.version, ...payload };
      let response: Response;
      if (file) {
        const form = new FormData();
        form.append("metadata", JSON.stringify(body));
        form.append("file", file);
        response = await api("/documents", { method: "POST", body: form });
      } else
        response = await api("", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      const result: { card: AsoFlowCard } = await response.json();
      if (active.current) {
        setCards((old) => old.map((card) => (card.id === result.card.id ? result.card : card)));
        setMessage(
          result.card.status === "delivered"
            ? "Entrega registrada. Card encerrado e mapa atualizado."
            : "Registro salvo. Card e mapa atualizados."
        );
      }
    });
  }
  async function download(card: AsoFlowCard, kind: "kit" | "aso") {
    await perform(async () => {
      const response = await api(`/documents?id=${encodeURIComponent(card.id)}&kind=${kind}`);
      const blob = await response.blob();
      if (active.current) downloadBlob(blob, card[kind]?.fileName || `${kind}.pdf`);
    });
  }
  async function sendMail(kind: "kit" | "aso", recipient: string) {
    if (!selected) return;
    if (kind === "aso" && !capabilities.clientEmailSend) {
      setError("Envio ao cliente desativado.");
      return;
    }
    await perform(async () => {
      let result: { card: AsoFlowCard };
      try {
        result = await (
          await api("/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send",
              id: selected.id,
              version: selected.version,
              kind,
              recipient,
              confirmed: true,
            }),
          })
        ).json();
      } catch (error) {
        await load().catch(() => undefined);
        throw error;
      }
      if (active.current) {
        setCards((old) => old.map((card) => (card.id === result.card.id ? result.card : card)));
        setMessage(
          kind === "aso" ? "ASO enviado ao cliente. Card encerrado." : "Kit enviado à clínica."
        );
      }
    });
  }
  async function reconcileMail(card: AsoFlowCard) {
    await perform(async () => {
      const result: { card: AsoFlowCard; reconciled: boolean; message?: string } = await (
        await api("/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reconcile", id: card.id }),
        })
      ).json();
      if (active.current) {
        setCards((old) => old.map((item) => (item.id === result.card.id ? result.card : item)));
        setMessage(
          result.message ||
            (result.reconciled ? "Confirmação do envio recuperada." : "Envio ainda em conferência.")
        );
      }
    });
  }
  const visible = cards.filter(
    (card) =>
      (!company || card.companyId === company) &&
      (!city || periodicCityKey(card.city, card.state) === city) &&
      (progress === "all" || asoFlowMapStatus(card) === progress) &&
      `${card.employeeName} ${card.companyName} ${card.unit} ${card.city} ${card.clinic?.name || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR"))
  );
  const companies = directory.map(
    (item) => [item.id, `${item.name}${item.active ? "" : " (inativo)"}`] as const
  );
  const cities = [
    ...new Map(
      cards
        .filter((card) => !company || card.companyId === company)
        .map((card) => [periodicCityKey(card.city, card.state), `${card.city}/${card.state}`])
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const mapPeople = useMemo(() => asoFlowMapPeople(visible), [visible]);
  const openCard = (card: AsoFlowCard) => {
    setSelectedId(card.id);
    setOperation(nextAction(card).operation);
    setError("");
    setMessage("");
  };
  const previewRows = preview?.rows.slice(previewPage * 50, (previewPage + 1) * 50) || [];

  return (
    <section className="space-y-5" aria-label="Esteira de ASOs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Esteira de ASOs</h2>
          <p className="text-sm text-muted-foreground">
            {cards.length} solicitações · um card por vínculo e competência
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {initialCompany && (
            <Button asChild variant="ghost">
              <Link href="/health-control?tab=esteira">Todos os clientes</Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => void perform(load)} disabled={busy || !user}>
            <RefreshCw className={cn("mr-2 size-4", busy && "animate-spin")} />
            Atualizar
          </Button>
          <Button onClick={() => fileInput.current?.click()} disabled={busy || !user}>
            <FileSpreadsheet className="mr-2 size-4" />
            Importar planilha
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            aria-label="Planilha de solicitações ASO"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void inspectFile(file);
            }}
          />
          <Button
            variant="ghost"
            onClick={() =>
              downloadBlob(
                new Blob([ASO_FLOW_TEMPLATE], { type: "text/csv;charset=utf-8" }),
                "Modelo_Solicitacoes_ASO.csv"
              )
            }
          >
            <Download className="mr-2 size-4" />
            Modelo
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs" aria-label="Conexões da esteira">
        <span className="rounded-full border px-3 py-1.5">
          SOC · {capabilities.socGeneration ? "geração conectada" : "emissão no portal"}
        </span>
        <span className="rounded-full border px-3 py-1.5">
          E-mail · {capabilities.emailSend ? "envio disponível" : "envio não conectado"}
        </span>
        <span className="rounded-full border px-3 py-1.5">
          Retornos ·{" "}
          {capabilities.emailMonitoring ? "consulta disponível" : "monitor de e-mail não conectado"}
        </span>
      </div>
      {(error || message || batchProgress) && (
        <div
          role={error ? "alert" : "status"}
          className={cn(
            "rounded-xl border p-3 text-sm",
            error ? "border-destructive text-destructive" : "bg-muted/40"
          )}
        >
          {error || batchProgress || message}
        </div>
      )}
      {!user && <p role="status">Entre no NAI para acessar as solicitações autorizadas.</p>}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Buscar na esteira</span>
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Colaborador, cliente ou clínica"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Cliente da esteira"
          className="h-10 max-w-72 rounded-md border bg-background px-3 text-sm"
          value={company}
          disabled={!!initialCompany || busy}
          onChange={(e) => {
            setCompany(e.target.value);
            setBusy(true);
            busyRef.current = true;
            setCity("");
            setSelectedId(null);
            setMessage("");
            setError("");
          }}
        >
          {!initialCompany && (
            <option value="">
              {requiresSelection ? "Selecione um cliente" : "Todos os clientes"}
            </option>
          )}
          {initialCompany && !companies.some(([id]) => id === initialCompany) && (
            <option value={initialCompany}>Cliente selecionado</option>
          )}
          {companies.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Cidade da esteira"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">Todas as cidades</option>
          {cities.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Situação no mapa"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={progress}
          onChange={(e) => setProgress(e.target.value as PeriodicProgress | "all")}
        >
          <option value="all">Todas as situações</option>
          {Object.entries(AVP_PERIODIC_PROGRESS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
        <div className="flex gap-1" role="group" aria-label="Visualização da esteira">
          <Button
            variant={view === "board" ? "default" : "outline"}
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <Columns3 className="mr-2 size-4" />
            Cards
          </Button>
          <Button
            variant={view === "map" ? "default" : "outline"}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            <MapPin className="mr-2 size-4" />
            Mapa
          </Button>
        </div>
      </div>
      {!cards.length && !busy && user && !(requiresSelection && !company) && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <FileSpreadsheet className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">Importe a planilha para criar os cards.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O NAI confere CNPJ, CPF, unidade e competência antes de incluir cada solicitação.
          </p>
        </div>
      )}
      {view === "map" ? (
        <AvpPeriodicMap
          people={mapPeople}
          label="Mapa das solicitações de ASO"
          onSelect={(key, state) => {
            setCity(key);
            setProgress(state);
            setView("board");
          }}
        />
      ) : (
        <div
          className="flex items-start gap-3 overflow-x-auto pb-4"
          aria-label="Quadro de solicitações"
        >
          {columns.map((column) => {
            const entries = visible.filter((card) => column.statuses.includes(card.status));
            const limit = columnLimits[column.id] || 50;
            return (
              <section
                key={column.id}
                className={cn("w-72 shrink-0 rounded-xl border-t-4 bg-muted/40 p-3", column.color)}
                aria-label={column.label}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{column.label}</h3>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs">
                    {entries.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {entries.slice(0, limit).map((card) => (
                    <article key={card.id} className="rounded-xl border bg-card p-3 shadow-sm">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {examLabels[card.examType]} · {card.cycle}
                        </span>
                        <span
                          className="mt-1 size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: AVP_PERIODIC_PROGRESS[asoFlowMapStatus(card)].color,
                          }}
                          aria-label={AVP_PERIODIC_PROGRESS[asoFlowMapStatus(card)].label}
                        />
                      </div>
                      <button
                        className="text-left text-sm font-semibold hover:underline"
                        onClick={() => openCard(card)}
                      >
                        {card.employeeName}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">{card.companyName}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs">
                        <MapPin className="size-3" />
                        {card.city}/{card.state} · {card.unit}
                      </p>
                      {card.appointment && (
                        <p className="mt-3 flex items-center gap-1 text-xs">
                          <CalendarDays className="size-3" />
                          {shortDate(card.appointment.date)} às {card.appointment.time}
                        </p>
                      )}
                      {card.clinic && (
                        <p className="mt-1 text-xs text-muted-foreground">{card.clinic.name}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                        <span className="text-[11px] text-muted-foreground">
                          {card.aso
                            ? "ASO recebido"
                            : card.kit
                              ? "Kit SOC anexado"
                              : "Kit pendente"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={card.status === "reviewed" && !capabilities.clientEmailSend}
                          title={
                            card.status === "reviewed" && !capabilities.clientEmailSend
                              ? "Envio ao cliente desativado"
                              : undefined
                          }
                          onClick={() => openCard(card)}
                        >
                          {terminal(card) ? "Ver histórico" : nextAction(card).label}
                          <ChevronRight className="ml-1 size-3" />
                        </Button>
                      </div>
                    </article>
                  ))}
                  {!entries.length && (
                    <p className="py-4 text-center text-xs text-muted-foreground">Sem cards</p>
                  )}
                  {entries.length > limit && (
                    <div className="space-y-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        {limit} de {entries.length} cards
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          setColumnLimits((old) => ({ ...old, [column.id]: limit + 50 }))
                        }
                      >
                        Mostrar mais 50
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !busy) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Conferir importação</DialogTitle>
            <DialogDescription>
              {sourceName} · {preview?.rows.length || 0} linhas conferidas
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-green-500/10 px-3 py-2">
              {preview?.ready || 0} prontos
            </span>
            <span className="rounded-lg bg-blue-500/10 px-3 py-2">
              {preview?.existing || 0} existentes
            </span>
            <span className="rounded-lg bg-yellow-500/10 px-3 py-2">
              {preview?.blocked || 0} pendentes
            </span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {(batchProgress || message) && (
            <p role="status" className="text-sm">
              {batchProgress || message}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Linha</th>
                  <th className="p-2">Colaborador</th>
                  <th className="p-2">Cliente / local</th>
                  <th className="p-2">Conferência</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((item: AsoFlowPreviewRow) => (
                  <tr key={item.index} className="border-b align-top">
                    <td className="p-2">{item.index}</td>
                    <td className="p-2">
                      {item.row.employeeName || "Nome ausente"}
                      <div className="text-xs text-muted-foreground">
                        {examLabels[item.row.examType] || item.row.examType} · {item.row.cycle}
                      </div>
                    </td>
                    <td className="p-2">
                      {item.companyName || item.row.companyCnpj || "Cliente não identificado"}
                      <div className="text-xs text-muted-foreground">
                        {item.row.unit} · {item.row.city}/{item.row.state}
                      </div>
                    </td>
                    <td className="p-2">
                      <span className={item.state === "blocked" ? "text-amber-600" : ""}>
                        {item.state === "ready"
                          ? "Pronto"
                          : item.state === "exists"
                            ? "Já existente"
                            : "Conferir"}
                      </span>
                      {item.errors.map((reason, index) => (
                        <p key={index} className="mt-1 max-w-md text-xs text-muted-foreground">
                          {reason}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Página anterior da prévia"
                disabled={!previewPage || busy}
                onClick={() => setPreviewPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs">
                {previewPage + 1} / {Math.max(1, Math.ceil((preview?.rows.length || 0) / 50))}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label="Próxima página da prévia"
                disabled={busy || (previewPage + 1) * 50 >= (preview?.rows.length || 0)}
                onClick={() => setPreviewPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button disabled={busy || !preview?.ready} onClick={() => void importPreview()}>
              <Upload className="mr-2 size-4" />
              Criar {preview?.ready || 0} cards prontos
            </Button>
          </div>
          {!!preview?.blocked && (
            <p className="text-xs text-muted-foreground">
              As linhas pendentes ficam fora da importação. Corrija os dados ou os cadastros e
              reimporte; os cards existentes serão preservados.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelectedId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.employeeName}</SheetTitle>
                <SheetDescription>
                  {selected.companyName} · {selected.unit}
                  <br />
                  {selected.city}/{selected.state} · {examLabels[selected.examType]} ·{" "}
                  {selected.cycle}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                  {ASO_FLOW_STATUSES[selected.status]}
                </span>
                {selected.archive && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <FolderOpen className="size-3" />
                    Na pasta do cliente
                  </span>
                )}
              </div>
              {(error || message) && (
                <p
                  role={error ? "alert" : "status"}
                  className={cn("mt-3 rounded-lg border p-3 text-sm", error && "text-destructive")}
                >
                  {error || message}
                </p>
              )}
              <div className="my-5 flex flex-wrap gap-2">
                {capabilities.socHref && (
                  <Button asChild variant="outline" size="sm">
                    <a href={capabilities.socHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 size-4" />
                      Gerar kit no SOC
                    </a>
                  </Button>
                )}
                {selected.kit && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void download(selected, "kit")}
                  >
                    <Download className="mr-2 size-4" />
                    Kit SOC
                  </Button>
                )}
                {selected.aso && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void download(selected, "aso")}
                  >
                    <Download className="mr-2 size-4" />
                    ASO recebido
                  </Button>
                )}
              </div>
              <AsoEsocialLink card={selected} />
              {selected.mailLock && (
                <div role="status" className="mb-4 rounded-xl border border-amber-400 p-3 text-sm">
                  <p>
                    O resultado do envio está em conferência. Verifique antes de tentar outro envio.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => void reconcileMail(selected)}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    Verificar envio
                  </Button>
                </div>
              )}
              {!terminal(selected) && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Ações do card">
                    {(
                      [
                        ["schedule", "Agendamento", CalendarDays],
                        ["record_soc_kit", "Anexar kit SOC", FileUp],
                        ["email", "Enviar e-mail", Send],
                        ["inbox", "Retornos por e-mail", Mail],
                        ["waiting_aso", "Comparecimento", CheckCheck],
                        ["receive_aso", "Receber ASO", Upload],
                        [
                          "review_aso",
                          selected.status === "reviewed" ? "Conferir destinatário" : "Conferir ASO",
                          FileCheck2,
                        ],
                        ["record_kit_delivery", "Envio externo: kit", Mail],
                        ["record_delivery", "Entrega externa", FolderOpen],
                        ["cancel", "Falta / cancelar", Ban],
                      ] as const
                    ).map(([key, label, Icon]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={operation === key ? "default" : "outline"}
                        className="justify-start"
                        disabled={busy || !!selected.mailLock}
                        onClick={() => setOperation(key)}
                      >
                        <Icon className="mr-2 size-4 shrink-0" />
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border p-4">
                    {operation === "inbox" ? (
                      <EmailReturns
                        key={`${selected.id}:${selected.version}`}
                        card={selected}
                        api={api}
                        onCard={(card) =>
                          setCards((old) => old.map((item) => (item.id === card.id ? card : item)))
                        }
                      />
                    ) : (
                      <CardOperation
                        key={`${selected.id}:${selected.version}:${operation}`}
                        card={selected}
                        clinics={clinics}
                        operation={operation}
                        busy={busy || !!selected.mailLock}
                        capabilities={capabilities}
                        onSave={mutate}
                        onSend={sendMail}
                      />
                    )}
                  </div>
                </>
              )}
              <details className="mt-5 rounded-xl border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Histórico · {selected.events.length} registros
                </summary>
                <ol className="mt-3 space-y-3">
                  {selected.events
                    .slice()
                    .reverse()
                    .map((event) => (
                      <li key={event.version} className="border-l-2 pl-3 text-xs">
                        <p className="font-medium">{ASO_FLOW_STATUSES[event.status]}</p>
                        <p className="text-muted-foreground">
                          {new Date(event.at).toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}{" "}
                          · versão {event.version}
                        </p>
                      </li>
                    ))}
                </ol>
                <p className="mt-4 text-xs text-muted-foreground">
                  Origem: {selected.sourceName} · linha {selected.sourceRow}
                </p>
              </details>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CardOperation({
  card,
  clinics,
  operation,
  busy,
  capabilities,
  onSave,
  onSend,
}: {
  card: AsoFlowCard;
  clinics: AsoFlowClinic[];
  operation: Exclude<Operation, "inbox">;
  busy: boolean;
  capabilities: Capabilities;
  onSave: (payload: Record<string, unknown>, file?: File) => Promise<void>;
  onSend: (kind: "kit" | "aso", recipient: string) => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);
  const [documentChecked, setDocumentChecked] = useState(false);
  const [kind, setKind] = useState<"kit" | "aso">(card.status === "reviewed" ? "aso" : "kit");
  const [clientError, setClientError] = useState("");
  const available = clinics.filter((clinic) => clinic.companyIds.includes(card.companyId));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");
    const data = new FormData(event.currentTarget),
      get = (key: string) => String(data.get(key) || "").trim();
    if (operation === "email") {
      await onSend(kind, kind === "kit" ? card.clinic?.email || "" : card.clientEmail);
      return;
    }
    const payload: Record<string, unknown> = { action: operation };
    if (operation === "schedule")
      Object.assign(payload, {
        clinicId: get("clinicId"),
        date: get("date"),
        time: get("time"),
        reference: get("reference"),
      });
    if (operation === "waiting_aso") Object.assign(payload, { attendedDate: get("attendedDate") });
    if (operation === "review_aso")
      Object.assign(payload, { identityConfirmed: checked, documentChecked });
    if (operation === "cancel")
      Object.assign(payload, { outcome: get("outcome"), reason: get("reason") });
    if (operation === "record_delivery" || operation === "record_kit_delivery") {
      const date = new Date(`${get("sentAt")}:00-03:00`);
      if (!Number.isFinite(date.getTime())) {
        setClientError("Informe a data e o horário do envio.");
        return;
      }
      Object.assign(payload, {
        recipient: get("recipient"),
        reference: get("reference"),
        confirmed: checked,
        [operation === "record_delivery" ? "deliveredAt" : "sentAt"]: date.toISOString(),
      });
    }
    if (operation === "receive_aso" || operation === "record_soc_kit") {
      const file = data.get("file");
      if (!(file instanceof File) || !file.size) {
        setClientError("Selecione o PDF correspondente ao card.");
        return;
      }
      Object.assign(payload, { identityConfirmed: checked, reference: get("reference") });
      if (operation === "record_soc_kit")
        Object.assign(payload, { socOrder: get("socOrder"), socCompanyId: get("socCompanyId") });
      else Object.assign(payload, { examDate: get("examDate"), source: get("source") });
      await onSave(payload, file);
      return;
    }
    await onSave(payload);
  }
  const check = (label: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      {label}
    </label>
  );
  const reference = (
    <Field label="Comprovante / referência">
      <Input
        name="reference"
        required
        minLength={3}
        maxLength={500}
        placeholder="Identificador da mensagem, protocolo ou confirmação"
      />
    </Field>
  );
  let disabled = busy;
  let label = "Salvar registro";
  if (
    ["record_soc_kit", "receive_aso", "record_delivery", "record_kit_delivery"].includes(operation)
  )
    disabled ||= !checked;
  if (operation === "review_aso") disabled ||= !checked || !documentChecked || !card.aso;
  if (operation === "record_delivery") disabled ||= card.status !== "reviewed";
  if (operation === "record_kit_delivery") disabled ||= !card.kit || !card.appointment;
  if (operation === "schedule") disabled ||= !available.length;
  if (operation === "email") {
    disabled ||=
      !capabilities.emailSend ||
      !checked ||
      (kind === "aso"
        ? !capabilities.clientEmailSend || card.status !== "reviewed" || !card.clientEmail
        : !card.kit || !card.clinic?.email);
    label = kind === "aso" ? "Enviar ASO e encerrar" : "Enviar kit à clínica";
  }
  if (operation === "record_delivery") label = "Registrar entrega e encerrar";
  if (operation === "review_aso" && card.status === "reviewed")
    label = "Atualizar destinatário e conferência";
  if (operation === "record_soc_kit") label = "Guardar kit nativo do SOC";
  if (operation === "receive_aso") label = "Receber e arquivar ASO";
  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      {operation === "schedule" && (
        <>
          <h3 className="font-semibold">Registrar agendamento confirmado</h3>
          <Field label="Clínica">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              name="clinicId"
              defaultValue={card.clinic?.id || ""}
              required
            >
              <option value="">Selecione a clínica</option>
              {available.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </Field>
          {!available.length && (
            <p className="text-sm text-amber-600">
              Vincule uma clínica ativa a este cliente no cadastro de prestadores.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data confirmada">
              <Input name="date" type="date" required defaultValue={card.appointment?.date} />
            </Field>
            <Field label="Horário de Brasília">
              <Input name="time" type="time" required defaultValue={card.appointment?.time} />
            </Field>
          </div>
          {reference}
          <p className="text-xs text-muted-foreground">
            Registre a confirmação da clínica. Salvar a data não envia uma solicitação de agenda.
          </p>
        </>
      )}
      {operation === "record_soc_kit" && (
        <>
          <h3 className="font-semibold">Anexar kit emitido no SOC</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pedido SOC">
              <Input
                name="socOrder"
                inputMode="numeric"
                required
                pattern="[0-9]{1,40}"
                maxLength={40}
              />
            </Field>
            <Field label="Código da empresa SOC">
              <Input
                name="socCompanyId"
                inputMode="numeric"
                required
                pattern="[0-9]{1,20}"
                maxLength={20}
              />
            </Field>
          </div>
          <Field label="PDF original do kit">
            <Input name="file" type="file" accept="application/pdf,.pdf" required />
          </Field>
          {reference}
          {check("Conferi o pedido nativo, o CNPJ e o CPF no SOC e no PDF.")}
          <p className="text-xs text-muted-foreground">
            A emissão é feita dentro do SOC. O PDF anexado ficará vinculado a este atendimento.
          </p>
        </>
      )}
      {operation === "waiting_aso" && (
        <>
          <h3 className="font-semibold">Confirmar comparecimento</h3>
          <Field label="Data do exame realizado">
            <Input name="attendedDate" type="date" required defaultValue={card.appointment?.date} />
          </Field>
          <p className="text-xs text-muted-foreground">
            O card permanecerá aberto até receber e conferir o ASO.
          </p>
        </>
      )}
      {operation === "receive_aso" && (
        <>
          <h3 className="font-semibold">Receber ASO</h3>
          <Field label="Origem">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" name="source">
              <option value="email">E-mail</option>
              <option value="soc">SOC</option>
              <option value="upload">Arquivo recebido</option>
            </select>
          </Field>
          <Field label="Data do exame no ASO">
            <Input name="examDate" type="date" required />
          </Field>
          <Field label="PDF do ASO recebido">
            <Input name="file" type="file" accept="application/pdf,.pdf" required />
          </Field>
          {reference}
          {check("Conferi o CNPJ do cliente e o CPF do colaborador no documento.")}
          <p className="text-xs text-muted-foreground">
            O ASO será arquivado na pasta do cliente e seguirá para conferência antes da entrega.
          </p>
        </>
      )}
      {operation === "review_aso" && (
        <>
          <h3 className="font-semibold">
            {card.status === "reviewed" ? "Conferir destinatário" : "Conferir ASO recebido"}
          </h3>
          {card.status === "reviewed" && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p>Destinatário registrado: {card.clientEmail || "Ainda não informado"}</p>
              <p className="mt-1 text-xs">
                Ao confirmar, o NAI consulta novamente o e-mail do cadastro do cliente.
              </p>
            </div>
          )}
          {!card.aso && (
            <p className="text-sm text-amber-600">Receba o PDF do ASO antes desta etapa.</p>
          )}
          {check("Conferi a identificação do cliente, do colaborador e a data do exame.")}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={documentChecked}
              onChange={(e) => setDocumentChecked(e.target.checked)}
            />
            Conferi o ASO original, assinatura, legibilidade e versão a entregar.
          </label>
          <p className="text-xs text-muted-foreground">
            Esta conferência documental não substitui a responsabilidade do médico emissor.
          </p>
        </>
      )}
      {(operation === "record_delivery" || operation === "record_kit_delivery") && (
        <>
          <h3 className="font-semibold">
            {operation === "record_delivery"
              ? "Registrar entrega já realizada"
              : "Registrar envio externo do kit"}
          </h3>
          <Field label="Destinatário">
            <Input
              name="recipient"
              type="email"
              required
              readOnly
              value={operation === "record_delivery" ? card.clientEmail : card.clinic?.email || ""}
            />
          </Field>
          <Field label="Data e hora do envio (Brasília)">
            <Input name="sentAt" type="datetime-local" required />
          </Field>
          {reference}
          {check(
            "O envio deste PDF ao destinatário indicado já foi realizado e o comprovante corresponde a ele."
          )}
          <p className="text-xs text-muted-foreground">
            Este botão registra um envio externo; não envia e-mail.
          </p>
          {operation === "record_delivery" && card.status !== "reviewed" && (
            <p className="text-sm text-amber-600">
              Conclua a conferência do ASO antes de registrar a entrega.
            </p>
          )}
        </>
      )}
      {operation === "cancel" && (
        <>
          <h3 className="font-semibold">Registrar ocorrência</h3>
          <Field label="Ocorrência">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" name="outcome">
              <option value="no_show">Não compareceu</option>
              <option value="cancelled">Cancelamento</option>
            </select>
          </Field>
          <Field label="Motivo e referência">
            <Input name="reason" required minLength={3} maxLength={1000} />
          </Field>
        </>
      )}
      {operation === "email" && (
        <>
          <h3 className="font-semibold">Enviar e-mail</h3>
          <Field label="Documento">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as "kit" | "aso");
                setChecked(false);
              }}
            >
              <option value="kit">Kit nativo SOC → clínica</option>
              <option value="aso">ASO conferido → cliente</option>
            </select>
          </Field>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p>
              Para:{" "}
              <strong>
                {(kind === "kit" ? card.clinic?.email : card.clientEmail) ||
                  "Destinatário ainda não cadastrado"}
              </strong>
            </p>
            <p className="mt-1 text-xs">
              Anexo: {card[kind]?.fileName || "Documento ainda não recebido"}
            </p>
          </div>
          {check("Revisei o documento e autorizo o envio ao destinatário acima.")}
          {!capabilities.emailSend && (
            <p className="flex items-start gap-2 text-sm text-amber-600">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />A conexão de e-mail ainda não está
              configurada no NAI.
            </p>
          )}
          {kind === "aso" && !capabilities.clientEmailSend && (
            <p className="text-sm text-amber-600">Envio ao cliente desativado.</p>
          )}
          {kind === "aso" && card.status !== "reviewed" && (
            <p className="text-sm text-amber-600">
              Confira o ASO recebido antes de enviar ao cliente.
            </p>
          )}
        </>
      )}
      {clientError && (
        <p role="alert" className="text-sm text-destructive">
          {clientError}
        </p>
      )}
      <Button type="submit" disabled={disabled} className="w-full">
        {busy ? (
          <RefreshCw className="mr-2 size-4 animate-spin" />
        ) : (
          <CheckCheck className="mr-2 size-4" />
        )}
        {label}
      </Button>
    </form>
  );
}

type EmailCandidate = {
  id: string;
  fileName: string;
  from: string;
  subject: string;
  receivedAt: string;
};
type EmailInbox = {
  status: { configured: boolean; mailbox?: string; monitoringConfigured: boolean; reason?: string };
  candidates: EmailCandidate[];
  truncated: boolean;
  nextCursor?: string | null;
};
function EmailReturns({
  card,
  api,
  onCard,
}: {
  card: AsoFlowCard;
  api: (path?: string, init?: RequestInit) => Promise<Response>;
  onCard: (card: AsoFlowCard) => void;
}) {
  const active = useRef(true),
    running = useRef(false);
  const requestVersion = useRef(0);
  const [inbox, setInbox] = useState<EmailInbox | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [identity, setIdentity] = useState(false);
  const [documentChecked, setDocumentChecked] = useState(false);
  const [examDate, setExamDate] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const load = useCallback(
    async (start: string | null = null, append = false) => {
      const run = ++requestVersion.current;
      const candidates: EmailCandidate[] = [];
      const seen = new Set<string>();
      let cursor = start,
        result: EmailInbox | null = null,
        pages = 0;
      do {
        result = (await (
          await api(
            `/email?id=${encodeURIComponent(card.id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
          )
        ).json()) as EmailInbox;
        if (!active.current || run !== requestVersion.current) return;
        candidates.push(...result.candidates);
        cursor = result.nextCursor || null;
        if (cursor && seen.has(cursor))
          throw new Error("A consulta de retornos repetiu uma página. Atualize a lista.");
        if (cursor) seen.add(cursor);
        pages++;
      } while (cursor && candidates.length < 500 && pages < 10);
      const last = result;
      if (active.current && run === requestVersion.current && last)
        setInbox((old) => ({
          ...last,
          nextCursor: cursor,
          truncated: !!cursor || last.truncated,
          candidates: [
            ...new Map(
              [...(append ? old?.candidates || [] : []), ...candidates].map((candidate) => [
                candidate.id,
                candidate,
              ])
            ).values(),
          ],
        }));
    },
    [api, card.id]
  );
  useEffect(() => {
    load().catch((error: unknown) => {
      if (active.current)
        setError(error instanceof Error ? error.message : "Falha ao consultar retornos.");
    });
  }, [load]);
  async function perform(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (error) {
      if (active.current)
        setError(error instanceof Error ? error.message : "Falha na consulta de e-mail.");
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function sync() {
    await perform(async () => {
      const data: {
        result: { saved: number; skipped: number; examined: number; hasMore: boolean };
      } = await (
        await api("/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", id: card.id }),
        })
      ).json();
      await load();
      if (active.current)
        setMessage(
          `${data.result.saved} anexos novos, ${data.result.examined} mensagens consultadas.${data.result.hasMore ? " Há mais resultados; repita a consulta." : ""}`
        );
    });
  }
  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const result: { card: AsoFlowCard } = await (
        await api("/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "receive",
            id: card.id,
            version: card.version,
            candidateId: selected,
            examDate,
            identityConfirmed: identity,
            documentChecked,
          }),
        })
      ).json();
      if (active.current) onCard(result.card);
    });
  }
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Retornos por e-mail</h3>
      <p className="text-xs text-muted-foreground">
        Anexos vinculados a este card precisam de conferência antes de serem recebidos como ASO.
      </p>
      {inbox && (
        <p className="text-sm">
          {inbox.status.monitoringConfigured
            ? `Caixa configurada: ${inbox.status.mailbox || "NEXTCON"}`
            : inbox.status.reason || "Consulta de e-mail ainda não configurada."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void perform(load)}>
          <RefreshCw className="mr-2 size-4" />
          Atualizar lista
        </Button>
        <Button
          size="sm"
          disabled={busy || !inbox?.status.monitoringConfigured || !!card.mailLock}
          onClick={() => void sync()}
        >
          <Mail className="mr-2 size-4" />
          Buscar novos anexos
        </Button>
      </div>
      {(error || message) && (
        <p role={error ? "alert" : "status"} className={cn("text-sm", error && "text-destructive")}>
          {error || message}
        </p>
      )}
      {inbox?.candidates.map((candidate) => (
        <div key={candidate.id} className="rounded-lg border p-3 text-sm">
          <label className="flex gap-2">
            <input
              type="radio"
              name="aso-candidate"
              value={candidate.id}
              checked={selected === candidate.id}
              onChange={() => {
                setSelected(candidate.id);
                setIdentity(false);
                setDocumentChecked(false);
              }}
            />
            <span>
              <strong>{candidate.fileName}</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {candidate.from} · {candidate.subject}
              </span>
            </span>
          </label>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const response = await api(
                  `/email?id=${encodeURIComponent(card.id)}&download=${encodeURIComponent(candidate.id)}`
                );
                const blob = await response.blob();
                if (active.current) downloadBlob(blob, candidate.fileName);
              })
            }
          >
            <Download className="mr-2 size-4" />
            Conferir anexo
          </Button>
        </div>
      ))}
      {inbox && !inbox.candidates.length && !inbox.nextCursor && (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo aguardando conferência neste card.
        </p>
      )}
      {inbox?.nextCursor && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void perform(() => load(inbox.nextCursor || null, true))}
        >
          Carregar mais retornos
        </Button>
      )}
      {inbox?.truncated && (
        <p className="text-xs text-amber-600">
          Há mais registros de e-mail para consultar. Continue para conferir todos os retornos.
        </p>
      )}
      {selected && (
        <form className="space-y-3 border-t pt-4" onSubmit={(event) => void receive(event)}>
          <Field label="Data do exame no ASO">
            <Input
              type="date"
              required
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={identity}
              onChange={(e) => setIdentity(e.target.checked)}
            />
            Conferi o CNPJ do cliente e o CPF do colaborador no anexo.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={documentChecked}
              onChange={(e) => setDocumentChecked(e.target.checked)}
            />
            O anexo é o ASO deste atendimento; conferi a data, assinatura e legibilidade.
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={busy || !identity || !documentChecked || !examDate || !!card.mailLock}
          >
            <FolderOpen className="mr-2 size-4" />
            Receber ASO e arquivar
          </Button>
        </form>
      )}
    </div>
  );
}
