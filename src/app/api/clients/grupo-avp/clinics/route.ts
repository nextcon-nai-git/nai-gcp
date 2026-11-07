import { NextRequest, NextResponse } from "next/server";
import { auth as googleAuth } from "googleapis/build/src/apis/places";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { AuthError } from "@/lib/auth/errors";
import { privateHeaders } from "@/lib/http/private-api";
import { adminDb } from "@/lib/firebase-admin";
import { getAvpSnapshot } from "@/services/avp-sheet-sync";
import {
  normalizeAvpCity,
  verifiedAvpClinicsForCity,
  type VerifiedAvpClinic,
} from "@/lib/avp-verified-clinics";
import { isAvpCostAtLeast40, parseAvpQuoteCents } from "@/lib/avp-costs";

export const dynamic = "force-dynamic";
type Stage = "authorization" | "snapshot" | "budget" | "provider";
class SearchFailure extends Error {
  constructor(public reason: "invalid_snapshot" | "invalid_counter" | "invalid_response") {
    super(reason);
  }
}
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders });
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function httpStatus(error: unknown) {
  if (!record(error)) return null;
  const response = record(error.response) ? error.response : null;
  const value = response?.status ?? error.status ?? error.code;
  const status =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-5]\d{2}$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}
function unavailable(
  stage: Stage,
  reason: string,
  status: number,
  code: string,
  message: string,
  clinics: VerifiedAvpClinic[] = [],
  upstreamStatus: number | null = null
) {
  // Only bounded categories and numeric status are logged. Never serialize SDK errors.
  console.warn(
    JSON.stringify({ event: "avp_clinic_search", stage, reason, status, upstreamStatus })
  );
  return json({ clinics, provider: "SITES_OFICIAIS", code, error: message }, status);
}
const safeUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
};
function placeLocation(value: unknown, city: string, uf: string) {
  if (!Array.isArray(value) || value.length > 30) return null;
  const cities = new Map<string, string>();
  const states = new Set<string>();
  const countries = new Set<string>();
  for (const component of value) {
    if (
      !record(component) ||
      !Array.isArray(component.types) ||
      component.types.some((type) => typeof type !== "string")
    )
      return null;
    if (
      component.types.includes("locality") ||
      component.types.includes("administrative_area_level_2")
    ) {
      const name = component.longText ?? component.shortText;
      if (typeof name !== "string" || !name.trim() || name.length > 100) return null;
      cities.set(normalizeAvpCity(name), name.trim());
    }
    for (const [type, values] of [
      ["administrative_area_level_1", states],
      ["country", countries],
    ] as const) {
      if (!component.types.includes(type)) continue;
      const code = component.shortText;
      if (typeof code !== "string" || !/^[a-z]{2}$/i.test(code.trim())) return null;
      values.add(code.trim().toUpperCase());
    }
  }
  const municipality = cities.get(normalizeAvpCity(city));
  if (
    cities.size !== 1 ||
    !municipality ||
    states.size !== 1 ||
    !states.has(uf) ||
    countries.size !== 1 ||
    !countries.has("BR")
  )
    return null;
  return { cidade: municipality, uf: [...states][0] };
}
function placesClinics(data: unknown, city: string, uf: string) {
  if (
    !record(data) ||
    "error" in data ||
    (data.places === undefined &&
      Object.keys(data).some(
        (key) =>
          !["nextPageToken", "searchUri", "routingSummaries", "contextualContents"].includes(key)
      )) ||
    (data.places !== undefined && (!Array.isArray(data.places) || data.places.length > 3))
  )
    throw new SearchFailure("invalid_response");
  const ids = new Set<string>();
  let locationUnconfirmed = false;
  const clinics: Array<VerifiedAvpClinic & { mapsUrl: string; provider: "GOOGLE_MAPS" }> = [];
  for (const place of (data.places as unknown[] | undefined) || []) {
    if (!record(place)) throw new SearchFailure("invalid_response");
    if (
      place.businessStatus !== undefined &&
      (typeof place.businessStatus !== "string" || place.businessStatus.length > 100)
    )
      throw new SearchFailure("invalid_response");
    if (place.businessStatus !== "OPERATIONAL") continue;
    const name = record(place.displayName) ? place.displayName.text : undefined;
    if (
      typeof place.id !== "string" ||
      !place.id.trim() ||
      place.id.length > 500 ||
      ids.has(place.id) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 1000
    )
      throw new SearchFailure("invalid_response");
    ids.add(place.id);
    const location = placeLocation(place.addressComponents, city, uf);
    if (!location) {
      locationUnconfirmed = true;
      continue;
    }
    const field = (key: string, max: number) => {
      const value = place[key];
      if (value === undefined) return "";
      if (typeof value !== "string" || value.length > max)
        throw new SearchFailure("invalid_response");
      return value;
    };
    clinics.push({
      id: place.id,
      nome: name,
      ...location,
      telefone: field("internationalPhoneNumber", 100),
      whatsapp: "",
      email: "",
      endereco: field("formattedAddress", 2000),
      sourceUrl: safeUrl(field("websiteUri", 2048)),
      mapsUrl: safeUrl(field("googleMapsUri", 2048)),
      verifiedAt: "",
      provider: "GOOGLE_MAPS",
    });
  }
  return { clinics, locationUnconfirmed };
}
export async function GET(req: NextRequest) {
  let stage: Stage = "authorization";
  let acquiringProviderIdentity = false;
  let verified: VerifiedAvpClinic[] = [];
  try {
    const user = await requireAuth(req);
    requireAvpAccess(user);
    const city = req.nextUrl.searchParams.get("city")?.trim() || "";
    const uf = req.nextUrl.searchParams.get("uf")?.trim().toUpperCase() || "";
    if (
      !city ||
      city.length > 100 ||
      ![
        "AC",
        "AL",
        "AM",
        "AP",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MG",
        "MS",
        "MT",
        "PA",
        "PB",
        "PE",
        "PI",
        "PR",
        "RJ",
        "RN",
        "RO",
        "RR",
        "RS",
        "SC",
        "SE",
        "SP",
        "TO",
      ].includes(uf)
    )
      return json({ code: "INVALID_INPUT", error: "Informe cidade e UF." }, 400);
    stage = "snapshot";
    const snapshot = await getAvpSnapshot();
    if (
      !record(snapshot) ||
      typeof snapshot.revision !== "string" ||
      !snapshot.revision.trim() ||
      !Array.isArray(snapshot.items) ||
      snapshot.items.some(
        (item) =>
          !record(item) ||
          typeof item.cidade !== "string" ||
          typeof item.uf !== "string" ||
          (item.valorAso !== null &&
            item.valorAso !== undefined &&
            typeof item.valorAso !== "string" &&
            typeof item.valorAso !== "number")
      )
    )
      throw new SearchFailure("invalid_snapshot");
    const { items } = snapshot;
    if (
      !items.some(
        (item) =>
          normalizeAvpCity(item.cidade) === normalizeAvpCity(city) &&
          item.uf === uf &&
          isAvpCostAtLeast40(parseAvpQuoteCents(item.valorAso))
      )
    )
      return json(
        {
          code: "CITY_NOT_ELIGIBLE",
          error: "A busca automática atende cidades da fila AVP com custo de R$ 40 ou mais.",
        },
        403
      );
    verified = verifiedAvpClinicsForCity(city, uf);
    if (verified.length >= 3)
      return json({ clinics: verified.slice(0, 3), provider: "SITES_OFICIAIS" });
    if (process.env.AVP_CLINIC_SEARCH_ENABLED !== "true")
      return json({
        clinics: verified,
        provider: "SITES_OFICIAIS",
        code: "SEARCH_DISABLED",
        error: "A busca automática no Google Maps está desativada no NAI.",
      });
    // Guarda apenas o contador de chamadas, sem armazenar resultados do Google Places.
    stage = "budget";
    const budget = adminDb
      .collection("integrations")
      .doc("grupo-avp")
      .collection("searchUsage")
      .doc(new Date().toISOString().slice(0, 10));
    const permitted = await adminDb.runTransaction(async (tx) => {
      const usage = await tx.get(budget);
      const count = usage.exists ? usage.data()?.count : 0;
      if (!Number.isSafeInteger(count) || count < 0) throw new SearchFailure("invalid_counter");
      if (count >= 100) return false;
      tx.set(budget, { count: count + 1 }, { merge: true });
      return true;
    });
    if (!permitted)
      return unavailable(
        stage,
        "daily_limit",
        429,
        "DAILY_LIMIT",
        "Limite diário de buscas atingido. Use o link do Maps para continuar.",
        verified
      );
    stage = "provider";
    acquiringProviderIdentity = true;
    const auth = new googleAuth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/maps-platform.places.textsearch"],
    });
    const client = await auth.getClient();
    // Compute/ADC can acquire credentials lazily. Resolve them before the Places phase.
    await client.getRequestHeaders("https://places.googleapis.com/v1/places:searchText");
    acquiringProviderIdentity = false;
    const response = await client.request<unknown>({
      url: "https://places.googleapis.com/v1/places:searchText",
      method: "POST",
      timeout: 15000,
      retry: false,
      headers: {
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus",
        "X-Goog-User-Project":
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8439299034-125c7",
      },
      data: {
        textQuery: `clínica medicina do trabalho ASO em ${city}, ${uf}, Brasil`,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 3,
      },
    });
    const { clinics, locationUnconfirmed } = placesClinics(response.data, city, uf);
    if (locationUnconfirmed)
      console.warn(
        JSON.stringify({
          event: "avp_clinic_search",
          stage: "provider",
          reason: "location_unconfirmed",
          status: 200,
          upstreamStatus: Number.isInteger(response.status) ? response.status : null,
        })
      );
    return json({
      clinics: clinics.length ? clinics : verified,
      provider: clinics.length ? "GOOGLE_MAPS" : "SITES_OFICIAIS",
      ...(locationUnconfirmed
        ? {
            code: "LOCATION_UNCONFIRMED",
            error:
              "Alguns resultados foram omitidos porque município, UF ou país não puderam ser confirmados.",
          }
        : {}),
      notice:
        "Confirme o atendimento de ASO e o valor para credenciados. O Google Maps não confirma WhatsApp ou credenciamento.",
    });
  } catch (error) {
    const status = httpStatus(error);
    if (
      stage === "authorization" &&
      error instanceof AuthError &&
      [401, 403].includes(error.status)
    )
      return unavailable(
        stage,
        error.status === 401 ? "unauthorized" : "forbidden",
        error.status,
        "ACCESS_DENIED",
        "Entre com uma conta autorizada para consultar a fila AVP.",
        [],
        error.status
      );
    if (stage === "authorization")
      return unavailable(
        stage,
        "unavailable",
        503,
        "AUTH_UNAVAILABLE",
        "Não foi possível conferir seu acesso à fila AVP. Tente novamente em instantes.",
        [],
        status
      );
    if (stage === "snapshot")
      return unavailable(
        stage,
        error instanceof SearchFailure ? error.reason : "unavailable",
        503,
        "SNAPSHOT_UNAVAILABLE",
        "Não foi possível conferir a fila AVP. Atualize antes de buscar clínicas.",
        [],
        status
      );
    if (stage === "budget")
      return unavailable(
        stage,
        error instanceof SearchFailure ? error.reason : "unavailable",
        503,
        "BUDGET_UNAVAILABLE",
        "Não foi possível confirmar o limite de buscas. Use os contatos disponíveis ou o Maps.",
        verified,
        status
      );
    if (stage === "provider" && (status === 401 || status === 403))
      return unavailable(
        stage,
        "configuration",
        503,
        "PROVIDER_CONFIGURATION",
        "A busca externa está indisponível por configuração ou acesso. Use os contatos disponíveis ou o Maps.",
        verified,
        status
      );
    if (acquiringProviderIdentity)
      return unavailable(
        stage,
        "identity_unavailable",
        503,
        "PROVIDER_AUTH_UNAVAILABLE",
        "Não foi possível autenticar a busca externa. Use os contatos disponíveis ou o Maps.",
        verified,
        status
      );
    if (stage === "provider" && status === 429)
      return unavailable(
        stage,
        "quota",
        429,
        "PROVIDER_QUOTA",
        "O provedor atingiu um limite temporário de buscas. Use os contatos disponíveis ou o Maps.",
        verified,
        status
      );
    return unavailable(
      stage,
      error instanceof SearchFailure ? error.reason : "unavailable",
      error instanceof SearchFailure ? 502 : 503,
      error instanceof SearchFailure ? "PROVIDER_INVALID_RESPONSE" : "PROVIDER_UNAVAILABLE",
      "Não foi possível consultar a busca automática. Use os contatos disponíveis ou o Maps.",
      verified,
      status
    );
  }
}
