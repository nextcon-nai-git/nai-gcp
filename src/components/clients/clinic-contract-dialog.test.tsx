import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodicClinic } from "@/lib/avp-periodic-control";
const session = vi.hoisted(() => ({
  user: { uid: "operator", getIdToken: async () => "synthetic" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
}));
vi.mock("@/firebase", () => ({ useUser: () => session }));
import { ClinicContractDialog } from "./clinic-contract-dialog";
let root: Root, host: HTMLDivElement;
const clinic: PeriodicClinic = {
  id: "example",
  name: "Nome fantasia",
  legalNames: ["Razão Social Exemplo Ltda"],
  cnpj: "00000000000000",
  city: "Curitiba",
  uf: "PR",
  cityKey: "CURITIBA|PR",
  origin: "provider-list",
  phones: [],
  emails: ["one@example.test", "two@example.test"],
  addresses: ["Rua Exemplo"],
  sourceRows: [2],
  contractReported: false,
  contractConflict: false,
  prices: [],
  naiRegistered: false,
  naiActive: null,
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.user = { uid: "operator", getIdToken: async () => "synthetic" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        json({ ready: true, canUpload: false, name: "template.docx", version: "v2" })
      )
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = async () => {
  await act(async () => root.render(<ClinicContractDialog clinic={clinic} onClose={() => {}} />));
};
describe("preparo do contrato por clínica", () => {
  it("preenche razão social, exige escolha de e-mail ambíguo e libera download após conferência", async () => {
    await render();
    const inputs = [...document.querySelectorAll<HTMLInputElement>("input")];
    expect(inputs.some((i) => i.value === "Razão Social Exemplo Ltda")).toBe(true);
    expect(inputs.some((i) => i.value === "one@example.test")).toBe(false);
    const button = (text: string) =>
      [...document.querySelectorAll("button")].find((b) => b.textContent === text)!;
    expect(button("Baixar minuta Word").disabled).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ text: "Minuta preenchida", pending: ["[____]"] })
    );
    await act(async () => button("Conferir minuta").click());
    expect(document.body.textContent).toContain("Minuta preenchida");
    expect(button("Baixar minuta Word").disabled).toBe(false);
    expect(button("Baixar rascunho de e-mail").disabled).toBe(true);
    const body = JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string);
    expect(body).toMatchObject({
      format: "preview",
      fields: { legalName: "Razão Social Exemplo Ltda", email: "" },
    });
    expect(body.fields).not.toHaveProperty("price");
  });
  it("remove conteúdo e ações ao perder autorização", async () => {
    await render();
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: "Acesso revogado" }, 403));
    const b = [...document.querySelectorAll("button")].find(
      (e) => e.textContent === "Conferir minuta"
    )!;
    await act(async () => b.click());
    expect(document.body.textContent).toContain("Acesso revogado");
    expect(document.body.textContent).not.toContain("Baixar minuta Word");
  });
  it("oculta o formulário e descarta prévia tardia ao trocar de conta", async () => {
    await render();
    let resolve!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    const b = [...document.querySelectorAll("button")].find(
      (e) => e.textContent === "Conferir minuta"
    )!;
    await act(async () => b.click());
    session.user = { uid: "other", getIdToken: async () => "other" };
    vi.mocked(fetch).mockResolvedValue(
      json({ ready: true, canUpload: false, name: "template.docx" })
    );
    await render();
    await act(async () => resolve(json({ text: "Conteúdo da conta anterior", pending: [] })));
    expect(document.body.textContent).not.toContain("Conteúdo da conta anterior");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
