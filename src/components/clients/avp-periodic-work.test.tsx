import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: async () => "test-token" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
}));
vi.mock("@/firebase", () => ({ useUser: () => session }));
import { AvpPeriodicWork } from "./avp-periodic-work";
let root: Root, host: HTMLDivElement;
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const fixture = {
  checkedAt: "2026-10-22T12:00:00Z",
  cards: [
    {
      person: {
        id: "periodico-2026-1",
        name: "Pessoa autorizada",
        city: "Curitiba",
        uf: "PR",
        cityKey: "CURITIBA|PR",
        unit: "Empresa",
        status: "Agendado",
        review: "Conferir",
        classification: "review",
        duplicateRows: 0,
      },
      sourceVersion: "a".repeat(64),
      state: null,
      stage: "validar",
      blocked: false,
      sourceChanged: false,
      overdue: false,
    },
  ],
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.user = { uid: "a", getIdToken: async () => "test-token" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("cards de periódicos", () => {
  it("mostra validação e responsável ausente mesmo com agenda informada na origem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(fixture)));
    await act(async () => root.render(<AvpPeriodicWork />));
    const card = host.querySelector("article")!;
    expect(card.textContent).toContain("Validar convocação");
    expect(card.textContent).toContain("Responsável: Não informado");
    expect(card.textContent).not.toContain("Concluído com evidências");
  });
  it("remove cards privados ao perder acesso", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(fixture))
      .mockResolvedValueOnce(response({ error: "Acesso revogado" }, 403));
    vi.stubGlobal("fetch", fetch);
    await act(async () => root.render(<AvpPeriodicWork />));
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Atualizar cards")!.click()
    );
    expect(host.textContent).not.toContain("Pessoa autorizada");
    expect(host.textContent).toContain("Acesso revogado");
  });
  it("não exibe resposta pendente da identidade anterior", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(
          new Promise((r) => {
            resolve = r;
          })
        )
        .mockResolvedValue(response({ checkedAt: "2026-10-22", cards: [] }))
    );
    await act(async () => root.render(<AvpPeriodicWork />));
    session.user = { uid: "b", getIdToken: async () => "other-token" };
    await act(async () => root.render(<AvpPeriodicWork />));
    await act(async () => resolve(response(fixture)));
    expect(host.textContent).not.toContain("Pessoa autorizada");
  });
});
