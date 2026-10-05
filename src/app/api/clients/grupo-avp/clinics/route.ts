import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { getAvpSnapshot } from "@/services/avp-sheet-sync";
import { normalizeAvpCity, verifiedAvpClinicsForCity } from "@/lib/avp-verified-clinics";
import { parseBrlCents } from "@/lib/avp-costs";

export const dynamic = "force-dynamic";
const safeUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: "Informe cidade e UF." }, { status: 400 });
    const { items } = await getAvpSnapshot();
    if (
      !items.some(
        (item) =>
          normalizeAvpCity(item.cidade) === normalizeAvpCity(city) &&
          item.uf === uf &&
          (parseBrlCents(item.valorAso) ?? 0) > 4000
      )
    )
      return NextResponse.json(
        { error: "A busca automática atende cidades da fila AVP com custo acima de R$40." },
        { status: 403 }
      );
    const verified = verifiedAvpClinicsForCity(city, uf);
    if (verified.length >= 3)
      return NextResponse.json(
        { clinics: verified, provider: "SITES_OFICIAIS" },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    if (process.env.AVP_CLINIC_SEARCH_ENABLED !== "true")
      return NextResponse.json(
        {
          clinics: verified,
          provider: "SITES_OFICIAIS",
          error: "A busca automática no Google Maps aguarda a ativação da API no projeto.",
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    // Guarda apenas o contador de chamadas, sem armazenar resultados do Google Places.
    const budget = adminDb
      .collection("integrations")
      .doc("grupo-avp")
      .collection("searchUsage")
      .doc(new Date().toISOString().slice(0, 10));
    const permitted = await adminDb.runTransaction(async (tx) => {
      const data = (await tx.get(budget)).data();
      if ((data?.count || 0) >= 100) return false;
      tx.set(budget, { count: (data?.count || 0) + 1 }, { merge: true });
      return true;
    });
    if (!permitted)
      return NextResponse.json(
        {
          clinics: verified,
          error: "Limite diário de buscas atingido. Use o link do Maps para continuar.",
        },
        { status: 429 }
      );
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/maps-platform.places.textsearch"],
    });
    const client = await auth.getClient();
    const response = await client.request<{
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        googleMapsUri?: string;
        businessStatus?: string;
      }>;
    }>({
      url: "https://places.googleapis.com/v1/places:searchText",
      method: "POST",
      timeout: 15000,
      headers: {
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus",
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
    const clinics = (response.data.places || [])
      .filter((place) => place.businessStatus === "OPERATIONAL")
      .slice(0, 3)
      .map((place) => ({
        id: place.id,
        nome: place.displayName?.text || "Clínica",
        cidade: city,
        uf,
        telefone: place.internationalPhoneNumber || "",
        whatsapp: "",
        email: "",
        endereco: place.formattedAddress || "",
        sourceUrl: safeUrl(place.websiteUri),
        mapsUrl: safeUrl(place.googleMapsUri),
        verifiedAt: "",
        provider: "GOOGLE_MAPS",
      }));
    return NextResponse.json(
      {
        clinics,
        provider: "GOOGLE_MAPS",
        notice:
          "Confirme o atendimento de ASO e o valor para credenciados. O Google Maps não confirma WhatsApp ou credenciamento.",
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      {
        error:
          "A busca está indisponível. Confira a ativação e o acesso à API Places; use o link do Maps enquanto isso.",
      },
      { status: 503 }
    );
  }
}
