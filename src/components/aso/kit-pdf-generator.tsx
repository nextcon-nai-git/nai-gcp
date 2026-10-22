"use client";

import { useEffect, useRef, useState } from "react";
import type { DigitalKit } from "@/types/aso-scheduler-types";
import { EMPTY_KIT_REGISTRATION, type KitRegistration } from "@/services/occupational-kit-pdf";

/** Fields in this panel are used only for the downloaded draft; no clinical record is changed. */
export function KitPdfGenerator({ kit }: { kit: DigitalKit }) {
  const [registration, setRegistration] = useState<KitRegistration>({ ...EMPTY_KIT_REGISTRATION });
  const [clinic, setClinic] = useState({ ...kit.clinicDetails });
  const [appointment, setAppointment] = useState(kit.appointmentDateTime);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  // React cleanup prevents a late module import from downloading after session unmount.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const labels: Record<keyof KitRegistration, string> = {
    registration: "Matrícula",
    birthDate: "Data de nascimento",
    admissionDate: "Data de admissão",
    unit: "Unidade",
    companyAddress: "Endereço da empresa",
    pcmsoDoctor: "Médico responsável pelo PCMSO",
    pcmsoCrm: "CRM / UF do responsável pelo PCMSO",
  };
  const download = async () => {
    if (busy || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      const { generateOccupationalKitPdf, occupationalKitFilename } =
        await import("@/services/occupational-kit-pdf");
      if (!alive.current) return;
      const draft = { ...kit, clinicDetails: clinic, appointmentDateTime: appointment };
      generateOccupationalKitPdf(draft, registration).save(occupationalKitFilename(draft));
      setReady(true);
    } catch {
      if (alive.current)
        setError("Não foi possível gerar o PDF. Confira os dados e tente novamente.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-cyan-700 bg-slate-900 p-5 space-y-4">
      <h3 className="text-lg font-bold text-white">Gerar kit ocupacional em PDF</h3>
      <p className="text-sm text-slate-300">
        Pedido de exames, ficha clínica e minuta de ASO. Data de emissão automática; data do exame e
        parecer ficam para o médico. Os campos abaixo complementam somente este PDF.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(labels).map(([key, label]) => (
          <label key={key} className="text-sm text-slate-200">
            {label}
            <input
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2 text-white"
              value={registration[key as keyof KitRegistration]}
              maxLength={180}
              onChange={(e) => {
                setRegistration((prev) => ({ ...prev, [key]: e.target.value }));
                setConfirmed(false);
              }}
            />
          </label>
        ))}
        {(
          [
            ["name", "Clínica"],
            ["address", "Endereço da clínica"],
            ["phone", "Telefone da clínica"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm text-slate-200">
            {label}
            <input
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2 text-white"
              value={clinic[key]}
              maxLength={180}
              onChange={(e) => {
                setClinic((prev) => ({ ...prev, [key]: e.target.value }));
                setConfirmed(false);
              }}
            />
          </label>
        ))}
        <label className="text-sm text-slate-200">
          Agendamento
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2 text-white"
            value={appointment}
            maxLength={180}
            onChange={(e) => {
              setAppointment(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
      </div>
      <label className="flex gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Conferi os dados, a clínica, os riscos e os exames com o PGR / PCMSO. Campos não informados
        ficarão em branco.
      </label>
      <button
        type="button"
        disabled={!confirmed || busy}
        onClick={download}
        className="rounded bg-cyan-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Gerando PDF…" : "Baixar kit completo em PDF"}
      </button>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {ready && (
        <p role="status" className="text-emerald-300">
          PDF gerado. A geração não registra pedido no SOC nem confirma envio à clínica.
        </p>
      )}
    </section>
  );
}
