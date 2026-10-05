"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/firebase";
import { verifiedAvpClinicsForCity, type VerifiedAvpClinic } from "@/lib/avp-verified-clinics";
import { AVP_CREDENCIAMENTO_MESSAGE } from "@/lib/avp-source-config";
import { formatBrazilianWhatsApp } from "@/lib/avp-clinic-intelligence";

type Clinic = VerifiedAvpClinic & { mapsUrl?: string };
export function AvpClinicAlternatives({ cidade, uf }: { cidade: string; uf: string }) {
  const { user } = useUser();
  const [state, setState] = useState({
    clinics: verifiedAvpClinicsForCity(cidade, uf) as Clinic[],
    loading: false,
    error: "",
    google: false,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const initial = verifiedAvpClinicsForCity(cidade, uf);
    setState({ clinics: initial, loading: !!user && initial.length < 3, error: "", google: false });
    if (!user || initial.length >= 3) return () => controller.abort();
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/clients/grupo-avp/clinics?city=${encodeURIComponent(cidade)}&uf=${encodeURIComponent(uf)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = await response.json();
        if (!controller.signal.aborted)
          setState({
            clinics: result.clinics || initial,
            loading: false,
            error: result.error || "",
            google: result.provider === "GOOGLE_MAPS",
          });
      } catch {
        if (!controller.signal.aborted)
          setState({
            clinics: initial,
            loading: false,
            error: "Não foi possível consultar as opções. Use a busca no Maps.",
            google: false,
          });
      }
    })();
    return () => controller.abort();
  }, [cidade, uf, user, attempt]);
  return (
    <div className="space-y-3 rounded-xl border border-blue-400/30 p-3 text-sm">
      <div className="flex justify-between gap-2">
        <strong>Opções para negociar ASO</strong>
        <button
          className="underline"
          disabled={state.loading}
          onClick={() => setAttempt((v) => v + 1)}
        >
          Atualizar opções
        </button>
      </div>
      <p className="text-xs opacity-80">
        Custo atual acima de R$40. Confirme valores e cadastro com cada clínica.
      </p>
      {state.loading && <p>Buscando até 3 clínicas…</p>}
      {state.error && <p className="text-xs text-amber-600">{state.error}</p>}
      {state.clinics.map((clinic) => (
        <div key={clinic.id} className="space-y-1 rounded-lg border border-slate-400/30 p-2">
          <strong>{clinic.nome}</strong>
          <p className="text-xs">{clinic.endereco}</p>
          <p>{clinic.telefone || "Telefone não informado"}</p>
          <div className="flex flex-wrap gap-3 text-xs underline">
            {clinic.whatsapp && (
              <a
                href={formatBrazilianWhatsApp(clinic.whatsapp, AVP_CREDENCIAMENTO_MESSAGE).waUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp com mensagem
              </a>
            )}
            {clinic.email && <a href={`mailto:${clinic.email}`}>E-mail</a>}
            {clinic.sourceUrl && (
              <a href={clinic.sourceUrl} target="_blank" rel="noopener noreferrer">
                Site da clínica
              </a>
            )}
            {clinic.mapsUrl && (
              <a href={clinic.mapsUrl} target="_blank" rel="noopener noreferrer">
                Ver no Google Maps
              </a>
            )}
          </div>
          {clinic.verifiedAt && (
            <p className="text-xs opacity-70">
              Contato publicado no site · conferido em {clinic.verifiedAt}
            </p>
          )}
        </div>
      ))}
      {state.google && (
        <p translate="no" className="whitespace-nowrap text-sm font-normal text-slate-500">
          Google Maps
        </p>
      )}
      <p className="text-xs opacity-70">
        Ao consultar o Google Maps, aplicam-se as{" "}
        <a href="/terms" target="_blank" className="underline">
          informações de uso
        </a>{" "}
        e a{" "}
        <a href="/privacy" target="_blank" className="underline">
          privacidade
        </a>
        .
      </p>
      <a
        className="inline-block underline"
        href={`https://www.google.com/maps/search/${encodeURIComponent(`clínica medicina do trabalho ASO ${cidade} ${uf}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Buscar mais clínicas no Maps
      </a>
    </div>
  );
}
