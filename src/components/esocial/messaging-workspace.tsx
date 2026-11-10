"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Ban,
  CheckCheck,
  Download,
  FileCode2,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
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
import { ESOCIAL_EVENT_FORMS, type EsocialFormField } from "@/lib/esocial-events";
import {
  type EsocialCertificateStatus,
  type EsocialMessageEvent,
  type EsocialMessagingCapabilities,
  type EsocialMessagingWorkspace as WorkspaceData,
} from "@/lib/esocial-messaging";
import { EventForm, valueAt } from "./event-form";
import { EventStatus } from "./event-status";
import { CertificateSettings, GrantSettings } from "./messaging-settings";
import { PayrollLinkSettings, type PayrollDirectory } from "./payroll-link-settings";
import { displayDate, errorMessage, jsonRequest, type MessagingApi } from "./messaging-api";

type Company = { id: string; name: string; active: boolean };
type Editor = {
  event?: EsocialMessageEvent;
  payload?: Record<string, unknown>;
  sourceReference?: string;
  asoCardId?: string;
  sourceDocumentHash?: string;
};
type Action = "authorize" | "transmit" | "query" | "recover" | "rectify" | "exclude" | "cancel";

export default function EsocialMessagingWorkspace({
  initialCompany = "",
  initialAso = "",
}: {
  initialCompany?: string;
  initialAso?: string;
}) {
  const { user } = useUser();
  return (
    <MessagingSession
      key={`${user?.uid || "signed-out"}:${initialCompany}:${initialAso}`}
      initialCompany={initialCompany}
      initialAso={initialAso}
    />
  );
}

function MessagingSession({
  initialCompany,
  initialAso,
}: {
  initialCompany: string;
  initialAso: string;
}) {
  const { user } = useUser();
  const active = useRef(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState(initialCompany);
  const [certificate, setCertificate] = useState<EsocialCertificateStatus | null>(null);
  const [canManageCertificate, setCanManageCertificate] = useState(false);
  const [certificateEpoch, setCertificateEpoch] = useState(0);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const api = useMemo<MessagingApi>(() => {
    async function response(path: string, init?: RequestInit) {
      if (!user) throw new Error("Entre no NAI para acessar a mensageria.");
      const token = await user.getIdToken();
      if (!active.current) throw new Error("Sessão encerrada.");
      const result = await fetch(`/api/esocial${path}`, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      });
      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        if ([401, 403].includes(result.status) && active.current) {
          setDenied(true);
          setCompanies([]);
          setCertificate(null);
        }
        throw new Error(body.error || "Não foi possível concluir a ação.");
      }
      return result;
    }
    return {
      request: async <T,>(path: string, init?: RequestInit) =>
        (await response(path, init)).json() as Promise<T>,
      download: async (path: string, fileName: string) => {
        const result = await response(path);
        const blob = await result.blob();
        if (!active.current) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
    };
  }, [user]);
  const refreshCertificate = useCallback(async () => {
    const result = await api.request<{ certificate: EsocialCertificateStatus; canManage: boolean }>(
      "/certificates"
    );
    if (active.current) {
      setCertificate(result.certificate);
      setCanManageCertificate(result.canManage);
      setCertificateEpoch((current) => current + 1);
    }
  }, [api]);
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const results = await Promise.allSettled([
        api.request<{ companies: Company[] }>("/messaging/companies"),
        api.request<{ certificate: EsocialCertificateStatus; canManage: boolean }>("/certificates"),
      ]);
      if (!active.current) return;
      const [directory, certificateResult] = results;
      if (directory.status === "fulfilled") {
        setCompanies(directory.value.companies);
        if (!initialCompany && directory.value.companies.length === 1)
          setCompanyId(directory.value.companies[0].id);
        if (
          initialCompany &&
          !directory.value.companies.some((company) => company.id === initialCompany)
        )
          setError("Este cliente não está disponível na sua carteira autorizada.");
      } else setError(errorMessage(directory.reason));
      if (certificateResult.status === "fulfilled") {
        setCertificate(certificateResult.value.certificate);
        setCanManageCertificate(certificateResult.value.canManage);
      } else setError(errorMessage(certificateResult.reason));
      setLoading(false);
    })();
  }, [api, user, initialCompany]);
  const selectedCompany = companies.find((company) => company.id === companyId);
  return (
    <section className="space-y-5 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mensageria eSocial</h1>
          <p className="mt-1 text-sm text-slate-600">
            Prepare, confira e acompanhe eventos por cliente.
          </p>
        </div>
        <Link href="/health-control?tab=esteira" className="text-sm text-teal-700 underline">
          Esteira de ASOs
        </Link>
      </header>
      <p className="rounded-lg border bg-white px-4 py-3 text-sm text-slate-600">
        Envio de e-mail aos clientes desativado. O acompanhamento ocorre neste painel.
      </p>
      {!user ? (
        <p role="status">Entre na sua conta para acessar a mensageria.</p>
      ) : denied ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Acesso à mensageria não autorizado para esta sessão. Os dados foram removidos da tela.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Carregando acesso e configuração…
            </p>
          ) : (
            <>
              {certificate && (
                <CertificateSettings
                  certificate={certificate}
                  canManage={canManageCertificate}
                  api={api}
                  onChanged={refreshCertificate}
                />
              )}
              <label className="block max-w-xl space-y-1 text-sm font-medium">
                Cliente
                <select
                  aria-label="Cliente da mensageria"
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={companyId}
                  onChange={(event) => {
                    setCompanyId(event.target.value);
                    setError("");
                  }}
                >
                  <option value="">Selecione um cliente</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                      {company.active ? "" : " · Inativo"}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCompany ? (
                <CompanyWorkspace
                  key={selectedCompany.id}
                  company={selectedCompany}
                  initialAso={companyId === initialCompany ? initialAso : ""}
                  certificateEpoch={certificateEpoch}
                  api={api}
                />
              ) : (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-600">
                  {companies.length
                    ? "Selecione um cliente para preparar e consultar eventos."
                    : "Nenhum cliente autorizado disponível."}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function CompanyWorkspace({
  company,
  initialAso,
  certificateEpoch,
  api,
}: {
  company: Company;
  initialAso: string;
  certificateEpoch: number;
  api: MessagingApi;
}) {
  const active = useRef(true);
  const busyRef = useRef(false);
  const loadVersion = useRef(0);
  const suggested = useRef(false);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [payroll, setPayroll] = useState<PayrollDirectory>({ employees: [] });
  const [payrollError, setPayrollError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<EsocialMessageEvent | null>(null);
  const [unconfirmedId, setUnconfirmedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const load = useCallback(
    async (cursor?: string) => {
      const run = ++loadVersion.current;
      const params = new URLSearchParams({ companyId: company.id });
      if (cursor) params.set("cursor", cursor);
      const result = await api.request<WorkspaceData>(`/messaging?${params}`);
      if (active.current && run === loadVersion.current)
        setWorkspace((current) => ({
          ...result,
          events:
            cursor && current
              ? [
                  ...new Map(
                    [...current.events, ...result.events].map((event) => [event.id, event])
                  ).values(),
                ]
              : result.events,
        }));
    },
    [api, company.id]
  );
  const loadPayroll = useCallback(async () => {
    try {
      const result = await api.request<PayrollDirectory>(
        `/links?companyId=${encodeURIComponent(company.id)}`
      );
      if (active.current) {
        setPayroll(result);
        setPayrollError("");
      }
    } catch (failure) {
      if (active.current) {
        setPayroll({ employees: [] });
        setPayrollError(errorMessage(failure));
      }
    }
  }, [api, company.id]);
  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      if (active.current) await loadPayroll();
    })();
  }, [loadPayroll]);
  const loadSuggestion = useCallback(async () => {
    if (!initialAso) return;
    const result = await api.request<{
      suggestion: {
        payload: Record<string, unknown>;
        sourceReference: string;
        sourceDocumentHash?: string;
        asoCardId: string;
        missingFields?: string[];
      };
    }>(`/messaging?${new URLSearchParams({ companyId: company.id, asoCaseId: initialAso })}`);
    if (!active.current) return;
    suggested.current = true;
    setEditor(result.suggestion);
    setMessage(
      "Dados disponíveis do ASO carregados. Complete e confira os campos antes de gerar a prévia."
    );
  }, [api, company.id, initialAso]);
  useEffect(() => {
    void (async () => {
      try {
        await load();
        if (!active.current || !initialAso || suggested.current) return;
        await loadSuggestion();
      } catch (failure) {
        if (active.current) setError(errorMessage(failure));
      }
    })();
  }, [initialAso, load, loadSuggestion, certificateEpoch]);
  async function perform(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (failure) {
      if (active.current) setError(errorMessage(failure));
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  }
  function receive(event: EsocialMessageEvent) {
    if (!active.current) return;
    setWorkspace((current) =>
      current
        ? { ...current, events: [event, ...current.events.filter((item) => item.id !== event.id)] }
        : current
    );
    setSelected(event);
    setUnconfirmedId(null);
  }
  async function save(payload: Record<string, unknown>, sourceReference: string) {
    await perform(async () => {
      const result = await api.request<{ event: EsocialMessageEvent }>(
        "/messaging",
        jsonRequest(
          editor?.event
            ? {
                action: "update",
                id: editor.event.id,
                version: editor.event.version,
                payload,
                sourceReference,
              }
            : {
                action: "prepare",
                companyId: company.id,
                payload,
                sourceReference,
                asoCardId: editor?.asoCardId,
                sourceDocumentHash: editor?.sourceDocumentHash,
              }
        )
      );
      if (!active.current) return;
      receive(result.event);
      setEditor(null);
      setMessage("Prévia salva. Confira os dados para aprovar o evento.");
    });
  }
  async function action(event: EsocialMessageEvent, type: Action) {
    await perform(async () => {
      let result: { event: EsocialMessageEvent };
      try {
        result = await api.request<{ event: EsocialMessageEvent }>(
          "/messaging",
          jsonRequest({
            action: type,
            id: event.id,
            version: event.version,
            ...(type === "authorize"
              ? { identityConfirmed: true, documentChecked: true }
              : { confirmed: true }),
          })
        );
      } catch (failure) {
        if (active.current && ["transmit", "recover"].includes(type)) setUnconfirmedId(event.id);
        try {
          const latest = await api.request<{ event: EsocialMessageEvent }>(
            `/messaging?id=${encodeURIComponent(event.id)}`
          );
          if (active.current) receive(latest.event);
          await load();
        } catch {
          /* Keep the operation blocked until a fresh server state can be read. */
        }
        throw failure;
      }
      if (!active.current) return;
      setUnconfirmedId(null);
      receive(result.event);
      if (type === "rectify" || type === "exclude") {
        const details = await api.request<{ event: EsocialMessageEvent }>(
          `/messaging?id=${encodeURIComponent(result.event.id)}`
        );
        if (active.current) {
          setEditor({
            event: details.event,
            payload: details.event.payload,
            sourceReference: details.event.sourceReference,
          });
          setSelected(null);
        }
      }
      await load();
    });
  }
  async function openEvent(event: EsocialMessageEvent, edit = false) {
    await perform(async () => {
      const result = await api.request<{ event: EsocialMessageEvent }>(
        `/messaging?id=${encodeURIComponent(event.id)}`
      );
      if (!active.current) return;
      if (edit) {
        setEditor({
          event: result.event,
          payload: result.event.payload,
          sourceReference: result.event.sourceReference,
        });
        setSelected(null);
      } else setSelected(result.event);
      setUnconfirmedId(null);
    });
  }
  if (!workspace)
    return (
      <p role={error ? "alert" : "status"} className="rounded-lg border p-4 text-sm">
        {error || "Carregando eventos do cliente…"}
      </p>
    );
  const capabilities = workspace.capabilities;
  return (
    <div className="space-y-5">
      <GrantSettings
        key={`${company.id}:${capabilities.grant?.confirmedAt || "empty"}`}
        companyId={company.id}
        grant={capabilities.grant}
        registration={capabilities.certificate.registration}
        canManage={capabilities.canManageGrants}
        api={api}
        onChanged={load}
      />
      <PayrollLinkSettings
        companyId={company.id}
        employees={payroll.employees}
        api={api}
        onChanged={loadPayroll}
      />
      {payrollError && (
        <p role="alert" className="text-sm text-amber-900">
          Vínculos da folha: {payrollError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{company.name}</h2>
          <p className="text-xs text-slate-500">
            {capabilities.monitorConfigured
              ? "Consulta periódica configurada"
              : "Consulta manual disponível"}{" "}
            · Produção{" "}
            {capabilities.productionEnabled
              ? "habilitada para eventos homologados"
              : "pendente de homologação"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {initialAso && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !!editor}
              onClick={() => void perform(loadSuggestion)}
            >
              Carregar dados do ASO
            </Button>
          )}
          <Button
            size="sm"
            disabled={busy || !company.active}
            onClick={() => {
              setEditor({});
              setSelected(null);
              setError("");
              setMessage("");
            }}
          >
            <Plus className="mr-2 size-4" />
            Preparar evento
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !company.active}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-2 size-4" />
            Importar XML
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform(load)}>
            <RefreshCw className="mr-2 size-4" />
            Atualizar
          </Button>
          {capabilities.canManageCertificates && !capabilities.productionEnabled && (
            <Button
              size="sm"
              variant="outline"
              disabled={
                busy ||
                !capabilities.productionEligibleTypes.length ||
                !capabilities.certificate.localValid
              }
              onClick={() => setProductionOpen(true)}
            >
              Habilitar produção
            </Button>
          )}
        </div>
      </div>
      {!capabilities.certificate.configured || !capabilities.certificate.localValid ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          A1 pendente. Você pode preparar e aprovar eventos; a transmissão aguarda um certificado
          válido.
        </p>
      ) : null}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}
      {editor ? (
        <div className="rounded-xl border bg-white p-4 sm:p-5">
          <h3 className="mb-4 font-semibold">
            {editor.event ? "Editar evento" : "Preparar evento"}
          </h3>
          <EventForm
            key={
              editor.event
                ? `${editor.event.id}:${editor.event.version}`
                : editor.asoCardId || "new"
            }
            companyId={company.id}
            initialPayload={editor.payload}
            initialReference={editor.sourceReference}
            employees={payroll.employees}
            employer={payroll.company}
            editing={!!editor.event}
            lockEventType={!!editor.asoCardId}
            busy={busy}
            onSave={save}
            onCancel={() => setEditor(null)}
          />
        </div>
      ) : (
        <>
          {workspace.events.length ? (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Evento / colaborador</th>
                    <th className="p-3">Ambiente</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Recibo do evento</th>
                    <th className="p-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.events.map((event) => (
                    <tr key={event.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">
                          {event.eventType.replace("S", "S-")} ·{" "}
                          {event.employeeName || "Nome não informado"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Atualizado em {displayDate(event.updatedAt)}
                        </p>
                      </td>
                      <td className="p-3 text-xs">
                        {event.environment === "production" ? "Produção" : "Produção restrita"}
                      </td>
                      <td className="p-3">
                        <EventStatus event={event} />
                      </td>
                      <td className="max-w-52 break-all p-3 font-mono text-xs">
                        {event.receipt || "Ainda sem recibo"}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void openEvent(event)}
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <FileCode2 className="mx-auto mb-3 size-7 text-slate-400" />
              <p className="font-medium">Nenhum evento preparado para este cliente.</p>
              <p className="mt-1 text-sm text-slate-500">
                Use Preparar evento ou abra um ASO na esteira.
              </p>
            </div>
          )}
          {workspace.nextCursor && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void perform(() => load(workspace.nextCursor!))}
            >
              Carregar mais eventos
            </Button>
          )}
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.eventType.replace("S", "S-")} · {selected.employeeName || company.name}
                </DialogTitle>
                <DialogDescription>
                  {selected.environment === "production" ? "Produção" : "Produção restrita"} ·{" "}
                  {selected.companyName}
                </DialogDescription>
              </DialogHeader>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <EventDetails
                key={`${selected.id}:${selected.version}`}
                event={selected}
                capabilities={capabilities}
                busy={busy}
                unconfirmed={unconfirmedId === selected.id}
                onAction={action}
                onRefresh={() => void openEvent(selected)}
                onEdit={() => void openEvent(selected, true)}
                onDownload={(type) =>
                  void perform(() =>
                    api.download(
                      `/documents?${new URLSearchParams({ id: selected.id, type })}`,
                      `${selected.eventType}-${selected.id}-${type}.xml`
                    )
                  )
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (!busy) setImportOpen(open);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar XML do evento</DialogTitle>
            <DialogDescription>
              O XML será validado e salvo como prévia. A assinatura e a transmissão são etapas
              separadas.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <XmlImport
            busy={busy}
            onImport={(xml, sourceReference) =>
              perform(async () => {
                const result = await api.request<{ event: EsocialMessageEvent }>(
                  "/messaging",
                  jsonRequest({ action: "import_xml", companyId: company.id, xml, sourceReference })
                );
                if (active.current) {
                  receive(result.event);
                  setImportOpen(false);
                }
              })
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog open={productionOpen} onOpenChange={setProductionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Habilitar produção para este cliente</DialogTitle>
            <DialogDescription>
              Eventos elegíveis:{" "}
              {capabilities.productionEligibleTypes
                .map((type) => type.replace("S", "S-"))
                .join(", ") || "nenhum"}
              . Cada evento continuará exigindo aprovação e transmissão separadas.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await api.request(
                  "/messaging",
                  jsonRequest({
                    action: "enable_production",
                    companyId: company.id,
                    confirmed: true,
                  })
                );
                await load();
                if (active.current) setProductionOpen(false);
              })
            }
          >
            Confirmar habilitação
          </Button>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayloadFields({
  fields,
  payload,
  prefix = "",
}: {
  fields: readonly EsocialFormField[];
  payload: Record<string, unknown>;
  prefix?: string;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => {
        const path = prefix ? `${prefix}.${field.name}` : field.name;
        const value = valueAt(payload, path);
        if (value === undefined || value === null || value === "") return null;
        if (field.type === "array" && Array.isArray(value))
          return (
            <div key={path} className="space-y-2 sm:col-span-2">
              <dt className="text-xs font-medium text-slate-600">{field.label}</dt>
              <dd className="space-y-3">
                {value.map((_, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <PayloadFields
                      fields={field.fields || []}
                      payload={payload}
                      prefix={`${path}.${index}`}
                    />
                  </div>
                ))}
              </dd>
            </div>
          );
        if (field.type === "group")
          return (
            <div key={path} className="sm:col-span-2">
              <dt className="mb-2 text-xs font-medium text-slate-600">{field.label}</dt>
              <dd>
                <PayloadFields fields={field.fields || []} payload={payload} prefix={path} />
              </dd>
            </div>
          );
        const option = field.options?.find((item) => item.value === value);
        return (
          <div key={path}>
            <dt className="text-xs text-slate-500">{field.label}</dt>
            <dd className="wrap-break-word text-sm">
              {option?.label ||
                (typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function EventDetails({
  event,
  capabilities,
  busy,
  unconfirmed,
  onAction,
  onRefresh,
  onEdit,
  onDownload,
}: {
  event: EsocialMessageEvent;
  capabilities: EsocialMessagingCapabilities;
  busy: boolean;
  unconfirmed: boolean;
  onAction: (event: EsocialMessageEvent, action: Action) => Promise<void>;
  onEdit: () => void;
  onRefresh: () => void;
  onDownload: (kind: "unsigned" | "signed" | "response") => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [identity, setIdentity] = useState(false);
  const [documentChecked, setDocumentChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const chooseAction = (next: Action) => {
    setAction(next);
    setIdentity(false);
    setDocumentChecked(false);
    setConfirmed(false);
  };
  const form = ESOCIAL_EVENT_FORMS[event.eventType];
  const transmissionReady =
    !unconfirmed &&
    capabilities.certificate.configured &&
    capabilities.certificate.localValid &&
    capabilities.certificate.vaultConfigured &&
    (event.environment !== "production" ||
      (capabilities.productionEnabled &&
        capabilities.productionEligibleTypes.includes(event.eventType)));
  const confirmationText: Partial<Record<Action, string>> = {
    authorize: "Aprovar este conteúdo para envio",
    transmit: `Transmitir este evento em ${event.environment === "production" ? "produção" : "produção restrita"}`,
    rectify: "Preparar uma retificação vinculada ao recibo atual",
    exclude: "Preparar um evento de exclusão vinculado ao recibo atual",
    cancel: "Cancelar este rascunho",
    recover: "Recuperar o resultado com o mesmo XML assinado e o mesmo identificador",
  };
  return (
    <div className="space-y-4">
      {unconfirmed && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-300 p-3 text-sm text-amber-900"
        >
          <p>
            A resposta da operação não foi confirmada. Consulte o estado salvo antes de tentar
            novamente.
          </p>
          <Button size="sm" variant="outline" disabled={busy} onClick={onRefresh}>
            Consultar situação salva
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <EventStatus event={event} />
        <span className="text-xs text-slate-500">
          {event.xsdValidated ? "Estrutura XML validada" : "Validação estrutural pendente"}
        </span>
      </div>
      <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">Protocolo do lote</dt>
          <dd className="break-all font-mono text-sm">{event.protocol || "Ainda sem protocolo"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Recibo do evento</dt>
          <dd className="break-all font-mono text-sm">{event.receipt || "Ainda sem recibo"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Documento de origem</dt>
          <dd className="wrap-break-word text-sm">{event.sourceReference}</dd>
        </div>
      </dl>
      {event.protocol && !event.receipt && (
        <p className="text-sm text-amber-900">
          O lote possui protocolo. O aceite do evento ainda depende do processamento e do recibo.
        </p>
      )}
      {event.status === "uncertain" && (
        <p role="status" className="rounded-lg border border-amber-300 p-3 text-sm text-amber-900">
          O resultado da transmissão é incerto. Consulte o retorno antes de qualquer nova tentativa
          para evitar duplicidade.
        </p>
      )}
      {!!event.issues.length && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-2 font-medium">Ocorrências do processamento</p>
          <ul className="space-y-2">
            {event.issues.map((issue, index) => (
              <li key={`${issue.code}:${index}`}>
                <span className="font-medium">{issue.code}</span> · {issue.description}
                {issue.location && (
                  <span className="block text-xs text-slate-500">{issue.location}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDownload("unsigned")}>
          <Download className="mr-2 size-3" />
          XML da prévia
        </Button>
        {event.certificateId && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onDownload("signed")}>
            <Download className="mr-2 size-3" />
            XML assinado
          </Button>
        )}
        {(event.receipt || event.protocol || event.officialCode) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onDownload("response")}
          >
            <Download className="mr-2 size-3" />
            {event.receipt ? "Retorno com recibo" : "Retorno do lote"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {["draft", "rejected"].includes(event.status) && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
            <Pencil className="mr-2 size-3" />
            Editar dados
          </Button>
        )}
        {event.status === "draft" && (
          <Button
            size="sm"
            disabled={busy || !event.xsdValidated}
            onClick={() => chooseAction("authorize")}
          >
            <CheckCheck className="mr-2 size-4" />
            Conferir e aprovar
          </Button>
        )}
        {event.status === "approved" && (
          <Button
            size="sm"
            disabled={busy || !transmissionReady}
            onClick={() => chooseAction("transmit")}
          >
            <Send className="mr-2 size-4" />
            Transmitir evento
          </Button>
        )}
        {["processing", "submitting", "uncertain"].includes(event.status) && !!event.protocol && (
          <Button size="sm" disabled={busy} onClick={() => void onAction(event, "query")}>
            <RefreshCw className="mr-2 size-4" />
            Consultar retorno
          </Button>
        )}
        {event.status === "submitting" && !event.protocol && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onAction(event, "query")}
          >
            <RefreshCw className="mr-2 size-4" />
            Consultar situação salva
          </Button>
        )}
        {event.status === "uncertain" && !event.protocol && (
          <Button
            size="sm"
            disabled={busy || !transmissionReady}
            onClick={() => chooseAction("recover")}
          >
            <RefreshCw className="mr-2 size-4" />
            Recuperar resultado
          </Button>
        )}
        {event.status === "accepted" && event.receipt && event.eventType !== "S3000" && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => chooseAction("rectify")}
            >
              Retificar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => chooseAction("exclude")}
            >
              Preparar exclusão
            </Button>
          </>
        )}
        {["draft", "approved", "rejected"].includes(event.status) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => chooseAction("cancel")}
          >
            <Ban className="mr-2 size-3" />
            Cancelar rascunho
          </Button>
        )}
      </div>
      {event.status === "approved" && !transmissionReady && (
        <p className="text-sm text-amber-900">
          Transmissão bloqueada: confira o A1 e a habilitação do ambiente para este tipo de evento.
        </p>
      )}
      {action && action !== "query" && (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">{confirmationText[action]}</h3>
          {action === "authorize" ? (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={identity}
                  disabled={busy}
                  onChange={(change) => setIdentity(change.target.checked)}
                />
                Conferi o empregador, o CPF e o vínculo do trabalhador.
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={documentChecked}
                  disabled={busy}
                  onChange={(change) => setDocumentChecked(change.target.checked)}
                />
                Conferi todos os dados com o documento de origem.
              </label>
            </>
          ) : (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(change) => setConfirmed(change.target.checked)}
              />
              Confirmo esta operação para o evento e ambiente exibidos.
            </label>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                busy ||
                (action === "authorize" ? !identity || !documentChecked : !confirmed) ||
                (["transmit", "recover"].includes(action) && !transmissionReady)
              }
              onClick={() => void onAction(event, action)}
            >
              {busy ? "Processando…" : "Confirmar operação"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setAction(null);
                setIdentity(false);
                setDocumentChecked(false);
                setConfirmed(false);
              }}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}
      {event.payload && form && (
        <details className="rounded-lg border p-3" open>
          <summary className="cursor-pointer text-sm font-medium">Prévia dos dados</summary>
          <div className="mt-4 space-y-4">
            {form.sections.map((section) => (
              <section key={section.title}>
                <h4 className="mb-3 text-sm font-semibold">{section.title}</h4>
                <PayloadFields fields={section.fields} payload={event.payload!} />
              </section>
            ))}
          </div>
        </details>
      )}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          <History className="mr-2 inline size-4" />
          Histórico · {event.history?.length || 0} registros
        </summary>
        <ol className="mt-3 space-y-2 text-xs">
          {event.history?.map((item, index) => (
            <li key={`${item.version}:${index}`}>
              {displayDate(item.at)} · {item.action} · versão {item.version}
            </li>
          ))}
        </ol>
        <p className="mt-3 break-all text-xs text-slate-500">
          Identificador: {event.eventId} · Layout {event.layout}
        </p>
      </details>
    </div>
  );
}

function XmlImport({
  busy,
  onImport,
}: {
  busy: boolean;
  onImport: (xml: string, reference: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      !/\.xml$/i.test(file.name) ||
      !file.size ||
      file.size > 200 * 1024
    ) {
      setError("Selecione um XML de até 200 KB.");
      return;
    }
    setError("");
    try {
      await onImport(await file.text(), String(data.get("reference") || ""));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <label className="block space-y-1 text-sm">
        Arquivo XML
        <Input
          name="file"
          type="file"
          accept=".xml,text/xml,application/xml"
          required
          disabled={busy}
        />
      </label>
      <label className="block space-y-1 text-sm">
        Documento de origem / referência
        <Input name="reference" required maxLength={500} disabled={busy} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Validando XML…" : "Validar e preparar"}
      </Button>
    </form>
  );
}
