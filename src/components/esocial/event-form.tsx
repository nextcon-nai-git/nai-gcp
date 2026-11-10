"use client";

import { useId, useState, type FormEvent } from "react";
import { FileCheck2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ESOCIAL_EVENT_FORMS,
  EsocialEventInputSchema,
  createEsocialEventDefaults,
  type EsocialEventType,
  type EsocialFormField,
} from "@/lib/esocial-events";
import { AsoIngestForm } from "./aso-ingest-form";
import { applyAsoDraft } from "@/lib/genkit/aso-draft";
import { S2220AuditPanel } from "./s2220-audit-panel";
import type { PayrollEmployee, PayrollDirectory } from "./payroll-link-settings";

type Payload = Record<string, unknown>;
const inputClass = "min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm";

function fieldPathParts(path: string): string[] {
  const parts = path.split(".");
  for (const part of parts)
    if (!part || part === "__proto__" || part === "constructor" || part === "prototype")
      throw new Error("Caminho de campo inválido.");
  return parts;
}

export function valueAt(payload: unknown, path: string): unknown {
  return fieldPathParts(path).reduce<unknown>(
    (value, part) =>
      value && typeof value === "object" && Object.hasOwn(value, part)
        ? (value as Payload)[part]
        : undefined,
    payload
  );
}

export function updateAt(payload: Payload, path: string, value: unknown): Payload {
  const parts = fieldPathParts(path);
  const copy = structuredClone(payload);
  let cursor: Payload = copy;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    // Reject prototype navigation at the property access as well as before cloning.
    if (part === "__proto__" || part === "constructor" || part === "prototype")
      throw new Error("Caminho de campo inválido.");
    if (Object.hasOwn(cursor, part)) {
      const child = cursor[part];
      if (child && typeof child === "object") {
        cursor = child as Payload;
        continue;
      }
    }
    const child = /^\d+$/.test(parts[index + 1]) ? [] : {};
    Object.defineProperty(
      cursor,
      part,
      Object.hasOwn(cursor, part)
        ? { value: child }
        : { value: child, writable: true, enumerable: true, configurable: true }
    );
    // A normal assignment could invoke an inherited setter; follow our own new child.
    cursor = child as Payload;
  }
  const leaf = parts[parts.length - 1];
  if (leaf === "__proto__" || leaf === "constructor" || leaf === "prototype")
    throw new Error("Caminho de campo inválido.");
  if (value === undefined) delete cursor[leaf];
  else
    Object.defineProperty(
      cursor,
      leaf,
      Object.hasOwn(cursor, leaf)
        ? { value }
        : { value, writable: true, enumerable: true, configurable: true }
    );
  return copy;
}

function newItem(fields: readonly EsocialFormField[] = []): Payload {
  return fields.reduce<Payload>((value, field) => {
    if (field.defaultValue !== undefined)
      return updateAt(value, field.name, structuredClone(field.defaultValue));
    if (field.required && field.type === "group")
      return updateAt(value, field.name, newItem(field.fields));
    if (field.type === "array" && field.minItems)
      return updateAt(
        value,
        field.name,
        Array.from({ length: field.minItems }, () => newItem(field.fields))
      );
    return value;
  }, {});
}

function Field({
  field,
  prefix = "",
  root,
  disabled,
  onChange,
}: {
  field: EsocialFormField;
  prefix?: string;
  root: Payload;
  disabled: boolean;
  onChange: (path: string, value: unknown) => void;
}) {
  const id = useId();
  const path = prefix ? `${prefix}.${field.name}` : field.name;
  const value = valueAt(root, path);
  if (
    field.showWhen &&
    !field.showWhen.values.includes(
      valueAt(root, field.showWhen.field) as string | number | boolean
    )
  )
    return null;
  if (field.type === "array") {
    const items = Array.isArray(value) ? value : [];
    const minimum = field.minItems ?? (field.required ? 1 : 0);
    return (
      <fieldset className="space-y-3 rounded-lg border p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
        </legend>
        {field.help && <p className="text-xs text-slate-600">{field.help}</p>}
        {items.map((_, index) => (
          <div key={index} className="rounded-lg bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium">
                {field.label} · {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remover ${field.label} ${index + 1}`}
                disabled={disabled || items.length <= minimum}
                onClick={() =>
                  onChange(
                    path,
                    items.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field.fields?.map((child) => (
                <Field
                  key={child.name}
                  field={child}
                  prefix={`${path}.${index}`}
                  root={root}
                  disabled={disabled}
                  onChange={onChange}
                />
              ))}
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || items.length >= (field.maxItems ?? 99)}
          onClick={() => onChange(path, [...items, newItem(field.fields)])}
        >
          <Plus className="mr-2 size-3" />
          Adicionar {field.label.toLocaleLowerCase("pt-BR")}
        </Button>
      </fieldset>
    );
  }
  if (field.type === "group") {
    const included = field.required || value !== undefined;
    return (
      <fieldset className="space-y-3 rounded-lg border p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
        </legend>
        {!field.required && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!included}
              disabled={disabled}
              onChange={(event) =>
                onChange(path, event.target.checked ? newItem(field.fields) : undefined)
              }
            />
            Incluir {field.label.toLocaleLowerCase("pt-BR")}
          </label>
        )}
        {field.help && <p className="text-xs text-slate-600">{field.help}</p>}
        {included && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field.fields?.map((child) => (
              <Field
                key={child.name}
                field={child}
                prefix={path}
                root={root}
                disabled={disabled}
                onChange={onChange}
              />
            ))}
          </div>
        )}
      </fieldset>
    );
  }
  if (field.type === "checkbox")
    return (
      <label className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          required={field.required}
          onChange={(event) => onChange(path, event.target.checked)}
        />
        <span>
          {field.label}
          {field.help && <span className="mt-1 block text-xs text-slate-500">{field.help}</span>}
        </span>
      </label>
    );
  const description = field.help ? `${id}-help` : undefined;
  return (
    <div className={`space-y-1 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.type === "select" ? (
        <select
          id={id}
          aria-describedby={description}
          className={inputClass}
          required={field.required}
          disabled={disabled}
          value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
          onChange={(event) => {
            const selected = field.options?.find(
              (option) => String(option.value) === event.target.value
            );
            onChange(path, selected?.value);
          }}
        >
          <option value="">Selecione</option>
          {field.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          className={inputClass}
          aria-describedby={description}
          value={typeof value === "string" ? value : ""}
          rows={3}
          disabled={disabled}
          required={field.required}
          onChange={(event) => onChange(path, event.target.value || undefined)}
        />
      ) : (
        <Input
          id={id}
          aria-describedby={description}
          type={field.type}
          value={
            field.type === "time" && typeof value === "string" && /^\d{4}$/.test(value)
              ? `${value.slice(0, 2)}:${value.slice(2)}`
              : typeof value === "number" || typeof value === "string"
                ? value
                : ""
          }
          disabled={disabled}
          required={field.required}
          onChange={(event) =>
            onChange(
              path,
              event.target.value === ""
                ? undefined
                : field.type === "number"
                  ? Number(event.target.value)
                  : event.target.value
            )
          }
        />
      )}
      {field.help && (
        <p id={description} className="text-xs text-slate-500">
          {field.help}
        </p>
      )}
    </div>
  );
}

function pruneHidden(payload: Payload, fields: readonly EsocialFormField[], prefix = ""): Payload {
  let cleaned = payload;
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    if (
      field.showWhen &&
      !field.showWhen.values.includes(
        valueAt(payload, field.showWhen.field) as string | number | boolean
      )
    )
      cleaned = updateAt(cleaned, path, undefined);
    else if (field.type === "group" && valueAt(cleaned, path) !== undefined)
      cleaned = pruneHidden(cleaned, field.fields || [], path);
    else if (field.type === "array") {
      const items = valueAt(cleaned, path);
      if (Array.isArray(items) && !items.length && !field.required) {
        cleaned = updateAt(cleaned, path, undefined);
        continue;
      }
      if (Array.isArray(items))
        items.forEach((_, index) => {
          cleaned = pruneHidden(cleaned, field.fields || [], `${path}.${index}`);
        });
    }
  }
  return cleaned;
}

function labelsByPath(fields: readonly EsocialFormField[], prefix = ""): Record<string, string> {
  return fields.reduce<Record<string, string>>((labels, field) => {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    labels[path] = field.label;
    return Object.assign(labels, field.fields ? labelsByPath(field.fields, path) : {});
  }, {});
}

export function EventForm({
  companyId,
  initialPayload,
  initialReference = "",
  editing = false,
  lockEventType = false,
  employees = [],
  employer,
  busy,
  onSave,
  onCancel,
}: {
  companyId?: string;
  initialPayload?: Payload;
  initialReference?: string;
  editing?: boolean;
  lockEventType?: boolean;
  employees?: PayrollEmployee[];
  employer?: PayrollDirectory["company"];
  busy: boolean;
  onSave: (payload: Payload, sourceReference: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [payload, setPayload] = useState<Payload>(
    initialPayload || {
      ...createEsocialEventDefaults("S2220"),
      ...(employer
        ? { ideEmpregador: { tpInsc: employer.tpInsc, nrInsc: employer.registration } }
        : {}),
    }
  );
  const [auditAgents, setAuditAgents] = useState<{ cpf: string; value: string } | null>(null);
  const workerCpf = String(valueAt(payload, "ideVinculo.cpfTrab") || "");
  const [reference, setReference] = useState(initialReference);
  const [errors, setErrors] = useState<string[]>([]);
  const eventType = payload.eventType as EsocialEventType;
  const form = ESOCIAL_EVENT_FORMS[eventType];
  const matchingEmployees = employees.filter(
    (employee) =>
      employee.cpf.replace(/\D/g, "") ===
      String(valueAt(payload, "ideVinculo.cpfTrab") || "").replace(/\D/g, "")
  );
  const selectedEmployee = matchingEmployees.length === 1 ? matchingEmployees[0] : undefined;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const cleaned = pruneHidden(
      payload,
      form.sections.flatMap((section) => section.fields)
    );
    const parsed = EsocialEventInputSchema.safeParse(cleaned);
    if (!parsed.success) {
      const labels = labelsByPath(form.sections.flatMap((section) => section.fields));
      setErrors(
        [
          ...new Set(
            parsed.error.issues.map((issue) => {
              const path = issue.path.filter((part) => typeof part !== "number").join(".");
              const label =
                labels[path] ||
                labels[
                  Object.keys(labels).find((candidate) => path.startsWith(`${candidate}.`)) || ""
                ] ||
                "Dados do evento";
              const message = /^(Invalid|Too small|Too big)/.test(issue.message)
                ? "Preencha ou confira este campo."
                : issue.message;
              return `${label}: ${message}`;
            })
          ),
        ].slice(0, 15)
      );
      return;
    }
    setErrors([]);
    await onSave(parsed.data as unknown as Payload, reference.trim());
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-5"
      aria-label="Preparação do evento eSocial"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          Evento
          <select
            aria-label="Tipo de evento eSocial"
            className={inputClass}
            disabled={busy || editing || lockEventType}
            value={eventType}
            onChange={(event) => {
              const defaults = createEsocialEventDefaults(event.target.value as EsocialEventType);
              setPayload({
                ...defaults,
                ideEmpregador: payload.ideEmpregador,
                ideVinculo:
                  event.target.value === "S2221"
                    ? {
                        cpfTrab: valueAt(payload, "ideVinculo.cpfTrab"),
                        matricula: valueAt(payload, "ideVinculo.matricula"),
                      }
                    : payload.ideVinculo,
              });
              setErrors([]);
            }}
          >
            {(Object.keys(ESOCIAL_EVENT_FORMS) as EsocialEventType[]).map((type) => (
              <option key={type} value={type} disabled={!editing && type === "S3000"}>
                {ESOCIAL_EVENT_FORMS[type].title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Documento de origem / referência
          <Input
            aria-label="Documento de origem / referência"
            required
            maxLength={500}
            disabled={busy}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="ASO, CAT, laudo ou documento conferido"
          />
        </label>
      </div>
      <div className="space-y-3 rounded-lg bg-slate-50 p-3">
        <label className="block space-y-1 text-sm font-medium">
          Usar colaborador cadastrado
          <select
            aria-label="Colaborador do evento"
            className={inputClass}
            disabled={busy || editing || lockEventType}
            value={selectedEmployee?.id || ""}
            onChange={(event) => {
              const employee = employees.find((item) => item.id === event.target.value);
              if (!employee) return;
              setPayload((current) =>
                updateAt(current, "ideVinculo", {
                  cpfTrab: employee.cpf,
                  ...(employee.link?.matricula ? { matricula: employee.link.matricula } : {}),
                  ...(employee.link?.category ? { codCateg: employee.link.category } : {}),
                })
              );
            }}
          >
            <option value="">Selecione o cadastro do colaborador</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.cpf}
                {employee.link ? " · Vínculo conferido" : " · Vínculo pendente"}
              </option>
            ))}
          </select>
        </label>
        {selectedEmployee && !selectedEmployee.link && (
          <p className="text-xs text-amber-900">
            Registre o vínculo deste colaborador na seção Vínculo da folha antes de preparar o
            evento.
          </p>
        )}
        {employer && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || editing}
            onClick={() =>
              setPayload((current) =>
                updateAt(current, "ideEmpregador", {
                  tpInsc: employer.tpInsc,
                  nrInsc: employer.registration,
                })
              )
            }
          >
            Usar inscrição cadastrada do cliente
          </Button>
        )}
        <p className="text-xs text-slate-600">
          Confirme a inscrição do empregador conforme o S-1000 e o vínculo conforme a folha. Os
          campos clínicos devem ser preenchidos com os documentos conferidos.
        </p>
      </div>
      <p className="text-sm text-slate-600">{form.description}</p>
      {eventType === "S2220" && companyId && (
        <AsoIngestForm
          companyId={companyId}
          disabled={busy}
          onApply={(draft) => {
            const next = applyAsoDraft(payload, draft, editing || lockEventType);
            setPayload(next);
            setAuditAgents({
              cpf: String(next.ideVinculo.cpfTrab || ""),
              value: draft.agentesNocivosRelacionados.join(", "),
            });
            setErrors([]);
          }}
        />
      )}
      {form.sections.map((section) => (
        <fieldset key={section.title} className="space-y-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">{section.title}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields.map((field) => (
              <Field
                key={field.name}
                field={field}
                root={payload}
                disabled={
                  busy ||
                  ["ideEvento.indRetif", "ideEvento.nrRecibo"].includes(field.name) ||
                  (lockEventType && field.name.startsWith("ideVinculo.")) ||
                  (editing &&
                    ["ideEvento.tpAmb", "ideEmpregador", "ideVinculo", "infoExclusao"].some(
                      (path) => field.name === path || field.name.startsWith(`${path}.`)
                    ))
                }
                onChange={(path, value) => setPayload((current) => updateAt(current, path, value))}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {eventType === "S2220" && companyId && (
        <S2220AuditPanel
          agents={auditAgents?.cpf === workerCpf ? auditAgents.value : ""}
          onAgentsChange={(value) => setAuditAgents({ cpf: workerCpf, value })}
          companyId={companyId}
          payload={payload}
          cleanPayload={() =>
            pruneHidden(
              payload,
              form.sections.flatMap((s) => s.fields)
            )
          }
        />
      )}
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p className="font-medium">Confira os dados antes de gerar a prévia.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          <FileCheck2 className="mr-2 size-4" />
          {busy ? "Validando…" : editing ? "Salvar nova prévia" : "Gerar prévia"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Voltar
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        A prévia será validada e salva para conferência. Preparar um evento não o transmite.
      </p>
    </form>
  );
}
