import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VerifiedAvpClinic } from "@/lib/avp-verified-clinics";
import { deferred, ui } from "../../../tests/ui/harness";

const m = vi.hoisted(() => ({
  user: null as { uid: string; getIdToken: () => Promise<string> } | null,
  token: vi.fn(),
  verified: vi.fn(),
  contacts: [] as VerifiedAvpClinic[],
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/lib/avp-verified-clinics", async (original) => ({
  ...(await original<typeof import("@/lib/avp-verified-clinics")>()),
  verifiedAvpClinicsForCity: m.verified,
}));
import { AvpClinicAlternatives } from "./avp-clinic-alternatives";

const contact: VerifiedAvpClinic = {
  id: "local-test",
  nome: "Contato oficial de teste",
  cidade: "Fortaleza",
  uf: "CE",
  telefone: "(85) 3000-0000",
  whatsapp: "",
  email: "contato@example.invalid",
  endereco: "Endereço publicado de teste",
  sourceUrl: "https://example.invalid/",
  verifiedAt: "2026-10-01",
};
const suggestion = (cidade = "Fortaleza", uf = "CE") => ({
  ...contact,
  id: "google-test",
  nome: `Opção de teste ${cidade}`,
  cidade,
  uf,
  whatsapp: "",
  email: "",
  verifiedAt: "",
  mapsUrl: "https://maps.google.com/?cid=123",
});
const result = (cidade = "Fortaleza", uf = "CE") => ({
  clinics: [suggestion(cidade, uf)],
  provider: "GOOGLE_MAPS",
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let view: ReturnType<typeof ui>;
const render = (cidade = "Fortaleza", uf = "CE") =>
  view.render(<AvpClinicAlternatives cidade={cidade} uf={uf} />);
beforeEach(() => {
  vi.resetAllMocks();
  m.token.mockResolvedValue("token-current");
  m.user = { uid: "operator-current", getIdToken: m.token };
  m.contacts = [contact];
  m.verified.mockImplementation((cidade, uf) =>
    m.contacts.filter((entry) => entry.cidade === cidade && entry.uf === uf)
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => json(result()))
  );
  view = ui();
});
afterEach(async () => {
  await view.cleanup();
  vi.unstubAllGlobals();
});

describe("opções de clínicas sem sucesso ou evidência inventados", () => {
  it("exibe apenas resposta válida com atribuição e limites do Maps", async () => {
    await render();
    expect(view.container.textContent).toContain("Opção de teste Fortaleza");
    expect(view.container.querySelector('[translate="no"]')?.textContent).toBe("Google Maps");
    expect(view.container.textContent).toContain("não confirmam WhatsApp ou vínculo");
    expect(view.container.textContent).toContain(contact.nome);
    const googleCard = [...view.container.querySelectorAll("strong")].find(
      (node) => node.textContent === "Opção de teste Fortaleza"
    )!.parentElement!;
    expect(googleCard.textContent).not.toContain("Contato publicado no site · conferido");
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer token-current" },
      cache: "no-store",
    });
  });
  it.each([401, 403, 429, 503])("não transforma HTTP %s em lista de sucesso", async (status) => {
    vi.mocked(fetch).mockResolvedValue(json({ ...result(), error: "PRIVATE-SDK-CONTENT" }, status));
    await render();
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).not.toContain("Opção de teste Fortaleza");
    expect(view.container.textContent).not.toContain("PRIVATE-SDK-CONTENT");
    expect(view.container.querySelector('[role="alert"]')).not.toBeNull();
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([
    { status: 400, code: "INVALID_INPUT", expected: "cidade e UF válidas" },
    { status: 403, code: "CITY_NOT_ELIGIBLE", expected: "custo de R$ 40 ou mais" },
    { status: 503, code: "AUTH_UNAVAILABLE", expected: "validação de acesso" },
    { status: 503, code: "SNAPSHOT_UNAVAILABLE", expected: "conferir a fila AVP" },
    { status: 503, code: "BUDGET_UNAVAILABLE", expected: "conferir o limite diário" },
    { status: 503, code: "PROVIDER_CONFIGURATION", expected: "configuração ou acesso do provedor" },
    { status: 503, code: "PROVIDER_AUTH_UNAVAILABLE", expected: "autenticar a busca externa" },
    { status: 429, code: "DAILY_LIMIT", expected: "Limite diário de buscas atingido" },
    { status: 429, code: "PROVIDER_QUOTA", expected: "provedor atingiu um limite temporário" },
    {
      status: 502,
      code: "PROVIDER_INVALID_RESPONSE",
      expected: "provedor retornou dados inválidos",
    },
    {
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      expected: "provedor de busca está temporariamente",
    },
  ])("distingue a falha $code sem expor dados do servidor", async ({ status, code, expected }) => {
    vi.mocked(fetch).mockResolvedValue(
      json({ ...result(), code, error: "PRIVATE-PROVIDER-MESSAGE" }, status)
    );
    await render();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(expected);
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).not.toContain("PRIVATE-PROVIDER-MESSAGE");
    expect(view.container.textContent).not.toContain("Opção de teste Fortaleza");
    expect(fetch).toHaveBeenCalledOnce();
    if (code === "CITY_NOT_ELIGIBLE")
      expect(view.container.querySelector('[role="alert"]')?.textContent).not.toContain("conta");
  });
  it("distingue falha da sessão antes da busca sem expor o erro de autenticação", async () => {
    m.token.mockRejectedValue(new Error("PRIVATE-TOKEN-ERROR"));
    await render();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "validar sua sessão"
    );
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).not.toContain("PRIVATE-TOKEN-ERROR");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { provider: "GOOGLE_MAPS", clinics: {} },
    { provider: ["GOOGLE_MAPS"], clinics: [suggestion()] },
    { provider: "GOOGLE_MAPS", clinics: [{ ...suggestion(), id: undefined }] },
    { provider: "GOOGLE_MAPS", clinics: [{ ...suggestion(), nome: { value: "not a name" } }] },
    { provider: "GOOGLE_MAPS", clinics: [suggestion("Recife", "PE")] },
    { provider: "GOOGLE_MAPS", clinics: [{ ...suggestion(), sourceUrl: "javascript:alert(1)" }] },
    { provider: "GOOGLE_MAPS", clinics: [{ ...suggestion(), verifiedAt: "2026-10-01" }] },
    { provider: "GOOGLE_MAPS", clinics: [suggestion(), suggestion()] },
  ])("descarta lista inválida inteira e mantém contatos locais: %s", async (body) => {
    vi.mocked(fetch).mockResolvedValue(json(body));
    await render();
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).not.toContain("Opção de teste");
    expect(view.container.querySelector('[role="alert"]')).not.toBeNull();
    expect(view.container.querySelector('a[href^="javascript:"]')).toBeNull();
  });
  it("identifica dados inválidos em HTTP 200 sem declarar indisponibilidade do provedor", async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ ...result(), clinics: [suggestion("Recife", "PE")] })
    );
    await render();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "busca retornou dados inválidos"
    );
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).not.toContain("Opção de teste Recife");
  });
  it("mostra uma falha segura quando o corpo não contém JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>PRIVATE-UPSTREAM</html>", { status: 503 })
    );
    await render();
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).not.toContain("PRIVATE-UPSTREAM");
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível"
    );
  });
  it("limpa o erro ao atualizar e não faz retry nem aceita cliques paralelos", async () => {
    const next = deferred<Response>();
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ code: "SNAPSHOT_UNAVAILABLE" }, 503))
      .mockReturnValueOnce(next.promise);
    await render();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("fila AVP");
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => {
      view.button("Atualizar opções").click();
      view.button("Atualizar opções").click();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(view.button("Atualizar opções").disabled).toBe(true);
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => next.resolve(json(result())));
    expect(view.container.textContent).toContain("Opção de teste Fortaleza");
    expect(view.button("Atualizar opções").disabled).toBe(false);
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });
  it.each([200, 503])("ignora resposta tardia HTTP %s da cidade anterior", async (status) => {
    const old = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(json(result("Recife", "PE")));
    await render();
    await render("Recife", "PE");
    expect(view.container.textContent).toContain("Opção de teste Recife");
    await act(async () =>
      old.resolve(json({ ...result(), error: status === 503 ? "OLD-ERROR" : undefined }, status))
    );
    expect(view.container.textContent).toContain("Opção de teste Recife");
    expect(view.container.textContent).not.toContain("Fortaleza");
    expect(view.container.textContent).not.toContain("OLD-ERROR");
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });
  it("não inicia uma consulta da conta anterior se o token chega após a troca", async () => {
    const old = deferred<string>();
    m.token.mockReturnValueOnce(old.promise);
    await render();
    expect(fetch).not.toHaveBeenCalled();
    m.user = { uid: "operator-new", getIdToken: async () => "token-new" };
    await render();
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer token-new" },
    });
    await act(async () => old.resolve("token-old"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain("Opção de teste Fortaleza");
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });
  it("apaga opções da conta anterior após logout e conserva apenas a fonte local", async () => {
    await render();
    expect(view.container.textContent).toContain("Opção de teste Fortaleza");
    m.user = null;
    await render();
    expect(view.container.textContent).not.toContain("Opção de teste Fortaleza");
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("usa contatos oficiais suficientes sem disparar consulta externa", async () => {
    m.contacts = [contact, { ...contact, id: "local-2" }, { ...contact, id: "local-3" }];
    await render();
    expect(fetch).not.toHaveBeenCalled();
    expect(view.button("Atualizar opções").disabled).toBe(false);
    await view.click("Atualizar opções");
    expect(fetch).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain(
      "Confirme preço, disponibilidade e credenciamento"
    );
  });
  it("mantém o estado desligado explícito sem exibir a mensagem bruta do servidor", async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({
        clinics: [contact],
        provider: "SITES_OFICIAIS",
        code: "SEARCH_DISABLED",
        error: "PRIVATE-SDK-CONTENT",
      })
    );
    await render();
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("desativada");
    expect(view.container.textContent).not.toContain("PRIVATE-SDK-CONTENT");
  });
  it("não inventa clínica quando a consulta válida está vazia", async () => {
    m.contacts = [];
    vi.mocked(fetch).mockResolvedValue(json({ clinics: [], provider: "SITES_OFICIAIS" }));
    await render();
    expect(view.container.textContent).toContain("Não há contatos verificados disponíveis");
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
  });
  it("mantém contatos locais quando uma consulta válida não retorna opções externas", async () => {
    vi.mocked(fetch).mockResolvedValue(json({ clinics: [], provider: "GOOGLE_MAPS" }));
    await render();
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
  });
  it("explica a localidade não confirmada sem apagar contatos oficiais nem expor texto bruto", async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ ...result(), code: "LOCATION_UNCONFIRMED", error: "PRIVATE-PROVIDER-MESSAGE" })
    );
    await render();
    expect(view.container.textContent).toContain(contact.nome);
    expect(view.container.textContent).toContain("Opção de teste Fortaleza");
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "localidade não pôde ser confirmada"
    );
    expect(view.container.textContent).not.toContain("PRIVATE-PROVIDER-MESSAGE");
  });
});
