"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { esocialTableOptions } from "@/lib/esocial-codes";
import { errorMessage, jsonRequest, type MessagingApi } from "./messaging-api";

export type PayrollEmployee = {
  id: string;
  name: string;
  cpf: string;
  status?: string;
  link?: {
    matricula?: string;
    category?: number;
    admissionDate?: string;
    reference: string;
    confirmedAt: string;
  };
};
export type PayrollDirectory = {
  employees: PayrollEmployee[];
  company?: { registration: string; tpInsc: 1 | 2 };
};
const selectClass = "h-10 w-full rounded-md border bg-white px-3 text-sm";

export function PayrollLinkSettings({
  companyId,
  employees,
  api,
  onChanged,
}: {
  companyId: string;
  employees: PayrollEmployee[];
  api: MessagingApi;
  onChanged: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const employee = employees.find((item) => item.id === employeeId);
  return (
    <details className="rounded-xl border bg-white p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Link2 className="size-4" />
        Vínculo da folha
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
          {employees.filter((item) => item.link).length}/{employees.length} conferidos
        </span>
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-slate-600">
          Confira a matrícula do trabalhador no eSocial com a folha. Para TSVE sem matrícula,
          informe a categoria correta.
        </p>
        <label className="block space-y-1 text-sm">
          Colaborador
          <select
            aria-label="Colaborador para vínculo da folha"
            className={selectClass}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            <option value="">Selecione um colaborador</option>
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · CPF {item.cpf}
                {item.link ? " · Conferido" : ""}
              </option>
            ))}
          </select>
        </label>
        {!employees.length && (
          <p className="text-sm text-slate-600">
            Nenhum colaborador disponível.{" "}
            <Link className="text-teal-700 underline" href="/employees">
              Abrir cadastro de colaboradores
            </Link>
          </p>
        )}
        {employee && (
          <LinkForm
            key={`${employee.id}:${employee.link?.confirmedAt || "empty"}`}
            companyId={companyId}
            employee={employee}
            api={api}
            onChanged={onChanged}
          />
        )}
      </div>
    </details>
  );
}

function LinkForm({
  companyId,
  employee,
  api,
  onChanged,
}: {
  companyId: string;
  employee: PayrollEmployee;
  api: MessagingApi;
  onChanged: () => Promise<void>;
}) {
  const [kind, setKind] = useState(employee.link?.category ? "category" : "matricula");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !confirmed) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.request(
        "/links",
        jsonRequest({
          companyId,
          employeeId: employee.id,
          ...(kind === "matricula"
            ? { matricula: String(data.get("matricula") || "").trim() }
            : { category: Number(data.get("category")) }),
          admissionDate: data.get("admissionDate") || undefined,
          reference: data.get("reference"),
          confirmed: true,
        })
      );
      await onChanged();
      setConfirmed(false);
      setMessage(
        "Vínculo conferido e salvo. Selecione o colaborador no formulário para usar os dados atualizados."
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void save(event)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Identificação do vínculo
          <select
            aria-label="Identificação do vínculo"
            value={kind}
            className={selectClass}
            disabled={busy}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="matricula">Matrícula no eSocial</option>
            <option value="category">TSVE sem matrícula</option>
          </select>
        </label>
        {kind === "matricula" ? (
          <label className="space-y-1 text-sm">
            Matrícula conferida na folha
            <Input
              name="matricula"
              required
              maxLength={30}
              defaultValue={employee.link?.matricula}
              disabled={busy}
            />
          </label>
        ) : (
          <label className="space-y-1 text-sm">
            Categoria do trabalhador
            <select
              name="category"
              required
              className={selectClass}
              disabled={busy}
              defaultValue={employee.link?.category || ""}
            >
              <option value="">Selecione a categoria</option>
              {esocialTableOptions("01").map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="space-y-1 text-sm">
          Admissão (opcional)
          <Input
            name="admissionDate"
            type="date"
            defaultValue={employee.link?.admissionDate}
            disabled={busy}
          />
        </label>
        <label className="space-y-1 text-sm">
          Referência da conferência
          <Input
            name="reference"
            required
            maxLength={500}
            placeholder="Folha / cadastro de vínculo conferido"
            defaultValue={employee.link?.reference}
            disabled={busy}
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        Conferi o CPF e o vínculo com os registros da folha e do eSocial.
      </label>
      <Button size="sm" type="submit" disabled={busy || !confirmed}>
        {busy ? "Salvando…" : "Salvar vínculo conferido"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-800">
          {message}
        </p>
      )}
    </form>
  );
}
