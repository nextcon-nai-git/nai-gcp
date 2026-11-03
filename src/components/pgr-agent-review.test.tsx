import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgrAgentReview } from "./pgr-agent-review";

const state = vi.hoisted(() => ({
  user: { uid: "synthetic-doctor" } as { uid: string } | null,
  profile: {
    role: "DOCTOR",
    companyId: null as string | null,
    tenantId: null as string | null,
    servedCompanies: ["one"],
    isUserLoading: false,
    userError: null as Error | null,
  },
  headers: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: state.user, ...state.profile }) }));
vi.mock("@/lib/pgr-request-headers", () => ({ pgrRequestHeaders: state.headers }));

let host: HTMLDivElement, root: Root, commits: string[];
let requests: Array<{
  init: RequestInit;
  resolve: (value: Response) => void;
}>;
const review = {
  resumo: "Revisão sintética reservada",
  achados: [],
  checklist: [],
  encaminhamentos: [],
  limites: "Conferência profissional pendente",
};
function View({ companyId = "one" }: { companyId?: string }) {
  useLayoutEffect(() => {
    commits.push(host.textContent || "");
  });
  return <PgrAgentReview companyId={companyId} cardId={"a".repeat(64)} role="medico_trabalho" />;
}
const render = (companyId = "one") => act(async () => root.render(<View companyId={companyId} />));
const reply = (index: number, body: unknown, status = 200) =>
  act(async () => requests[index].resolve(new Response(JSON.stringify(body), { status })));
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.user = { uid: "synthetic-doctor" };
  state.profile = {
    role: "DOCTOR",
    companyId: null,
    tenantId: null,
    servedCompanies: ["one"],
    isUserLoading: false,
    userError: null,
  };
  state.headers.mockReset().mockResolvedValue({ Authorization: "Bearer synthetic" });
  requests = [];
  commits = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => requests.push({ init, resolve }))
    )
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("revisão de agente vinculada à sessão e ao documento", () => {
  it.each(["documento", "papel", "carteira"])(
    "oculta a revisão já no primeiro render após mudar %s",
    async (change) => {
      await render();
      await reply(0, { review });
      expect(host.textContent).toContain(review.resumo);
      const previous = commits.length;
      if (change === "papel") state.profile.role = "ENGINEER";
      if (change === "carteira") state.profile.servedCompanies = ["two"];
      await render(change === "documento" ? "two" : "one");
      expect(commits.slice(previous).every((text) => !text.includes(review.resumo))).toBe(true);
      expect(requests).toHaveLength(2);
    }
  );

  it.each(["loading", "error"])("não consulta enquanto o perfil está em %s", async (condition) => {
    if (condition === "loading") state.profile.isUserLoading = true;
    else state.profile.userError = new Error("Perfil indisponível");
    await render();
    expect(requests).toHaveLength(0);
    expect(host.querySelector("button")?.disabled).toBe(true);
  });

  it("não envia a consulta se a obtenção do token terminar após sair", async () => {
    let release!: (value: object) => void;
    state.headers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    await render();
    state.user = null;
    await render();
    await act(async () => release({ Authorization: "Bearer old-session" }));
    expect(requests).toHaveLength(0);
  });

  it("não envia uma geração pendente após trocar a sessão", async () => {
    await render();
    await reply(0, { review: null });
    let release!: (value: object) => void;
    state.headers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    await act(async () => host.querySelector("button")!.click());
    state.user = { uid: "other-synthetic-user" };
    await render();
    await act(async () => release({ Authorization: "Bearer previous-user" }));
    expect(requests.some((entry) => entry.init.method === "POST")).toBe(false);
  });

  it("reserva a geração antes da próxima renderização para evitar duplo clique", async () => {
    await render();
    await reply(0, { review: null });
    await act(async () => {
      host.querySelector("button")!.click();
      host.querySelector("button")!.click();
    });
    expect(requests.filter((entry) => entry.init.method === "POST")).toHaveLength(1);
    await reply(1, { review });
    expect(host.textContent).toContain(review.resumo);
    expect(host.querySelector("button")?.disabled).toBe(false);
  });

  it("limpa a revisão anterior quando o servidor informa perda de acesso", async () => {
    await render();
    await reply(0, { review });
    await act(async () => host.querySelector("button")!.click());
    await reply(1, { error: "Acesso negado" }, 403);
    expect(host.textContent).not.toContain(review.resumo);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Acesso negado");
  });
});
