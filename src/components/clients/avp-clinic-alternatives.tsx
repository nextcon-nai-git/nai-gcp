"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import {
  normalizeAvpCity,
  verifiedAvpClinicsForCity,
  type VerifiedAvpClinic,
} from "@/lib/avp-verified-clinics";
import { AVP_CREDENCIAMENTO_MESSAGE } from "@/lib/avp-source-config";
import { formatBrazilianWhatsApp } from "@/lib/avp-clinic-intelligence";

type Clinic = VerifiedAvpClinic & { mapsUrl?: string };
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function safeLink(value: unknown) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
function clinicResult(value: unknown, cidade: string, uf: string) {
  if (
    !record(value) ||
    typeof value.provider !== "string" ||
    !["GOOGLE_MAPS", "SITES_OFICIAIS"].includes(value.provider) ||
    !Array.isArray(value.clinics) ||
    value.clinics.length > 3 ||
    (value.code !== undefined &&
      (typeof value.code !== "string" ||
        !["SEARCH_DISABLED", "LOCATION_UNCONFIRMED"].includes(value.code))) ||
    (value.error !== undefined &&
      (typeof value.error !== "string" ||
        (value.code !== "SEARCH_DISABLED" && value.code !== "LOCATION_UNCONFIRMED"))) ||
    (value.code === "SEARCH_DISABLED" && value.provider !== "SITES_OFICIAIS")
  )
    return null;
  const google = value.provider === "GOOGLE_MAPS";
  const ids = new Set<string>();
  for (const clinic of value.clinics) {
    if (!record(clinic)) return null;
    const text = (key: string, max: number, required = false) =>
      typeof clinic[key] === "string" &&
      (clinic[key] as string).length <= max &&
      (!required || !!(clinic[key] as string).trim());
    if (
      !text("id", 500, true) ||
      ids.has(clinic.id as string) ||
      !text("nome", 1000, true) ||
      !text("cidade", 100, true) ||
      !text("uf", 2, true) ||
      normalizeAvpCity(clinic.cidade as string) !== normalizeAvpCity(cidade) ||
      clinic.uf !== uf.trim().toUpperCase() ||
      !text("telefone", 100) ||
      !text("whatsapp", 80) ||
      !/^[+\d ()-]*$/.test(clinic.whatsapp as string) ||
      !text("email", 320) ||
      (!!clinic.email && !/^[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(clinic.email as string)) ||
      !text("endereco", 2000) ||
      !safeLink(clinic.sourceUrl) ||
      (clinic.mapsUrl !== undefined && !safeLink(clinic.mapsUrl)) ||
      !text("verifiedAt", 10) ||
      (google && (clinic.whatsapp !== "" || clinic.email !== "" || clinic.verifiedAt !== "")) ||
      (!google && (!clinic.sourceUrl || !/^\d{4}-\d{2}-\d{2}$/.test(clinic.verifiedAt as string)))
    )
      return null;
    ids.add(clinic.id as string);
  }
  return {
    clinics: value.clinics as Clinic[],
    google: google && value.clinics.length > 0,
    error:
      value.code === "SEARCH_DISABLED"
        ? "A busca automática no Google Maps está desativada."
        : value.code === "LOCATION_UNCONFIRMED"
          ? "Algumas opções foram omitidas porque a localidade não pôde ser confirmada."
          : "",
  };
}
function failureMessage(status: number, code: unknown) {
  if (status === 401)
    return "Não foi possível validar sua sessão. Entre novamente para consultar as opções.";
  if (status === 403)
    return code === "CITY_NOT_ELIGIBLE"
      ? "A busca automática atende cidades da fila AVP com custo de R$ 40 ou mais."
      : "Sua conta não tem autorização para consultar as opções da fila AVP.";
  if (status === 400) return "Informe cidade e UF válidas para consultar as opções.";
  if (status === 429)
    return code === "DAILY_LIMIT"
      ? "Limite diário de buscas atingido. Use os contatos disponíveis ou o Maps."
      : code === "PROVIDER_QUOTA"
        ? "O provedor atingiu um limite temporário de buscas. Use os contatos disponíveis ou o Maps."
        : "A busca atingiu um limite temporário. Use os contatos disponíveis ou o Maps.";
  if (code === "AUTH_UNAVAILABLE")
    return "A validação de acesso está temporariamente indisponível. Tente novamente em instantes.";
  if (code === "SNAPSHOT_UNAVAILABLE")
    return "Não foi possível conferir a fila AVP. Atualize antes de buscar clínicas.";
  if (code === "BUDGET_UNAVAILABLE")
    return "Não foi possível conferir o limite diário de buscas. Use os contatos disponíveis ou o Maps.";
  if (code === "PROVIDER_CONFIGURATION")
    return "A busca externa está indisponível por configuração ou acesso do provedor. Solicite a verificação ao administrador do NAI.";
  if (code === "PROVIDER_AUTH_UNAVAILABLE")
    return "Não foi possível autenticar a busca externa. Use os contatos disponíveis ou o Maps.";
  if (code === "PROVIDER_INVALID_RESPONSE")
    return "O provedor retornou dados inválidos. Use os contatos disponíveis ou o Maps.";
  if (code === "PROVIDER_UNAVAILABLE")
    return "O provedor de busca está temporariamente indisponível. Use os contatos disponíveis ou o Maps.";
  if (code === "INVALID_RESULT")
    return "A busca retornou dados inválidos. Use os contatos disponíveis ou o Maps.";
  return "Não foi possível consultar as opções. Use os contatos disponíveis ou a busca no Maps.";
}
export function AvpClinicAlternatives({ cidade, uf }: { cidade: string; uf: string }) {
  const { user } = useUser();
  const context = JSON.stringify([user?.uid || "signed-out", cidade, uf]);
  const initial: Clinic[] = verifiedAvpClinicsForCity(cidade, uf);
  const pending = useRef(false);
  const [state, setState] = useState({
    context,
    clinics: initial as Clinic[],
    loading: false,
    error: "",
    google: false,
  });
  const [attempt, setAttempt] = useState(0);
  const current =
    state.context === context
      ? state
      : {
          context,
          clinics: initial,
          loading: !!user && initial.length < 3,
          error: "",
          google: false,
        };
  useEffect(() => {
    const controller = new AbortController();
    const initial = verifiedAvpClinicsForCity(cidade, uf);
    pending.current = !!user && initial.length < 3;
    setState({ context, clinics: initial, loading: pending.current, error: "", google: false });
    if (!user || initial.length >= 3) return () => controller.abort();
    void (async () => {
      let tokenAcquired = false;
      try {
        const token = await user.getIdToken();
        tokenAcquired = true;
        if (controller.signal.aborted) return;
        const response = await fetch(
          `/api/clients/grupo-avp/clinics?city=${encodeURIComponent(cidade)}&uf=${encodeURIComponent(uf)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        const options = response.ok ? clinicResult(result, cidade, uf) : null;
        const localIds = new Set(initial.map((clinic) => clinic.id));
        const clinics = options?.google
          ? [...initial, ...options.clinics.filter((clinic) => !localIds.has(clinic.id))].slice(
              0,
              3
            )
          : options?.clinics.length
            ? options.clinics
            : initial;
        setState({
          context,
          clinics,
          loading: false,
          error: options
            ? options.error
            : failureMessage(
                response.status,
                response.ok ? "INVALID_RESULT" : record(result) ? result.code : undefined
              ),
          google: !!options?.google && clinics.some((clinic) => !localIds.has(clinic.id)),
        });
      } catch {
        if (!controller.signal.aborted)
          setState({
            context,
            clinics: initial,
            loading: false,
            error: failureMessage(tokenAcquired ? 503 : 401, undefined),
            google: false,
          });
      } finally {
        if (!controller.signal.aborted) pending.current = false;
      }
    })();
    return () => controller.abort();
  }, [cidade, uf, user, attempt, context]);
  return (
    <div className="space-y-3 rounded-xl border border-blue-400/30 p-3 text-sm">
      <div className="flex justify-between gap-2">
        <strong>Opções para negociar ASO</strong>
        <button
          className="underline"
          disabled={current.loading}
          onClick={() => {
            if (pending.current) return;
            pending.current = true;
            setState({ ...current, loading: !!user && initial.length < 3, error: "" });
            setAttempt((v) => v + 1);
          }}
        >
          Atualizar opções
        </button>
      </div>
      <p className="text-xs opacity-80">
        Custo atual de R$ 40 ou mais. Confirme preço, disponibilidade e credenciamento com cada
        clínica.
      </p>
      {current.loading && <p>Buscando até 3 clínicas…</p>}
      {current.error && (
        <p role="alert" className="text-xs text-amber-600">
          {current.error}
        </p>
      )}
      {!current.loading && !current.error && !current.clinics.length && (
        <p className="text-xs opacity-70">Não há contatos verificados disponíveis nesta lista.</p>
      )}
      {current.clinics.map((clinic) => (
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
      {current.google && (
        <div className="space-y-1">
          <p className="text-xs opacity-70">
            Confirme atendimento de ASO, preço e credenciamento. Estes resultados não confirmam
            WhatsApp ou vínculo com a rede credenciada.
          </p>
          <p translate="no" className="whitespace-nowrap text-sm font-normal text-slate-500">
            Google Maps
          </p>
        </div>
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
