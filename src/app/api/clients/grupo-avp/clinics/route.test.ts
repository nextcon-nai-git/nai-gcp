// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  snapshot: vi.fn(),
  verified: vi.fn(),
  collection: vi.fn(),
  transaction: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  googleAuth: vi.fn(),
  getClient: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/avp-sheet-sync", () => ({ getAvpSnapshot: m.snapshot }));
vi.mock("@/lib/avp-verified-clinics", async (original) => ({
  ...(await original<typeof import("@/lib/avp-verified-clinics")>()),
  verifiedAvpClinicsForCity: m.verified,
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
vi.mock("googleapis/build/src/apis/places", () => ({
  auth: {
    GoogleAuth: class {
      constructor(options: unknown) {
        m.googleAuth(options);
      }
      getClient() {
        return m.getClient();
      }
    },
  },
}));
import { GET } from "./route";

const secret = "PRIVATE-SDK-CONTENT-MUST-NOT-LEAK";
const verified = {
  id: "verified-test",
  cidade: "Fortaleza",
  uf: "CE",
  nome: "Contato de teste publicado",
  telefone: "(85) 3000-0000",
  whatsapp: "",
  email: "contato@example.invalid",
  endereco: "Endereço de teste",
  sourceUrl: "https://example.invalid/",
  verifiedAt: "2026-10-01",
};
const address = (city = "Fortaleza", uf = "CE", country = "BR") => [
  { longText: city, shortText: city, types: ["administrative_area_level_2", "political"] },
  { longText: uf, shortText: uf, types: ["administrative_area_level_1", "political"] },
  { longText: country, shortText: country, types: ["country", "political"] },
];
const place = (id = "place-test") => ({
  id,
  displayName: { text: "Clínica de teste do Maps" },
  businessStatus: "OPERATIONAL",
  formattedAddress: "Endereço informado pelo Maps",
  internationalPhoneNumber: "+55 85 3000-0001",
  websiteUri: "https://clinic.example.invalid/",
  googleMapsUri: "https://maps.google.com/?cid=123",
  addressComponents: address(),
});
const request = (query = "city=Fortaleza&uf=CE") =>
  new NextRequest(`https://example.test/api/clients/grupo-avp/clinics?${query}`);
const budgetRef = { id: "test-budget" };
const assertPrivate = (response: Response) => {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
};
const diagnostics = () => vi.mocked(console.warn).mock.calls.map(([line]) => JSON.parse(String(line)));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AVP_CLINIC_SEARCH_ENABLED", "true");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  m.auth.mockResolvedValue({ uid: "operator-test", role: "SUPER_ADMIN", servedCompanies: [], tenantId: null });
  m.snapshot.mockResolvedValue({
    revision: "source-1:0",
    items: [{ cidade: "Fortaleza", uf: "CE", valorAso: "R$ 80,00" }],
  });
  m.verified.mockReturnValue([verified]);
  m.collection.mockReturnValue({
    doc: () => ({ collection: () => ({ doc: () => budgetRef }) }),
  });
  m.get.mockResolvedValue({ exists: false, data: () => undefined });
  m.transaction.mockImplementation(async (work) => work({ get: m.get, set: m.set }));
  m.getClient.mockResolvedValue({ request: m.request });
  m.request.mockResolvedValue({ data: { places: [place()] } });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("busca de clínicas AVP com evidência de falha segura", () => {
  it.each([401, 403])("interrompe autorização HTTP %s antes de ler ou cobrar uma busca", async (status) => {
    m.auth.mockRejectedValue(new AuthError(secret, status));
    const response = await GET(request());
    expect(response.status).toBe(status);
    assertPrivate(response);
    expect(await response.text()).not.toContain(secret);
    expect(m.snapshot).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.googleAuth).not.toHaveBeenCalled();
    expect(diagnostics()).toEqual([
      {
        event: "avp_clinic_search",
        stage: "authorization",
        reason: status === 401 ? "unauthorized" : "forbidden",
        status,
        upstreamStatus: status,
      },
    ]);
  });
  it("aplica o escopo AVP antes de ler a fila", async () => {
    m.auth.mockResolvedValue({ uid: "other", role: "OPERATIONS", tenantId: null, servedCompanies: ["OUTRO"] });
    const response = await GET(request());
    expect(response.status).toBe(403);
    assertPrivate(response);
    expect(m.snapshot).not.toHaveBeenCalled();
    expect(m.request).not.toHaveBeenCalled();
  });
  it("mantém respostas de entrada inválida e cidade não elegível privadas", async () => {
    const invalid = await GET(request("city=&uf=CE"));
    expect(invalid.status).toBe(400);
    assertPrivate(invalid);
    expect(m.snapshot).not.toHaveBeenCalled();
    m.snapshot.mockResolvedValue({ revision: "source:0", items: [] });
    const ineligible = await GET(request());
    expect(ineligible.status).toBe(403);
    assertPrivate(ineligible);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("distingue falha do snapshot de configuração do Places sem expor o SDK", async () => {
    m.snapshot.mockRejectedValue({ message: secret, response: { status: 403, data: secret, headers: { authorization: secret } } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    assertPrivate(response);
    expect(await response.json()).toMatchObject({ code: "SNAPSHOT_UNAVAILABLE", clinics: [] });
    expect(diagnostics()).toEqual([
      { event: "avp_clinic_search", stage: "snapshot", reason: "unavailable", status: 503, upstreamStatus: 403 },
    ]);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.googleAuth).not.toHaveBeenCalled();
  });
  it.each([
    { revision: "", items: [] },
    { revision: "source:0", items: null },
    { revision: "source:0", items: [{ cidade: null, uf: "CE", valorAso: 80 }] },
  ])("não considera fila ausente ou inválida como cidade fora do escopo: %s", async (snapshot) => {
    m.snapshot.mockResolvedValue(snapshot);
    const response = await GET(request());
    expect(response.status).toBe(503);
    assertPrivate(response);
    expect(diagnostics()[0]).toMatchObject({ stage: "snapshot", reason: "invalid_snapshot" });
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("mantém a busca desligada sem afirmar que a API precisa ser ativada", async () => {
    vi.stubEnv("AVP_CLINIC_SEARCH_ENABLED", "false");
    const response = await GET(request());
    expect(response.status).toBe(200);
    assertPrivate(response);
    expect(await response.json()).toMatchObject({ clinics: [verified], code: "SEARCH_DISABLED" });
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.googleAuth).not.toHaveBeenCalled();
  });
  it("usa três contatos oficiais sem consumir cota ou consultar Places", async () => {
    const contacts = [verified, { ...verified, id: "second" }, { ...verified, id: "third" }];
    m.verified.mockReturnValue(contacts);
    const response = await GET(request());
    assertPrivate(response);
    expect(await response.json()).toEqual({ clinics: contacts, provider: "SITES_OFICIAIS" });
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.request).not.toHaveBeenCalled();
  });
  it.each([-1, 0.5, "5", null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "recusa contador existente inválido sem consumir ou permitir busca: %s",
    async (count) => {
      m.get.mockResolvedValue({ exists: true, data: () => ({ count }) });
      const response = await GET(request());
      expect(response.status).toBe(503);
      assertPrivate(response);
      expect(await response.json()).toMatchObject({ clinics: [verified], code: "BUDGET_UNAVAILABLE" });
      expect(m.set).not.toHaveBeenCalled();
      expect(m.googleAuth).not.toHaveBeenCalled();
      expect(diagnostics()[0]).toMatchObject({ stage: "budget", reason: "invalid_counter" });
    }
  );
  it.each([0, 99])("reserva exatamente uma tentativa com contador válido %s", async (count) => {
    m.get.mockResolvedValue({ exists: true, data: () => ({ count }) });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(m.set).toHaveBeenCalledWith(budgetRef, { count: count + 1 }, { merge: true });
    expect(m.request).toHaveBeenCalledOnce();
  });
  it("cria o primeiro contador e desativa retry no transporte", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    assertPrivate(response);
    expect(m.set).toHaveBeenCalledWith(budgetRef, { count: 1 }, { merge: true });
    expect(m.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      retry: false,
      timeout: 15000,
      data: expect.objectContaining({ pageSize: 3 }),
      headers: expect.objectContaining({ "X-Goog-FieldMask": expect.stringContaining("places.addressComponents") }),
    }));
    const body = await response.json();
    expect(body.provider).toBe("GOOGLE_MAPS");
    expect(body.clinics[0]).toMatchObject({ nome: place().displayName.text, whatsapp: "", email: "", verifiedAt: "" });
  });
  it("nega a tentativa 101 e preserva contatos oficiais", async () => {
    m.get.mockResolvedValue({ exists: true, data: () => ({ count: 100 }) });
    const response = await GET(request());
    expect(response.status).toBe(429);
    assertPrivate(response);
    expect(await response.json()).toMatchObject({ clinics: [verified], code: "DAILY_LIMIT" });
    expect(m.set).not.toHaveBeenCalled();
    expect(m.googleAuth).not.toHaveBeenCalled();
    expect(diagnostics()[0]).toMatchObject({ stage: "budget", reason: "daily_limit" });
  });
  it("não atribui falha do contador ao provedor nem perde contatos disponíveis", async () => {
    m.transaction.mockRejectedValue({ code: 403, message: secret });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ clinics: [verified], code: "BUDGET_UNAVAILABLE" });
    expect(diagnostics()[0]).toMatchObject({ stage: "budget", reason: "unavailable", upstreamStatus: 403 });
    expect(m.googleAuth).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
  });
  it.each([
    { upstream: 401, status: 503, reason: "configuration" },
    { upstream: 403, status: 503, reason: "configuration" },
    { upstream: 429, status: 429, reason: "quota" },
    { upstream: 500, status: 503, reason: "unavailable" },
    { upstream: undefined, status: 503, reason: "unavailable" },
  ])("preserva fallback e registra somente categorias em falha do provedor: $upstream", async ({ upstream, status, reason }) => {
    m.request.mockRejectedValue({ message: secret, response: { status: upstream, data: secret, headers: { authorization: secret } }, config: { headers: { authorization: secret } } });
    const response = await GET(request());
    expect(response.status).toBe(status);
    assertPrivate(response);
    const body = await response.json();
    expect(body).toMatchObject({ clinics: [verified], provider: "SITES_OFICIAIS" });
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(diagnostics()).toEqual([
      { event: "avp_clinic_search", stage: "provider", reason, status, upstreamStatus: upstream ?? null },
    ]);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
    expect(m.request).toHaveBeenCalledOnce();
  });
  it("classifica falha da identidade do provedor sem tentar a busca", async () => {
    m.getClient.mockRejectedValue({ code: 403, message: secret });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ clinics: [verified], code: "PROVIDER_CONFIGURATION" });
    expect(m.request).not.toHaveBeenCalled();
    expect(diagnostics()[0]).toMatchObject({ stage: "provider", reason: "configuration" });
  });
  it.each([
    null,
    [],
    { error: { message: secret } },
    { unexpected: secret },
    { places: "invalid" },
    { places: [null] },
    { places: [{ id: "missing-name", businessStatus: "OPERATIONAL" }] },
    { places: [place(), place()] },
    { places: [place("1"), place("2"), place("3"), place("4")] },
    { places: [{ ...place(), businessStatus: ["OPERATIONAL"] }] },
  ])("rejeita resposta malformada sem inventar ou exibir lista parcial: %s", async (data) => {
    m.request.mockResolvedValue({ data });
    const response = await GET(request());
    expect(response.status).toBe(502);
    assertPrivate(response);
    expect(await response.json()).toMatchObject({ clinics: [verified], provider: "SITES_OFICIAIS" });
    expect(diagnostics()[0]).toMatchObject({ stage: "provider", reason: "invalid_response" });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
  });
  it.each([{}, { places: [] }, { searchUri: "https://maps.google.com/" }, { places: [{ businessStatus: "CLOSED_PERMANENTLY" }] }])(
    "aceita resposta vazia legítima sem descartar contatos oficiais: %s",
    async (data) => {
      m.request.mockResolvedValue({ data });
      const response = await GET(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ clinics: [verified], provider: "SITES_OFICIAIS" });
      expect(console.warn).not.toHaveBeenCalled();
    }
  );
  it("não promove links inseguros do provedor a links clicáveis", async () => {
    m.request.mockResolvedValue({ data: { places: [{ ...place(), websiteUri: "javascript:alert(1)", googleMapsUri: "https://name:password@example.invalid/" }] } });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).clinics[0]).toMatchObject({ sourceUrl: "", mapsUrl: "" });
  });
  it.each([
    undefined,
    [],
    address("Recife", "PE"),
    address("Fortaleza", "CE", "US"),
    address().filter((component) => !component.types.includes("country")),
    [...address(), { longText: "Maracanaú", shortText: "Maracanaú", types: ["locality"] }],
    [...address(), { longText: "PE", shortText: "PE", types: ["administrative_area_level_1"] }],
  ])("omite localidade ausente, divergente ou ambígua sem inferir pelo endereço livre: %s", async (addressComponents) => {
    m.request.mockResolvedValue({ data: { places: [{ ...place(), formattedAddress: "Rua em Fortaleza - CE, Brasil", addressComponents }] } });
    const response = await GET(request());
    expect(response.status).toBe(200);
    assertPrivate(response);
    expect(await response.json()).toMatchObject({ clinics: [verified], provider: "SITES_OFICIAIS", code: "LOCATION_UNCONFIRMED" });
    expect(diagnostics()[0]).toMatchObject({ stage: "provider", reason: "location_unconfirmed" });
  });
  it("não confunde municípios homônimos de UFs diferentes", async () => {
    m.snapshot.mockResolvedValue({ revision: "source:0", items: [{ cidade: "Bom Jesus", uf: "RS", valorAso: "80,00" }] });
    m.verified.mockReturnValue([]);
    m.request.mockResolvedValue({ data: { places: [{ ...place(), addressComponents: address("Bom Jesus", "PI") }] } });
    const response = await GET(request("city=Bom%20Jesus&uf=RS"));
    expect(await response.json()).toMatchObject({ clinics: [], code: "LOCATION_UNCONFIRMED" });
  });
  it("compara acentos sem substituir o município efetivamente informado pelo provedor", async () => {
    m.snapshot.mockResolvedValue({ revision: "source:0", items: [{ cidade: "São Luís", uf: "MA", valorAso: "80,00" }] });
    m.verified.mockReturnValue([]);
    m.request.mockResolvedValue({ data: { places: [{ ...place(), addressComponents: address("São Luís", "MA") }] } });
    const response = await GET(request("city=Sao%20Luis&uf=MA"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clinics).toHaveLength(1);
    expect(body.clinics[0]).toMatchObject({ cidade: "São Luís", uf: "MA" });
    expect(body.code).toBeUndefined();
  });
  it("mantém somente o resultado com localidade confirmada e informa a omissão", async () => {
    m.request.mockResolvedValue({ data: { places: [place("matching"), { ...place("other-city"), addressComponents: address("Recife", "PE") }] } });
    const response = await GET(request());
    const body = await response.json();
    expect(body.clinics).toHaveLength(1);
    expect(body.clinics[0].id).toBe("matching");
    expect(body.code).toBe("LOCATION_UNCONFIRMED");
  });
});
