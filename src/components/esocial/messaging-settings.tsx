"use client";

import { useRef, useState, type FormEvent } from "react";
import { FileKey2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  EsocialCertificateStatus,
  EsocialGrant,
  EsocialGrantProfile,
} from "@/lib/esocial-messaging";
import { displayDate, errorMessage, jsonRequest, type MessagingApi } from "./messaging-api";

const fieldClass = "space-y-1 text-sm";
const checkClass = "flex items-start gap-2 text-sm";

export function CertificateSettings({
  certificate,
  canManage,
  api,
  onChanged,
}: {
  certificate: EsocialCertificateStatus;
  canManage: boolean;
  api: MessagingApi;
  onChanged: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !confirmed) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !/\.(pfx|p12)$/i.test(file.name) ||
      !file.size ||
      file.size > 40 * 1024
    ) {
      setError("Selecione um arquivo .pfx ou .p12 de até 40 KB.");
      return;
    }
    form.set("confirmed", "true");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.request("/certificates", { method: "POST", body: form });
      setMessage("Certificado recebido. Nenhum evento foi transmitido.");
      setConfirmed(false);
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      // Neither the password nor certificate bytes are persisted in browser storage.
      if (passwordRef.current) passwordRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-white p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium">
        <FileKey2 aria-hidden="true" className="size-4" />
        Certificado A1
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${certificate.configured && certificate.localValid ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
        >
          {certificate.configured && certificate.localValid ? "Configurado" : "Pendente"}
        </span>
        {certificate.validUntil && (
          <span className="ml-auto text-xs text-slate-500">
            Validade: {displayDate(certificate.validUntil)}
          </span>
        )}
      </summary>
      <div className="mt-4 space-y-4">
        {certificate.holder && (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Titular</dt>
              <dd>{certificate.holder}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Inscrição</dt>
              <dd>{certificate.registration}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Emissor</dt>
              <dd>{certificate.issuer || "Não informado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Validade</dt>
              <dd>
                {displayDate(certificate.validFrom)} a {displayDate(certificate.validUntil)}
              </dd>
            </div>
          </dl>
        )}
        {certificate.reason && <p className="text-sm text-amber-900">{certificate.reason}</p>}
        <p className="text-xs text-slate-600">
          O upload configura a assinatura. A transmissão exige aprovação e uma ação separada para
          cada evento.
        </p>
        {canManage ? (
          <form onSubmit={(event) => void upload(event)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={fieldClass}>
                Arquivo A1 (.pfx ou .p12)
                <Input
                  ref={fileRef}
                  name="file"
                  type="file"
                  accept=".pfx,.p12"
                  required
                  disabled={busy || !certificate.vaultConfigured}
                />
              </label>
              <label className={fieldClass}>
                Senha do certificado
                <Input
                  ref={passwordRef}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={busy || !certificate.vaultConfigured}
                />
              </label>
              <label className={fieldClass}>
                CPF ou CNPJ do titular
                <Input
                  name="registration"
                  autoComplete="off"
                  required
                  maxLength={18}
                  defaultValue={certificate.registration || ""}
                  disabled={busy || !certificate.vaultConfigured}
                />
              </label>
            </div>
            <label className={checkClass}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy || !certificate.vaultConfigured}
              />
              Confirmo que este certificado pertence ao titular informado e está autorizado para uso
              no NAI.
            </label>
            {!certificate.vaultConfigured && (
              <p className="text-sm text-amber-900">
                Armazenamento seguro do certificado pendente de configuração.
              </p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={busy || !confirmed || !certificate.vaultConfigured}
            >
              <Upload className="mr-2 size-4" />
              {busy ? "Validando A1…" : "Configurar certificado"}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-slate-600">
            A configuração do A1 é feita por um administrador autorizado.
          </p>
        )}
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
      </div>
    </details>
  );
}

export function GrantSettings({
  companyId,
  grant,
  registration,
  canManage,
  api,
  onChanged,
}: {
  companyId: string;
  grant: EsocialGrant | null;
  registration?: string;
  canManage: boolean;
  api: MessagingApi;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [profiles, setProfiles] = useState<EsocialGrantProfile[]>(grant?.profiles || ["sst"]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !confirmed || !profiles.length) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.request(
        "/grants",
        jsonRequest({
          companyId,
          granteeRegistration: String(form.get("granteeRegistration") || ""),
          profiles,
          validFrom: form.get("validFrom"),
          validUntil: form.get("validUntil"),
          reference: form.get("reference"),
          active: form.get("active") === "on",
          confirmed: true,
        })
      );
      await onChanged();
      setMessage("Procuração registrada conforme sua conferência.");
      setConfirmed(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-white p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4" />
        Procuração do cliente
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
          {grant?.active ? "Registrada" : "Pendente"}
        </span>
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-slate-600">
          Registre os perfis e a vigência depois de conferir a autorização no e-CAC. Este registro é
          uma declaração do operador.
        </p>
        {grant && (
          <p className="text-sm">
            {grant.profiles
              .map((profile) => (profile === "sst" ? "SST" : "Toxicológico"))
              .join(" · ")}{" "}
            · {displayDate(grant.validFrom)} a {displayDate(grant.validUntil)} · {grant.reference}
          </p>
        )}
        {canManage ? (
          <form onSubmit={(event) => void save(event)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={fieldClass}>
                CPF ou CNPJ do procurador
                <Input
                  name="granteeRegistration"
                  required
                  maxLength={18}
                  defaultValue={grant?.granteeRegistration || registration || ""}
                  disabled={busy}
                />
              </label>
              <label className={fieldClass}>
                Referência da conferência
                <Input
                  name="reference"
                  required
                  maxLength={300}
                  defaultValue={grant?.reference || ""}
                  placeholder="Número da procuração / comprovante"
                  disabled={busy}
                />
              </label>
              <label className={fieldClass}>
                Válida desde
                <Input
                  name="validFrom"
                  type="date"
                  required
                  defaultValue={grant?.validFrom}
                  disabled={busy}
                />
              </label>
              <label className={fieldClass}>
                Válida até
                <Input
                  name="validUntil"
                  type="date"
                  required
                  defaultValue={grant?.validUntil}
                  disabled={busy}
                />
              </label>
            </div>
            <fieldset className="flex flex-wrap gap-4">
              <legend className="mb-2 text-sm font-medium">Perfis autorizados</legend>
              {(["sst", "toxicology"] as const).map((profile) => (
                <label className={checkClass} key={profile}>
                  <input
                    type="checkbox"
                    checked={profiles.includes(profile)}
                    disabled={busy}
                    onChange={(event) =>
                      setProfiles((current) =>
                        event.target.checked
                          ? [...current, profile]
                          : current.filter((item) => item !== profile)
                      )
                    }
                  />
                  {profile === "sst" ? "SST" : "Toxicológico"}
                </label>
              ))}
            </fieldset>
            <label className={checkClass}>
              <input
                name="active"
                type="checkbox"
                defaultChecked={grant?.active ?? true}
                disabled={busy}
              />
              Procuração em vigor
            </label>
            <label className={checkClass}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy}
              />
              Conferi a outorga, os perfis e a vigência na fonte oficial.
            </label>
            <Button type="submit" size="sm" disabled={busy || !confirmed || !profiles.length}>
              {busy ? "Salvando…" : "Salvar procuração"}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-slate-600">
            Um administrador autorizado pode registrar ou atualizar a procuração.
          </p>
        )}
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
      </div>
    </details>
  );
}
