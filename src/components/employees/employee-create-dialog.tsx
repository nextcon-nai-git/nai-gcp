"use client";
import * as React from "react";
import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCpf } from "@/lib/cpf";

export type EmployeeDraftValues = {
  name: string;
  cpf: string;
  jobTitle: string;
  birthDate?: string;
  cnhCategory?: string;
  cnhExpiration?: string;
};

export function EmployeeCreateDialog({
  open,
  onOpenChange,
  db,
  companies,
  selectedCompany,
  onSaved,
  initialValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: Firestore | null;
  companies: Array<{ id: string; name?: string }>;
  selectedCompany: string;
  onSaved: () => void;
  initialValues?: EmployeeDraftValues | null;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || busy) return;
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") || "").trim();
    const cpf = String(values.get("cpf") || "").replace(/\D/g, "");
    const companyId = String(values.get("companyId") || "");
    const jobTitle = String(values.get("jobTitle") || "").trim();
    const birthDate = String(values.get("birthDate") || "");
    const cnhCategory = String(values.get("cnhCategory") || "")
      .trim()
      .toUpperCase();
    const cnhExpiration = String(values.get("cnhExpiration") || "");
    if (
      name.length < 3 ||
      jobTitle.length < 2 ||
      !isValidCpf(cpf) ||
      !companies.some((c) => c.id === companyId)
    ) {
      setError("Informe nome, CPF válido, cargo e uma unidade autorizada.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const target = doc(db, "companies", companyId, "employees", cpf);
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(target)).exists()) throw new Error("duplicate");
        transaction.set(target, {
          name,
          cpf,
          companyId,
          job_role: { title: jobTitle },
          jobTitle,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(birthDate ? { birthDate } : {}),
          ...(cnhCategory ? { cnhCategory } : {}),
          ...(cnhExpiration ? { cnhExpiration } : {}),
        });
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "duplicate"
          ? "Este CPF já possui cadastro nesta unidade. Consulte o registro existente."
          : "Não foi possível salvar. Confira seu acesso e tente novamente."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setError("");
          onOpenChange(value);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo colaborador</DialogTitle>
          <DialogDescription>
            {initialValues
              ? "Confira os dados extraídos, complete os campos pendentes e escolha a unidade antes de salvar."
              : "O cadastro será confirmado após a gravação na unidade selecionada."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="employee-name">Nome completo</Label>
            <Input
              id="employee-name"
              name="name"
              required
              minLength={3}
              maxLength={180}
              defaultValue={initialValues?.name || ""}
            />
          </div>
          <div>
            <Label htmlFor="employee-cpf">CPF</Label>
            <Input
              id="employee-cpf"
              name="cpf"
              required
              inputMode="numeric"
              maxLength={14}
              defaultValue={initialValues?.cpf || ""}
            />
          </div>
          <div>
            <Label htmlFor="employee-company">Unidade</Label>
            <select
              id="employee-company"
              name="companyId"
              required
              defaultValue={companies.some((c) => c.id === selectedCompany) ? selectedCompany : ""}
              className="w-full rounded-md border bg-background p-2 text-foreground"
            >
              <option value="">Selecione a unidade</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Unidade sem nome"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="employee-job">Cargo</Label>
            <Input
              id="employee-job"
              name="jobTitle"
              required
              minLength={2}
              maxLength={160}
              defaultValue={initialValues?.jobTitle || ""}
            />
          </div>
          {initialValues && (
            <>
              <div>
                <Label htmlFor="employee-birth">Data de nascimento documentada</Label>
                <Input
                  id="employee-birth"
                  name="birthDate"
                  type="date"
                  defaultValue={initialValues.birthDate || ""}
                />
              </div>
              <div>
                <Label htmlFor="employee-cnh-category">Categoria da CNH documentada</Label>
                <Input
                  id="employee-cnh-category"
                  name="cnhCategory"
                  maxLength={3}
                  defaultValue={initialValues.cnhCategory || ""}
                />
              </div>
              <div>
                <Label htmlFor="employee-cnh-expiration">Validade da CNH documentada</Label>
                <Input
                  id="employee-cnh-expiration"
                  name="cnhExpiration"
                  type="date"
                  defaultValue={initialValues.cnhExpiration || ""}
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !db}>
            {busy ? "Salvando…" : "Salvar colaborador"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
