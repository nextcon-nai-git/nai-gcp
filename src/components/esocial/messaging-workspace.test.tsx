import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EsocialCertificateStatus,
  EsocialMessageEvent,
  EsocialMessagingCapabilities,
} from "@/lib/esocial-messaging";

const session = vi.hoisted(() => ({
  user: { uid: "synthetic-operator", getIdToken: async () => "test-token" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
}));
vi.mock("@/firebase", () => ({ useUser: () => session }));
import EsocialMessagingWorkspace from "./messaging-workspace";

const certificate: EsocialCertificateStatus = {
  configured: false,
  vaultConfigured: true,
  localValid: false,
  reason: "Certificado ainda não recebido.",
};
const capabilities: EsocialMessagingCapabilities = {
  certificate,
  grant: null,
  canManageCertificates: true,
  canManageGrants: true,
  productionEnabled: false,
  productionEligibleTypes: [],
  emailToClientsEnabled: false,
  monitorConfigured: false,
};
const eventFixture = (status: EsocialMessageEvent["status"] = "draft"): EsocialMessageEvent => ({
  id: "event-synthetic",
  version: 1,
  companyId: "company-synthetic",
  companyName: "Empresa fictícia",
  employeeId: "worker-synthetic",
  employeeName: "Colaborador fictício",
  eventType: "S2220",
  eventId: "ID-SYNTHETIC",
  environment: "restricted",
  status,
  sourceReference: "Documento de teste sem dados reais",
  payloadHash: "hash-test",
  layout: "test-layout",
  xsdValidated: true,
  businessValidation: "NOT_EVALUATED",
  issues: [],
  createdAt: "2026-01-10T12:00:00Z",
  createdBy: "synthetic-operator",
  updatedAt: "2026-01-10T12:00:00Z",
  updatedBy: "synthetic-operator",
  attempts: 0,
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
let host: HTMLDivElement, root: Root;
let events: EsocialMessageEvent[];
let config: EsocialMessagingCapabilities;
let companyList = [{ id: "company-synthetic", name: "Empresa fictícia", active: true }];
function fixtureResponse(url: unknown, init?: RequestInit) {
  const path = String(url);
  if (path.includes("/messaging/companies")) return json({ companies: companyList });
  if (path.includes("/certificates"))
    return json({ certificate: config.certificate, canManage: true });
  if (path.includes("/links")) return json({ employees: [] });
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    if (body.action === "authorize") events = [{ ...events[0], status: "approved", version: 2 }];
    return json({ event: events[0] });
  }
  if (path.includes("?id=")) return json({ event: events[0] });
  return json({ events, capabilities: config, nextCursor: null });
}
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === label
  )!;
const click = async (label: string) => {
  expect(button(label), label).toBeTruthy();
  await act(async () => button(label).click());
};
const render = async () => {
  await act(async () => root.render(<EsocialMessagingWorkspace />));
};
const posts = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");
function setValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.user = { uid: "synthetic-operator", getIdToken: async () => "test-token" };
  events = [eventFixture()];
  config = { ...capabilities };
  companyList = [{ id: "company-synthetic", name: "Empresa fictícia", active: true }];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => fixtureResponse(url, init))
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mensageria eSocial", () => {
  it("exige sessão e não consulta dados sem autenticação", async () => {
    session.user = null;
    await render();
    expect(host.textContent).toContain("Entre na sua conta");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("mostra carteira vazia e não inventa eventos nem envia mensagens", async () => {
    companyList = [];
    await render();
    expect(host.textContent).toContain("Nenhum cliente autorizado disponível");
    expect(host.textContent).toContain("Envio de e-mail aos clientes desativado");
    expect(posts()).toHaveLength(0);
  });
  it("mostra painel vazio e permite preparar sem A1", async () => {
    events = [];
    await render();
    expect(host.textContent).toContain("Nenhum evento preparado");
    expect(button("Preparar evento").disabled).toBe(false);
    await click("Preparar evento");
    expect(host.querySelector('form[aria-label="Preparação do evento eSocial"]')).not.toBeNull();
    expect(posts()).toHaveLength(0);
  });
  it("exige as duas conferências para aprovar e bloqueia transmissão sem A1", async () => {
    await render();
    await click("Abrir");
    await click("Conferir e aprovar");
    expect(button("Confirmar operação").disabled).toBe(true);
    const checks = [
      ...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]'),
    ];
    await act(async () => checks[0].click());
    expect(button("Confirmar operação").disabled).toBe(true);
    await act(async () => checks[1].click());
    await click("Confirmar operação");
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({
      action: "authorize",
      id: events[0].id,
      version: 1,
      identityConfirmed: true,
      documentChecked: true,
    });
    expect(button("Transmitir evento").disabled).toBe(true);
    expect(posts()).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes("/email"))).toBe(
      true
    );
  });
  it("não apresenta protocolo do lote como recibo aceito", async () => {
    events = [{ ...eventFixture("processing"), protocol: "PROTOCOLO-LOTE-TESTE" }];
    await render();
    await click("Abrir");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Protocolo do lotePROTOCOLO-LOTE-TESTE");
    expect(dialog.textContent).toContain("Recibo do eventoAinda sem recibo");
    expect(dialog.textContent).not.toContain("Aceito com recibo");
    expect(button("Consultar retorno")).toBeTruthy();
  });
  it("exige confirmação própria para recuperar resultado incerto sem protocolo", async () => {
    config = {
      ...capabilities,
      certificate: { ...certificate, configured: true, localValid: true },
    };
    events = [eventFixture("uncertain")];
    await render();
    await click("Abrir");
    expect(button("Transmitir evento")).toBeUndefined();
    await click("Recuperar resultado");
    expect(document.body.textContent).toContain("mesmo XML assinado e o mesmo identificador");
    expect(button("Confirmar operação").disabled).toBe(true);
    await act(async () =>
      document.querySelector<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')!.click()
    );
    await click("Confirmar operação");
    expect(JSON.parse(String(posts()[0][1]?.body))).toMatchObject({
      action: "recover",
      id: "event-synthetic",
      version: 1,
      confirmed: true,
    });
  });
  it("remove dados e ações se o servidor revogar acesso", async () => {
    await render();
    expect(host.textContent).toContain("Colaborador fictício");
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: "Acesso revogado" }, 403));
    await click("Atualizar");
    expect(host.textContent).toContain("Acesso à mensageria não autorizado");
    expect(host.textContent).not.toContain("Colaborador fictício");
    expect(button("Preparar evento")).toBeUndefined();
  });
  it("configura A1 sem transmitir e apaga a senha do formulário", async () => {
    companyList = [];
    await render();
    const form = host.querySelector<HTMLFormElement>("form")!;
    const password = form.querySelector<HTMLInputElement>('[name="password"]')!;
    const file = new File(["synthetic-certificate-bytes"], "synthetic.pfx");
    const originalFormData = FormData;
    const body = new originalFormData();
    body.set("file", file);
    body.set("password", "synthetic-password");
    body.set("registration", "00000000191");
    vi.stubGlobal(
      "FormData",
      vi.fn(function () {
        return body;
      })
    );
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await act(async () => {
      setValue(password, "synthetic-password");
      form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    });
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(posts()).toHaveLength(1);
    expect(String(posts()[0][0])).toBe("/api/esocial/certificates");
    expect(password.value).toBe("");
    expect(storage).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Nenhum evento foi transmitido");
  });
  it("limpa a conta anterior e ignora uma resposta tardia", async () => {
    let resolveOld!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    await render();
    session.user = { uid: "other-synthetic", getIdToken: async () => "other-test-token" };
    companyList = [];
    await render();
    await act(async () =>
      resolveOld(json({ companies: [{ id: "old", name: "Cliente anterior", active: true }] }))
    );
    expect(host.textContent).not.toContain("Cliente anterior");
    expect(host.textContent).toContain("Nenhum cliente autorizado disponível");
  });
  it("permite recarregar o ASO após corrigir um vínculo ausente e trava sua identidade", async () => {
    events = [];
    let linkReady = false;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes("asoCaseId="))
        return linkReady
          ? json({
              suggestion: {
                payload: {
                  eventType: "S2220",
                  ideEvento: { tpAmb: 2, indRetif: 1 },
                  ideEmpregador: { tpInsc: 1, nrInsc: "00000001" },
                  ideVinculo: { cpfTrab: "00000000191", matricula: "SYNTHETIC" },
                  aso: { exames: [{}], medico: {} },
                },
                sourceReference: "ASO sintético conferido",
                asoCardId: "aso-synthetic",
                sourceDocumentHash: "a".repeat(64),
              },
            })
          : json({ error: "Confira o vínculo da folha." }, 400);
      return fixtureResponse(url, init);
    });
    await act(async () =>
      root.render(
        <EsocialMessagingWorkspace initialCompany="company-synthetic" initialAso="aso-synthetic" />
      )
    );
    expect(host.textContent).toContain("Confira o vínculo da folha.");
    linkReady = true;
    await click("Carregar dados do ASO");
    expect(host.querySelector('form[aria-label="Preparação do evento eSocial"]')).not.toBeNull();
    expect(
      host.querySelector<HTMLSelectElement>('[aria-label="Tipo de evento eSocial"]')!.disabled
    ).toBe(true);
    expect(
      host.querySelector<HTMLSelectElement>('[aria-label="Colaborador do evento"]')!.disabled
    ).toBe(true);
    expect(posts()).toHaveLength(0);
  });
  it("bloqueia nova transmissão se a resposta e a releitura falharem até conferir estado salvo", async () => {
    events = [eventFixture("approved")];
    config = {
      ...capabilities,
      certificate: { ...certificate, configured: true, localValid: true },
    };
    await render();
    await click("Abrir");
    await click("Transmitir evento");
    await act(async () =>
      document.querySelector<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')!.click()
    );
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      init?.method === "POST" || String(url).includes("?id=")
        ? json({ error: "Resposta indisponível." }, 503)
        : fixtureResponse(url, init)
    );
    await click("Confirmar operação");
    expect(document.body.textContent).toContain("A resposta da operação não foi confirmada");
    expect(button("Transmitir evento").disabled).toBe(true);
    expect(button("Confirmar operação").disabled).toBe(true);
    events = [{ ...events[0], version: 2, status: "processing", protocol: "BATCH-SYNTHETIC" }];
    vi.mocked(fetch).mockImplementation(async (url, init) => fixtureResponse(url, init));
    await click("Consultar situação salva");
    expect(button("Transmitir evento")).toBeUndefined();
    expect(button("Consultar retorno")).toBeTruthy();
    expect(posts()).toHaveLength(1);
  });
});
